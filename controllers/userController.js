const User = require("../models/userModel");
const Event = require("../models/eventModel");
const cloudinary = require("../utils/cloudinary");
const mongoose = require("mongoose");

const uploadToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-connect/profile-images",
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.end(file.buffer);
  });

const uploadMyProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile image is required",
      });
    }

    const uploadedImage = await uploadToCloudinary(req.file);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: uploadedImage.secure_url },
      { new: true },
    ).select(`${publicUserFields} +password`);

    res.json({
      success: true,
      updatedUserData: serializeCurrentUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const serializeCurrentUser = (user) => {
  const userData = user.toObject();
  delete userData.password;

  return {
    ...userData,
    hasPassword: Boolean(user.password),
  };
};

const publicUserFields =
  "name email isEmailVerified profileImage major yearOfStudy interests campus socialLinks";

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      `${publicUserFields} +password`,
    );

    res.json({
      success: true,
      userData: serializeCurrentUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const allowedFields = [
      "name",
      "profileImage",
      "major",
      "yearOfStudy",
      "interests",
      "campus",
      "socialLinks",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select(`${publicUserFields} +password`);

    res.json({
      success: true,
      updatedUserData: serializeCurrentUser(user),
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select(
      publicUserFields,
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const getMyBookmarks = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "bookmarks",
      select:
        "title date mode category location description imageUrl price group",
      populate: {
        path: "group",
        select: "name isPrivate",
      },
    });

    res.json({
      success: true,
      data: user.bookmarks.filter(Boolean).reverse(),
    });
  } catch (error) {
    next(error);
  }
};

const addMyBookmark = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId).select("_id");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { bookmarks: event._id },
    });

    res.status(200).json({
      success: true,
      message: "Event bookmarked",
    });
  } catch (error) {
    next(error);
  }
};

const removeMyBookmark = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { bookmarks: eventId },
    });

    res.json({
      success: true,
      message: "Bookmark removed",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadMyProfileImage,
  getUserProfile,
  getMyBookmarks,
  addMyBookmark,
  removeMyBookmark,
};
