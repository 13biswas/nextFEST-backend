const mongoose = require("mongoose");
const cloudinary = require("../utils/cloudinary");
const Event = require("../models/eventModel");
const Group = require("../models/groupModel");
const EventRegistration = require("../models/eventRegistrationModel");
const { isAnAdminOrOwner } = require("./membershipController");
const {
  uploadToCloudinary,
  parseRegistrationLimit,
  parseEventGeoLocation,
  parseEventPrice,
  getLegacyEventImagePublicId,
} = require("../utils/eventUtils");
const { registerForEvent } = require("./eventRegistrationController");
const {
  getMyEventReaction,
  setEventReaction,
} = require("./eventReactionController");

const createEvent = async (req, res, next) => {
  try {
    const { title, date, mode, category, location, description, group } =
      req.body;

    if (!title || !mode || !location || !description) {
      return res.status(400).json({
        success: false,
        message: "Title, mode, location and description are required fields.",
      });
    }

    const locationResult = parseEventGeoLocation(req.body.geoLocation);

    if (locationResult.error) {
      return res.status(400).json({
        success: false,
        message: locationResult.error,
      });
    }

    const eventDate =
      typeof date === "string" && date.trim() ? new Date(date) : null;

    if (!eventDate || Number.isNaN(eventDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid event date and time.",
      });
    }

    if (eventDate.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "The event start date must be in the future.",
      });
    }

    const limitResult = parseRegistrationLimit(req.body.registrationLimit);

    if (limitResult.error) {
      return res
        .status(400)
        .json({ success: false, message: limitResult.error });
    }

    const priceResult = parseEventPrice(req.body.price);

    if (priceResult.error) {
      return res.status(400).json({
        success: false,
        message: priceResult.error,
      });
    }

    let groupId = null;

    if (group) {
      const groupRecord = await Group.findById(group);

      if (!groupRecord) {
        return res.status(404).json({
          success: false,
          message: "Group not found",
        });
      }

      if (!isAnAdminOrOwner(groupRecord, req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "Only group admins can create group events",
        });
      }

      groupId = groupRecord._id;
    }

    const imageAsset = req.file ? await uploadToCloudinary(req.file) : null;

    const newEvent = new Event({
      title,
      date: eventDate,
      mode,
      category,
      location,
      geoLocation: locationResult.geoLocation || undefined,
      description,
      imageUrl: imageAsset?.secure_url || "",
      imagePublicId: imageAsset?.public_id || "",
      group: groupId,
      createdBy: req.user._id,
      registrationLimit: limitResult.value,
      price: priceResult.value,
    });

    await newEvent.save();

    res.status(201).json({
      success: true,
      data: newEvent,
      message: "Event created successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getEvents = async (req, res) => {
  try {
    const filters = {};

    if (req.query.category) {
      filters.category = req.query.category;
    }

    if (req.query.mode) {
      filters.mode = req.query.mode;
    }

    if (req.query.group) {
      filters.group = req.query.group;
    }

    if (req.query.location) {
      // escape user input for regex to avoid accidental special chars / ReDoS
      const escaped = req.query.location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filters.location = { $regex: escaped, $options: "i" };
    }

    if (req.query.date) {
      const startDate = new Date(`${req.query.date}T00:00:00.000Z`);
      const endDate = new Date(`${req.query.date}T23:59:59.999Z`);

      filters.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const pageNumber = Math.max(Number(req.query.page) || 1, 1);
    const resultLimit = Math.min(Number(req.query.limit) || 10, 50);
    const skipResBeforeCurrPage = (pageNumber - 1) * resultLimit;

    const { nearLat, nearLon, radiusKm } = req.query;

    const nearbyParamsProvided =
      nearLat !== undefined || nearLon !== undefined || radiusKm !== undefined;

    if (nearbyParamsProvided) {
      const latitude = Number(nearLat);
      const longitude = Number(nearLon);
      const radius = Number(radiusKm);

      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180 ||
        !Number.isFinite(radius) ||
        radius < 1 ||
        radius > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid location and radius from 1 to 100 km are required.",
        });
      }

      filters.geoLocation = {
        $geoWithin: {
          $centerSphere: [[longitude, latitude], radius / 6378.1],
        },
      };
    }

    const [events, totalResults] = await Promise.all([
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

    res.json({
      success: true,
      data: events,
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

const getEvent = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id",
      });
    }

    const event = await Event.findById(req.params.id)
      .select("+likedBy +dislikedBy")
      .populate("createdBy", "name profileImage")
      .populate(
        "group",
        "name description isPrivate logoUrl backgroundImageUrl documents",
      )
      .populate("attendees", "_id");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "No such event found",
      });
    }

    const data = event.toObject();
    data.likeCount = event.likedBy.length;
    data.dislikeCount = event.dislikedBy.length;
    delete data.likedBy;
    delete data.dislikedBy;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getRelatedEvents = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id",
      });
    }

    const event = await Event.findById(req.params.id).select("category group");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "No such event found",
      });
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const relatedConditions = [{ category: event.category }];

    if (event.group) {
      relatedConditions.push({ group: event.group });
    }

    const events = await Event.find({
      _id: { $ne: event._id },
      date: { $gte: now, $lte: sevenDaysFromNow },
      $or: relatedConditions,
    })
      .populate("createdBy", "name profileImage")
      .populate("group", "name isPrivate logoUrl")
      .sort({ date: 1 })
      .limit(7);

    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};

