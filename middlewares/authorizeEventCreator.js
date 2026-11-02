const mongoose = require("mongoose");
const Event = require("../models/eventModel");

const authorizeEventCreator = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(id).select("+documents.publicId");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "No such event found",
      });
    }

    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the event creator can manage its documents",
      });
    }

    req.event = event;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authorizeEventCreator;
