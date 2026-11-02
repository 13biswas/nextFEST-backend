const mongoose = require("mongoose");
const Group = require("../models/groupModel");
const Event = require("../models/eventModel");
const GroupJoinRequest = require("../models/groupJoinRequestModel");
const EventRegistration = require("../models/eventRegistrationModel");
const cloudinary = require("../utils/cloudinary");
const { isAnAdminOrOwner } = require("./membershipController");

const uploadToCloudinary = (file, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.end(file.buffer);
  });

const getLegacyCloudinaryPublicId = (imageUrl, expectedFolder) => {
  try {
    const { pathname } = new URL(imageUrl);
    const escapedFolder = expectedFolder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = pathname.match(
      new RegExp(`/upload/(?:v\\d+/)?(${escapedFolder}/.+)$`),
    );

    if (!match) {
      return null;
    }

    return match[1].replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
};

const createGroup = async (req, res, next) => {
  try {
    const { name, description, isPrivate } = req.body;

    if (!name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a group name.",
      });
    }

    if (!description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a group description.",
      });
    }

    if (
      isPrivate !== "true" &&
      isPrivate !== "false" &&
      isPrivate !== true &&
      isPrivate !== false
    ) {
      return res.status(400).json({
        success: false,
        message: "Please specify whether the group is private.",
      });
    }

    const logoFile = req.files?.logo?.[0];
    const backgroundFile = req.files?.backgroundImage?.[0];

    const [logo, background] = await Promise.all([
      logoFile
        ? uploadToCloudinary(logoFile, "campus-connect/group-logos")
        : null,
      backgroundFile
        ? uploadToCloudinary(backgroundFile, "campus-connect/group-backgrounds")
        : null,
    ]);

    const group = await Group.create({
      name: req.body.name,
      description: req.body.description,
      isPrivate: req.body.isPrivate === "true",
      logoUrl: logo?.secure_url || "",
      logoPublicId: logo?.public_id || "",
      backgroundImageUrl: background?.secure_url || "",
      backgroundImagePublicId: background?.public_id || "",
      owner: req.user._id,
      members: [{ user: req.user._id, role: "admin" }],
    });

    res.status(201).json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
};

