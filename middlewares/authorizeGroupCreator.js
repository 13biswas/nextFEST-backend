const mongoose = require("mongoose");
const Group = require("../models/groupModel");
const { isAnAdminOrOwner } = require("../controllers/membershipController");

const authorizeGroupCreator = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(id).select("+documents.publicId");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "No such group found",
      });
    }

    if (!isAnAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required for this action.",
      });
    }

    req.group = group;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authorizeGroupCreator;