const getRecommendedEvents = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();

    // Escape user-provided text before using it in regular expressions.
    const interests = (user.interests ?? [])
      .map((interest) => String(interest).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 15);

    const interestConditions = interests.flatMap((interest) => {
      const pattern = new RegExp(
        interest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );

      return [
        { title: pattern },
        { category: pattern },
        { description: pattern },
      ];
    });

    const eventFilter = {
      date: { $gt: now },
      createdBy: { $ne: user._id },
      attendees: { $ne: user._id },
    };

    const [interestEvents, popularEvents] = await Promise.all([
      interestConditions.length
        ? Event.find({
            ...eventFilter,
            $or: interestConditions,
          })
            .select(
              "title date mode category location description imageUrl price group",
            )
            .select("+likedBy")
            .populate("group", "name isPrivate")
            .sort({ date: 1 })
            .limit(20)
            .lean()
        : [],

      Event.aggregate([
        { $match: eventFilter },
        {
          $addFields: {
            likesCount: { $size: { $ifNull: ["$likedBy", []] } },
          },
        },
        { $match: { likesCount: { $gt: 0 } } },
        { $sort: { likesCount: -1, date: 1 } },
        { $limit: 20 },
        {
          $project: {
            title: 1,
            date: 1,
            mode: 1,
            category: 1,
            location: 1,
            description: 1,
            imageUrl: 1,
            price: 1,
            group: 1,
            likesCount: 1,
          },
        },
      ]),
    ]);

    await Event.populate(popularEvents, {
      path: "group",
      select: "name isPrivate",
    });

    const recommendationsById = new Map();

    for (const event of interestEvents) {
      const { likedBy = [], ...eventData } = event;

      recommendationsById.set(event._id.toString(), {
        ...eventData,
        likesCount: likedBy.length,
        recommendationReason: "Matches your interests",
      });
    }

    for (const event of popularEvents) {
      const eventId = event._id.toString();

      if (!recommendationsById.has(eventId)) {
        recommendationsById.set(eventId, {
          ...event,
          recommendationReason: "Popular with students",
        });
      }
    }

    res.json({
      success: true,
      data: [...recommendationsById.values()],
    });
  } catch (error) {
    next(error);
  }
};