const getGroups = async (req, res, next) => {
  try {
    const pageNumber = Math.max(Number(req.query.pageNumber) || 1, 1);
    const resultLimit = Math.min(
      Math.max(Number(req.query.resultLimit) || 10, 1),
      50,
    );
    const search = (req.query.search || "").trim();
    const skipResBeforeCurrPage = (pageNumber - 1) * resultLimit;

    const filters = {};

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filters.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const [groups, totalResults] = await Promise.all([
      Group.find(filters)
        .sort({ name: 1 })
        .skip(skipResBeforeCurrPage)
        .limit(resultLimit),
      Group.countDocuments(filters),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalResults / resultLimit));
    const hasPrev = pageNumber > 1;
    const hasNext = pageNumber < totalPages;

    res.status(200).json({
      success: true,
      data: groups,
      pagination: {
        page: pageNumber,
        limit: resultLimit,
        totalPages,
        totalResults,
        hasPrev,
        hasNext,
        prevPage: hasPrev ? page - 1 : null,
        nextPage: hasNext ? page + 1 : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members.user", "name")
      .populate("owner", "name");

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "No such group found" });
    }

    const filters = { group: req.params.id };

    const pageNumber = Math.max(Number(req.query.page) || 1, 1);
    const resultLimit = Math.min(Number(req.query.limit) || 10, 50);
    const skipResBeforeCurrPage = (pageNumber - 1) * resultLimit;

    const [groupEvents, totalResults] = await Promise.all([
      Event.find(filters)
        .populate("createdBy", "name email profileImage")
        .populate("group", "name isPrivate")
        .sort({ date: 1 })
        .skip(skipResBeforeCurrPage)
        .limit(resultLimit),
      Event.countDocuments(filters),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalResults / resultLimit));
    const hasPrev = pageNumber > 1;
    const hasNext = pageNumber < totalPages;

    res.status(200).json({
      success: true,
      groupData: group,
      groupEventsData: groupEvents,
      pagination: {
        page: pageNumber,
        limit: resultLimit,
        totalPages,
        totalResults,
        hasPrev,
        hasNext,
        prevPage: hasPrev ? pageNumber - 1 : null,
        nextPage: hasNext ? pageNumber + 1 : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyGroups = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [createdGroups, isAdminOfGroups, memberOfGroups] = await Promise.all([
      Group.find({ owner: userId }),

      Group.find({
        members: {
          $elemMatch: { user: userId, role: "admin" },
        },
        owner: { $ne: userId },
      }),

      Group.find({
        members: {
          $elemMatch: { user: userId, role: "member" },
        },
        owner: { $ne: userId },
      }),
    ]);

    res.json({
      success: true,
      data: {
        created: createdGroups,
        isAdminOf: isAdminOfGroups,
        memberOf: memberOfGroups,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateGroup = async (req, res, next) => {
  try {
    const allowedUpdates = ["name", "description", "isPrivate"];
    const updates = {};

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "No such group found" });
    }

    if (!isAnAdminOrOwner(group, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required for this action.",
      });
    }

    if (req.files?.logo?.[0]) {
      const logo = await uploadToCloudinary(
        req.files.logo[0],
        "campus-connect/group-logos",
      );
      updates.logoUrl = logo.secure_url;
      updates.logoPublicId = logo.public_id;
    }

    if (req.files?.backgroundImage?.[0]) {
      const background = await uploadToCloudinary(
        req.files.backgroundImage[0],
        "campus-connect/group-backgrounds",
      );
      updates.backgroundImageUrl = background.secure_url;
      updates.backgroundImagePublicId = background.public_id;
    }

    Object.assign(group, updates);
    await group.save();

    res.status(200).json({
      success: true,
      data: group,
      message: "Group updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

const deleteGroup = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group id",
      });
    }

    const group = await Group.findById(req.params.id).select(
      "+documents.publicId",
    );

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

    const events = await Event.find({ group: group._id }).select(
      "+documents.publicId",
    );

    const cloudinaryAssets = [];

    const addImage = (publicId, imageUrl, folder) => {
      if (publicId) {
        cloudinaryAssets.push({
          publicId,
          resourceType: "image",
        });
        return;
      }

      if (imageUrl) {
        cloudinaryAssets.push({
          publicId: getLegacyCloudinaryPublicId(imageUrl, folder),
          resourceType: "image",
        });
      }
    };

    addImage(group.logoPublicId, group.logoUrl, "campus-connect/group-logos");
    addImage(
      group.backgroundImagePublicId,
      group.backgroundImageUrl,
      "campus-connect/group-backgrounds",
    );

    for (const document of group.documents) {
      cloudinaryAssets.push({
        publicId: document.publicId,
        resourceType: "raw",
      });
    }

    for (const event of events) {
      addImage(
        event.imagePublicId,
        event.imageUrl,
        "campus-connect/event-images",
      );

      for (const document of event.documents) {
        cloudinaryAssets.push({
          publicId: document.publicId,
          resourceType: "raw",
        });
      }
    }

    const uniqueAssets = [
      ...new Map(
        cloudinaryAssets.map((asset) => [
          `${asset.resourceType}:${asset.publicId}`,
          asset,
        ]),
      ).values(),
    ];

    const cleanupResults = await Promise.allSettled(
      uniqueAssets.map((asset) =>
        cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: "upload",
        }),
      ),
    );

    const cleanupErrors = cleanupResults.flatMap((result, index) => {
      const asset = uniqueAssets[index];

      if (result.status === "rejected") {
        return [
          `Could not delete Cloudinary asset ${asset.publicId}: ${result.reason.message}`,
        ];
      }

      if (!["ok", "not found"].includes(result.value?.result)) {
        return [`Cloudinary did not delete asset ${asset.publicId}`];
      }

      return [];
    });

    if (cleanupErrors.length > 0) {
      throw new Error(cleanupErrors.join("; "));
    }

    const eventIds = events.map((event) => event._id);

    await Promise.all([
      GroupJoinRequest.deleteMany({ group: group._id }),
      EventRegistration.deleteMany({ event: { $in: eventIds } }),
    ]);

    const eventDeletion = await Event.deleteMany({ group: group._id });

    if (eventDeletion.deletedCount !== events.length) {
      throw new Error("Not all group events were deleted");
    }

    const groupDeletion = await Group.deleteOne({ _id: group._id });

    if (groupDeletion.deletedCount !== 1) {
      throw new Error("Group was not deleted");
    }

    return res.status(200).json({
      success: true,
      message:
        "Group and all related join requests, events, registrations, attendees, images, and documents deleted",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  getMyGroups,
  updateGroup,
  deleteGroup,
};
