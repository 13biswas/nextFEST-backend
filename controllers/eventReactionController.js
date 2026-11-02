const mongoose = require("mongoose");
const Event = require("../models/eventModel");

const getMyEventReaction = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id",
      });
    }

    const event = await Event.findById(req.params.id).select(
      "+likedBy +dislikedBy",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const userId = req.user._id;

    let reaction;

    if (event.likedBy.some((id) => id.equals(userId))) {
      reaction = "like";
    } else if (event.dislikedBy.some((id) => id.equals(userId))) {
      reaction = "dislike";
    } else {
      reaction = "none";
    }

    res.json({ success: true, data: { reaction } });
  } catch (error) {
    next(error);
  }
};

const setEventReaction = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id",
      });
    }

    const { reaction } = req.body;

    if (!["like", "dislike", "none"].includes(reaction)) {
      return res.status(400).json({
        success: false,
        message: "Reaction must be like, dislike, or none",
      });
    }

    const event = await Event.findById(req.params.id).select(
      "+likedBy +dislikedBy",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const userId = req.user._id;

    event.likedBy = event.likedBy.filter((id) => !id.equals(userId));
    event.dislikedBy = event.dislikedBy.filter((id) => !id.equals(userId));

    if (reaction === "like") event.likedBy.push(userId);
    if (reaction === "dislike") event.dislikedBy.push(userId);

    await event.save();

    res.json({
      success: true,
      data: {
        reaction,
        likeCount: event.likedBy.length,
        dislikeCount: event.dislikedBy.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyEventReaction,
  setEventReaction,
};