const getMyEvents = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [createdEvents, registeredEvents] = await Promise.all([
      Event.find({ createdBy: userId })
        .populate("createdBy", "name email profileImage")
        .populate("group", "name isPrivate")
        .sort({ date: 1 }),

      Event.find({ attendees: userId })
        .populate("createdBy", "name email profileImage")
        .populate("group", "name isPrivate")
        .sort({ date: 1 }),
    ]);

    res.json({
      success: true,
      data: {
        created: createdEvents,
        registered: registeredEvents,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "No such event found" });
    }

    if (event.date.getTime() <= Date.now()) {
      return res.status(409).json({
        success: false,
        message: "Events cannot be edited after they have started",
      });
    }

    const newDate = new Date(req.body.date ?? event.date);

    if (Number.isNaN(newDate.getTime()) || newDate.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "The event start date must be in the future",
      });
    }

    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this event",
      });
    }

    const updates = {
      title: req.body.title,
      date: req.body.date,
      mode: req.body.mode,
      category: req.body.category,
      location: req.body.location,
      description: req.body.description,
      group: req.body.group || null, // to be checked
    };

    const hasRegistrationLimit = Object.prototype.hasOwnProperty.call(
      req.body,
      "registrationLimit",
    );

    if (hasRegistrationLimit) {
      const limitResult = parseRegistrationLimit(req.body.registrationLimit);

      if (limitResult.error) {
        return res
          .status(400)
          .json({ success: false, message: limitResult.error });
      }

      if (
        limitResult.value !== null &&
        limitResult.value < event.attendees.length
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Registration limit cannot be lower than current no of attendees",
        });
      }

      updates.registrationLimit = limitResult.value;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "price")) {
      const priceResult = parseEventPrice(req.body.price);

      if (priceResult.error) {
        return res.status(400).json({
          success: false,
          message: priceResult.error,
        });
      }

      updates.price = priceResult.value;
    }

    if (req.file) {
      const uploadedImage = await uploadToCloudinary(req.file);
      updates.imageUrl = uploadedImage.secure_url;
      updates.imagePublicId = uploadedImage.public_id;
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: updatedEvent,
      message: "Event updated successfully",
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const deleteEvent = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id",
      });
    }

    const event = await Event.findById(req.params.id).select(
      "+documents.publicId",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "No such event found",
      });
    }

    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this event",
      });
    }

    let imagePublicId = event.imagePublicId;

    if (!imagePublicId && event.imageUrl) {
      imagePublicId = getLegacyEventImagePublicId(event.imageUrl);

      if (!imagePublicId) {
        throw new Error(
          "Could not determine the Cloudinary ID for the event image",
        );
      }
    }

    const cloudinaryAssets = [];

    if (imagePublicId) {
      cloudinaryAssets.push({
        publicId: imagePublicId,
        resourceType: "image",
      });
    }

    for (const document of event.documents) {
      cloudinaryAssets.push({
        publicId: document.publicId,
        resourceType: "raw",
      });
    }

    const cleanupResults = await Promise.allSettled(
      cloudinaryAssets.map((asset) =>
        cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: "upload",
        }),
      ),
    );

    const cleanupErrors = cleanupResults.flatMap((result, index) => {
      if (result.status === "rejected") {
        return [
          `Could not delete Cloudinary asset ${cloudinaryAssets[index].publicId}: ${result.reason.message}`,
        ];
      }

      if (!["ok", "not found"].includes(result.value?.result)) {
        return [
          `Cloudinary did not delete asset ${cloudinaryAssets[index].publicId}`,
        ];
      }

      return [];
    });

    if (cleanupErrors.length > 0) {
      throw new Error(cleanupErrors.join("; "));
    }

    await EventRegistration.deleteMany({ event: event._id });

    const deletionResult = await Event.deleteOne({ _id: event._id });

    if (deletionResult.deletedCount !== 1) {
      throw new Error("Event was not deleted from the database");
    }

    return res.status(200).json({
      success: true,
      message: "Event with all registrations and files deleted",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEvent,
  getRelatedEvents,
  getRecommendedEvents,
  getMyEventReaction,
  setEventReaction,
  getMyEvents,
  registerForEvent,
  updateEvent,
  deleteEvent,
};
