const mongoose = require("mongoose");
const Event = require("../models/eventModel");
const Group = require("../models/groupModel");
const EventRegistration = require("../models/eventRegistrationModel");
const { isAMember } = require("./membershipController");
const { parseEventGeoLocation } = require("../utils/eventUtils");
const {
  generateVoucherCode,
  hashVoucherCode,
} = require("../utils/voucherCode");
const { sendEventRegistrationConfirmationEmail } = require("../utils/email");
const stripe = require("../utils/stripe");

const MAX_VOUCHER_ATTEMPTS = 5;

const isVoucherCodeCollision = (error) =>
  error?.code === 11000 &&
  Boolean(error.keyPattern?.voucherHash || error.keyValue?.voucherHash);

const createRegistrationWithVoucher = async (registrationData) => {
  for (let attempt = 0; attempt < MAX_VOUCHER_ATTEMPTS; attempt += 1) {
    const voucherCode = generateVoucherCode();

    try {
      const registration = await EventRegistration.create({
        ...registrationData,
        voucherHash: hashVoucherCode(voucherCode),
      });

      return { registration, voucherCode };
    } catch (error) {
      if (!isVoucherCodeCollision(error)) throw error;
    }
  }

  throw new Error("Could not generate a unique registration voucher.");
};

const registrationError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const registerForEvent = async (req, res, next) => {
  const {
    fullName,
    email,
    phoneNumber,
    gender,
    genderSelfDescription = "",
    location,
    campusName,
    major,
    yearOfStudy,
    termsAccepted,
  } = req.body || {};

  const requiredFields = {
    fullName, // fullName: fullName and so on for the other fields
    email,
    phoneNumber,
    gender,
    location,
    campusName,
    major,
    yearOfStudy,
  };

  for (const [field, value] of Object.entries(requiredFields)) {
    if (typeof value !== "string" || !value.trim()) {
      return res.status(400).json({
        success: false,
        message: `${field} is required.`,
      });
    }
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  const normalizedPhone = phoneNumber.trim();
  const phoneDigits = normalizedPhone.replace(/\D/g, "");
  if (
    !/^\+?[\d\s().-]+$/.test(normalizedPhone) ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 15
  ) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid phone number.",
    });
  }

  const allowedGenders = [
    "female",
    "male",
    "non-binary",
    "self-describe",
    "prefer-not-to-say",
  ];

  if (!allowedGenders.includes(gender)) {
    return res.status(400).json({
      success: false,
      message: "Please select a valid gender option.",
    });
  }

  const normalizedGenderDescription =
    typeof genderSelfDescription === "string"
      ? genderSelfDescription.trim()
      : "";

  if (gender === "self-describe" && !normalizedGenderDescription) {
    return res.status(400).json({
      success: false,
      message: "Please enter your gender description.",
    });
  }

  if (termsAccepted !== true) {
    return res.status(400).json({
      success: false,
      message: "You must accept the terms and conditions to register.",
    });
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid event id.",
    });
  }

  const locationResult = parseEventGeoLocation(req.body.geoLocation);
  if (locationResult.error) {
    return res.status(400).json({
      success: false,
      message: locationResult.error,
    });
  }

  let updatedEvent;

  try {
    const event = await Event.findById(req.params.id).select(
      "title date group location price",
    );

    if (!event) throw registrationError(404, "Event not found.");

    if (event.date <= new Date()) {
      throw registrationError(
        409,
        "Registration is closed because this event has already started.",
      );
    }

    if (event.group) {
      const group = await Group.findById(event.group);
      if (group?.isPrivate && !isAMember(group, req.user._id)) {
        throw registrationError(
          403,
          "Join the private group before registering for this event.",
        );
      }
    }

    const registrationData = {
      event: event._id,
      user: req.user._id,
      fullName: fullName.trim(),
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      gender,
      genderSelfDescription: normalizedGenderDescription,
      location: location.trim(),
      geoLocation: locationResult.geoLocation || undefined,
      campusName: campusName.trim(),
      major: major.trim(),
      yearOfStudy: yearOfStudy.trim(),
      termsAccepted: true,
      termsVersion: "event-registration-v1",
      termsAcceptedAt: new Date(),
    };

    // Payment related operations are performed here
    // for events with a price greater than 0.
    // For free events,
    // the registration is created directly without involving Stripe.
    if (event.price > 0) {
      let registration = await EventRegistration.findOne({
        event: event._id,
        user: req.user._id,
      });

      if (registration?.paymentStatus === "paid") {
        throw registrationError(
          409,
          "You are already registered for this event.",
        );
      }

      const previousSessionId = registration?.stripeSessionId;

      if (!registration) {
        registration = await EventRegistration.create({
          ...registrationData,
          paymentStatus: "pending",
        });
      } else {
        Object.assign(registration, registrationData);
        registration.paymentStatus = "pending";
        await registration.save();
      }

      // Create a new Stripe checkout session for the registration
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        managed_payments: {
          enabled: false,
        },
        customer_email: normalizedEmail,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: event.title },
              unit_amount: Math.round(event.price * 100),
            },
            quantity: 1,
          },
        ],
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: {
          registrationId: registration._id.toString(),
        },
        success_url:
          `${process.env.CLIENT_URL}/payment/success` +
          `?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:
          `${process.env.CLIENT_URL}/payment/failed` +
          `?eventId=${event._id}&session_id={CHECKOUT_SESSION_ID}`,
      });

      registration.stripeSessionId = session.id;
      await registration.save();

      if (previousSessionId) {
        const old = await stripe.checkout.sessions
          .retrieve(previousSessionId)
          .catch(() => null);
        if (old?.status === "open") {
          await stripe.checkout.sessions
            .expire(previousSessionId)
            .catch(() => {});
        }
      }

      return res.status(200).json({
        success: true,
        data: { checkoutUrl: session.url },
      });
    }

    // For free events,
    // we can directly add the user to the attendees list and
    // create a registration with a voucher.
    updatedEvent = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        date: { $gt: new Date() },
        attendees: { $ne: req.user._id },
        $or: [
          { registrationLimit: null },
          { $expr: { $lt: [{ $size: "$attendees" }, "$registrationLimit"] } },
        ],
      },
      { $addToSet: { attendees: req.user._id } },
      { new: true },
    );

    if (!updatedEvent) {
      const latest = await Event.findById(req.params.id).select(
        "attendees date",
      );

      if (latest?.attendees.some((id) => id.equals(req.user._id))) {
        throw registrationError(
          409,
          "You are already registered for this event.",
        );
      }
      if (latest && latest.date <= new Date()) {
        throw registrationError(
          409,
          "Registration is closed because this event has already started.",
        );
      }
      throw registrationError(409, "Registration is full.");
    }

    const { registration, voucherCode } =
      await createRegistrationWithVoucher(registrationData);
    let emailSent = true;

    try {
      await sendEventRegistrationConfirmationEmail({
        to: registration.email,
        fullName: registration.fullName,
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        voucherCode: voucherCode,
      });
    } catch (emailError) {
      emailSent = false;
      console.error(
        `Registration ${registration._id} was saved, but its confirmation email could not be sent:`,
        emailError,
      );
    }

    return res.status(201).json({
      success: true,
      data: {
        registrationId: registration._id,
        eventId: updatedEvent._id,
        attendeeCount: updatedEvent.attendees.length,
        registrationLimit: updatedEvent.registrationLimit,
        emailSent,
      },
      message: emailSent
        ? "Registration successful. A confirmation email has been sent."
        : "Registration successful, but the confirmation email could not be sent. Please contact the event organizer.",
    });
  } catch (error) {
    if (updatedEvent) {
      await Event.updateOne(
        { _id: updatedEvent._id },
        { $pull: { attendees: req.user._id } },
      ).catch((rollbackError) =>
        console.error(
          `Could not roll back attendee ${req.user._id} from event ${updatedEvent._id}:`,
          rollbackError,
        ),
      );
    }

    if (
      error.code === 11000 &&
      error.keyPattern?.event &&
      error.keyPattern?.user
    ) {
      return res.status(409).json({
        success: false,
        message: "You are already registered for this event.",
      });
    }

    return next(error);
  }
};

const assignVoucherToRegistration = async (registration) => {
  for (let attempt = 0; attempt < MAX_VOUCHER_ATTEMPTS; attempt += 1) {
    const voucherCode = generateVoucherCode();

    try {
      registration.voucherHash = hashVoucherCode(voucherCode);
      registration.paymentStatus = "paid";
      await registration.save();

      return voucherCode;
    } catch (error) {
      if (!isVoucherCodeCollision(error)) throw error;
    }
  }

  throw new Error("Could not generate a unique registration voucher.");
};

const stripeWebhook = async (req, res) => {
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    if (session.payment_status !== "paid") return res.json({ received: true });

    const registration = await EventRegistration.findById(
      session.metadata.registrationId,
    );

    // Idempotency: Stripe may retry
    if (
      !registration ||
      registration.paymentStatus === "paid" ||
      registration.paymentStatus === "failed"
    ) {
      return res.json({ received: true });
    }

    const event = await Event.findOneAndUpdate(
      {
        _id: registration.event,
        $or: [
          { registrationLimit: null },
          { $expr: { $lt: [{ $size: "$attendees" }, "$registrationLimit"] } },
        ],
      },
      { $addToSet: { attendees: registration.user } },
      { new: true },
    );

    // If the registration limit has been reached during the payment process,
    // due to concurrent registrations,
    // we need to refund the payment and mark the registration as failed.
    if (!event) {
      try {
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (!paymentIntentId) {
          throw new Error(
            `No payment intent found for Checkout session ${session.id}`,
          );
        }

        const refund = await stripe.refunds.create(
          { payment_intent: paymentIntentId },
          { idempotencyKey: `event-full-refund-${session.id}` },
        );

        registration.paymentStatus = "failed";
        await registration.save();

        console.info(
          `Could not complete registration ${registration._id}; refund ${refund.id} status: ${refund.status}`,
        );
      } catch (error) {
        console.error(
          `Could not refund payment for registration ${registration._id}:`,
          error,
        );

        return res.status(500).json({ received: false });
      }

      return res.json({ received: true });
    }

    const voucherCode = await assignVoucherToRegistration(registration);

    await sendEventRegistrationConfirmationEmail({
      to: registration.email,
      fullName: registration.fullName,
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      voucherCode,
    }).catch(console.error);
  }

  if (stripeEvent.type === "checkout.session.expired") {
    const session = stripeEvent.data.object;
    await EventRegistration.deleteOne({
      _id: session.metadata.registrationId,
      paymentStatus: "pending",
      stripeSessionId: session.id,
    });
  }

  res.json({ received: true });
};

const getPaymentStatus = async (req, res, next) => {
  try {
    const { session_id: sessionId } = req.query;
    if (typeof sessionId !== "string" || !sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "session_id is required." });
    }

    const registration = await EventRegistration.findOne({
      stripeSessionId: sessionId,
      user: req.user._id,
    });

    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
    }

    const event = await Event.findById(registration.event).select(
      "title date location",
    );

    return res.status(200).json({
      success: true,
      data: {
        paymentStatus: registration.paymentStatus,
        email: registration.email,
        eventId: registration.event,
        eventTitle: event?.title,
        eventDate: event?.date,
        eventLocation: event?.location,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const cancelPendingRegistration = async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (typeof sessionId !== "string" || !sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "sessionId is required." });
    }

    const registration = await EventRegistration.findOne({
      stripeSessionId: sessionId,
      user: req.user._id,
    });

    // Nothing to delete, or it was already paid: leave it alone
    if (!registration || registration.paymentStatus !== "pending") {
      return res.status(200).json({ success: true, data: { deleted: false } });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      return res.status(200).json({ success: true, data: { deleted: false } });
    }

    // Close the Stripe session so it can't be paid after we delete the record
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(sessionId).catch(() => {});
    }

    await EventRegistration.deleteOne({
      _id: registration._id,
      paymentStatus: "pending",
    });

    return res.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerForEvent,
  stripeWebhook,
  getPaymentStatus,
  cancelPendingRegistration,
};
