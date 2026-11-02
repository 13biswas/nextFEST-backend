const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["member", "admin"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [memberSchema],
    isPrivate: { type: Boolean, default: false }, // private groups require invite/approval
    logoUrl: { type: String, default: "" },
    logoPublicId: { type: String, default: "" },
    backgroundImageUrl: { type: String, default: "" },
    backgroundImagePublicId: { type: String, default: "" },
    documents: [
      {
        name: { type: String, required: true },
        publicId: { type: String, required: true, select: false },
        format: { type: String, enum: ["pdf"], default: "pdf" },
        bytes: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Group", groupSchema);
