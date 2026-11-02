const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 24,
    },
    gender: {
      type: String,
      required: true,
      enum: [
        "female",
        "male",
        "non-binary",
        "self-describe",
        "prefer-not-to-say",
      ],
    },
    genderSelfDescription: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    geoLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (coordinates) =>
            coordinates.length === 2 &&
            Number.isFinite(coordinates[0]) &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            Number.isFinite(coordinates[1]) &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90,
          message: "Coordinates must be [longitude, latitude].",
        },
      },
    },
    campusName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    major: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    yearOfStudy: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    termsAccepted: {
      type: Boolean,
      required: true,
      validate: {
        validator: (value) => value === true,
        message: "You must accept the terms and conditions.",
      },
    },
    termsVersion: {
      type: String,
      required: true,
    },
    termsAcceptedAt: {
      type: Date,
      required: true,
    },
    voucherHash: {
      type: String,
      select: false,
      match: /^[a-f0-9]{64}$/,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "paid",
    },
    stripeSessionId: {
      type: String,
      default: null,
      index: true,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });
eventRegistrationSchema.index(
  { voucherHash: 1 },
  { unique: true, sparse: true },
);

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
