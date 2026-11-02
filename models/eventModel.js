const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"] },
    date: { type: Date, required: [true, "Date is required"] },
    mode: {
      type: String,
      enum: ["online", "offline"],
      required: [true, "Type is required"],
    },
    category: {
      type: String,
      enum: [
        "academic",
        "social",
        "sports",
        "career",
        "workshop",
        "technology",
        "music & arts",
        "fashion",
        "entertainment",
        "other",
      ],
      default: "other",
    },
    location: { type: String },
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
            Number.isFinite(coordinates[1]) &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90,
          message: "Coordinates must be [longitude, latitude].",
        },
      },
    },
    description: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      select: false,
    },
    dislikedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      select: false,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    }, // null = public/global event
    imageUrl: {
      type: String,
      default: "",
    },
    imagePublicId: {
      type: String,
      default: "",
    },
    documents: [
      {
        name: { type: String, required: true },
        publicId: { type: String, required: true, select: false },
        format: { type: String, enum: ["pdf"], default: "pdf" },
        bytes: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    registrationLimit: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: (value) => value === null || Number.isInteger(value),
        message: "Registration limit must be a whole number",
      },
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
      default: 0,
    },
  },
  { timestamps: true },
);

eventSchema.index({ geoLocation: "2dsphere" });

module.exports = mongoose.model("Event", eventSchema);
