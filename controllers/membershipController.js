const GroupJoinRequest = require("../models/groupJoinRequestModel");
const Group = require("../models/groupModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");

const isAMember = (group, userId) => {
  return group.members.some(
    (member) => member.user.toString() === userId.toString(),
  );
};

const isAnAdminOrOwner = (group, userId) => {
  return (
    group.owner.toString() === userId.toString() ||
    group.members.some(
      (member) =>
        member.user.toString() === userId.toString() && member.role === "admin",
    )
  );
};

const getMyGroupMembership = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group id",
      });
    }

    const group = await Group.findById(req.params.groupId).select("members");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        isMember: isAMember(group, req.user._id),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const joinGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    if (isAMember(group, req.user._id)) {
      return res.status(409).json({
        success: false,
        message: "Already a group member",
      });
    }

    if (!group.isPrivate) {
      group.members.push({
        user: req.user._id,
        role: "member",
      });

      await group.save();

      return res.status(200).json({
        success: true,
        data: group,
        message: "Group joined successfully",
      });
    }

    const existingRequest = await GroupJoinRequest.findOne({
      group: group._id,
      user: req.user._id,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "Join request already pending",
      });
    }

    const request = await GroupJoinRequest.create({
      group: group._id,
      user: req.user._id,
    });

    return res.status(201).json({
      success: true,
      data: request,
      message: "Join request submitted",
    });
  } catch (error) {
    next(error);
  }
};

const leaveGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    if (group.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "The owner cannot leave the group",
      });
    }

    group.members = group.members.filter(
      (member) => member.user.toString() != req.user._id.toString(),
    );

    await group.save();
    await GroupJoinRequest.findOneAndDelete({
      group: req.params.groupId,
      user: req.user._id,
    });

    res.status(200).json({
      success: true,
      data: group.members,
      message: "Group left successfully",
    });
  } catch (error) {
    next(error);
  }
};

const inviteMember = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    if (!isAnAdminOrOwner(group, req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const userToBeInvited = await User.findById(req.body.userId);

    if (!userToBeInvited) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!isAMember(group, userToBeInvited._id)) {
      group.members.push({ user: userToBeInvited._id, role: "member" });
      await group.save();
    }

    res.status(200).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

const promoteMember = async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.groupId) ||
      !mongoose.isValidObjectId(req.params.userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid group or user id",
      });
    }

    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!isAnAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required for this action",
      });
    }

    if (req.user._id.toString() === req.params.userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    if (group.owner.toString() === req.params.userId) {
      return res.status(400).json({
        success: false,
        message: "The group owner’s role cannot be changed",
      });
    }

    const member = group.members.find(
      (item) => item.user.toString() === req.params.userId,
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (member.role !== "member") {
      return res.status(409).json({
        success: false,
        message: "Only members can be promoted",
      });
    }

    member.role = "admin";
    await group.save();

    return res.status(200).json({
      success: true,
      data: group,
      message: "Member promoted to admin",
    });
  } catch (error) {
    return next(error);
  }
};

const demoteMember = async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.groupId) ||
      !mongoose.isValidObjectId(req.params.userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid group or user id",
      });
    }

    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!isAnAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required for this action",
      });
    }

    if (req.user._id.toString() === req.params.userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    if (group.owner.toString() === req.params.userId) {
      return res.status(400).json({
        success: false,
        message: "The group owner’s role cannot be changed",
      });
    }

    const member = group.members.find(
      (item) => item.user.toString() === req.params.userId,
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (member.role !== "admin") {
      return res.status(409).json({
        success: false,
        message: "Only admins can be demoted",
      });
    }

    member.role = "member";
    await group.save();

    return res.status(200).json({
      success: true,
      data: group,
      message: "Admin demoted to member",
    });
  } catch (error) {
    return next(error);
  }
};

const joinRequests = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!isAnAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required for this action",
      });
    }

    const joinReqs = await GroupJoinRequest.find({
      group: group._id,
      status: "pending",
    }).populate("user", "name email");

    res.status(200).json({ success: true, data: joinReqs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const myJoinRequest = async (req, res, next) => {
  try {
    const joinReqs = await GroupJoinRequest.find({
      user: req.user._id,
      group: req.params.groupId,
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: joinReqs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardJoinRequestPreviews = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const adminGroups = await Group.find({
      $or: [
        { owner: userId },
        {
          members: {
            $elemMatch: { user: userId, role: "admin" },
          },
        },
      ],
    }).select("_id");

    const adminGroupIds = adminGroups.map((group) => group._id);

    const [sent, received] = await Promise.all([
      GroupJoinRequest.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("group", "name"),

      adminGroupIds.length
        ? GroupJoinRequest.find({
            group: { $in: adminGroupIds },
            status: "pending",
          })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate("group", "name")
            .populate("user", "name email")
        : [],
    ]);

    res.json({
      success: true,
      data: { sent, received },
    });
  } catch (error) {
    next(error);
  }
};

const reviewJoinRequest = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    if (!isAnAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required for this action",
      });
    }

    const request = await GroupJoinRequest.findOne({
      _id: req.params.requestId,
      group: group._id,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Pending join request not found",
      });
    }

    if (status === "approved" && !isAMember(group, request.user)) {
      group.members.push({
        user: request.user,
        role: "member",
      });

      await group.save();
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    res.json({
      success: true,
      data: request,
      message: `Join request ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  isAMember,
  isAnAdminOrOwner,
  getMyGroupMembership,
  getDashboardJoinRequestPreviews,
  inviteMember,
  joinGroup,
  leaveGroup,
  promoteMember,
  demoteMember,
  joinRequests,
  myJoinRequest,
  reviewJoinRequest,
};
