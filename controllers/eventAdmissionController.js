const mongoose = require("mongoose");
const Event = require("../models/eventModel");
const Group = require("../models/groupModel");
const EventRegistration = require("../models/eventRegistrationModel");
const { isAnAdminOrOwner } = require("./membershipController");
const { hashVoucherCode } = require("../utils/voucherCode");

const registrationError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getManageableEvents = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const adminGroupIds = await Group.distinct("_id", {
      $or: [
        { owner: userId },
        {
          members: {
            $elemMatch: { user: userId, role: "admin" },
          },
        },
      ],
    });

    const [ownEvents, groupEvents] = await Promise.all([
      Event.find({ createdBy: userId, group: null })
        .populate("createdBy", "name")
        .sort({ date: 1 }),

      Event.find({
        group: { $ne: null },
        $or: [{ createdBy: userId }, { group: { $in: adminGroupIds } }],
      })
        .populate("createdBy", "name")
        .populate("group", "name")
        .sort({ date: 1 }),
    ]);

    return res.status(200).json({
      success: true,
      data: { ownEvents, groupEvents },
    });
  } catch (error) {
    return next(error);
  }
};

const checkInAttendee = async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const submittedCode = req.body?.voucherCode;

    if (!mongoose.isValidObjectId(eventId)) {
      throw registrationError(400, "Invalid event id.");
    }

    if (typeof submittedCode !== "string") {
      throw registrationError(400, "Enter the attendee's voucher code.");
    }

    const voucherCode = submittedCode
      .trim()
      .toUpperCase()
      .replace(/[\s-]/g, "");

    if (!/^[A-HJ-NP-Z2-9]{16}$/.test(voucherCode)) {
      throw registrationError(400, "Enter a valid 16-character voucher code.");
    }

    const event = await Event.findById(eventId).select("createdBy group");

    if (!event) {
      throw registrationError(404, "Event not found.");
    }

    const isEventCreator = event.createdBy.equals(req.user._id);
    let isGroupAdmin = false;

    if (event.group) {
      const group = await Group.findById(event.group);

      if (group) {
        isGroupAdmin = isAnAdminOrOwner(group, req.user._id);
      }
    }

    if (!isEventCreator && !isGroupAdmin) {
      throw registrationError(
        403,
        "Only the event creator or a group admin can admit attendees.",
      );
    }

    const voucherHash = hashVoucherCode(voucherCode);

    const registration = await EventRegistration.findOne({
      event: event._id,
      voucherHash,
    }).select("_id fullName campusName checkedInAt");

    if (!registration) {
      throw registrationError(
        404,
        "No registration for this event matches that voucher code.",
      );
    }

    const checkedInRegistration = await EventRegistration.findOneAndUpdate(
      {
        _id: registration._id,
        checkedInAt: null,
      },
      {
        $set: {
          checkedInAt: new Date(),
          checkedInBy: req.user._id,
        },
      },
      { new: true },
    ).select("_id fullName campusName checkedInAt");

    if (!checkedInRegistration) {
      throw registrationError(409, "This attendee has already been admitted.");
    }

    return res.status(200).json({
      success: true,
      message: `${checkedInRegistration.fullName} admitted successfully.`,
      data: {
        registrationId: checkedInRegistration._id,
        fullName: checkedInRegistration.fullName,
        campusName: checkedInRegistration.campusName,
        checkedInAt: checkedInRegistration.checkedInAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getManageableEvents,
  checkInAttendee,
};
