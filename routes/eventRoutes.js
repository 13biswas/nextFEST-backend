const express = require("express");
const {
  createEvent,
  getEvents,
  getEvent,
  getMyEvents,
  updateEvent,
  deleteEvent,
  registerForEvent,
  getRelatedEvents,
  getRecommendedEvents,
  getMyEventReaction,
  setEventReaction,
} = require("../controllers/eventController");
const {
  addEventDocuments,
  replaceEventDocument,
  deleteEventDocument,
  downloadEventDocument,
} = require("../controllers/eventDocumentController");
const {
  getManageableEvents,
  checkInAttendee,
} = require("../controllers/eventAdmissionController");
const {
  getPaymentStatus,
  cancelPendingRegistration,
} = require("../controllers/eventRegistrationController");
const authHandler = require("../middlewares/authHandler");
const uploadEventImage = require("../middlewares/uploadImage");
const uploadEventDocuments = require("../middlewares/uploadEventDocuments");
const authorizeEventCreator = require("../middlewares/authorizeEventCreator");

const router = express.Router();

// POST https://nextfest-backend.onrender.com/api/events
router.post(
  "/",
  authHandler,
  uploadEventImage.single("eventImage"),
  createEvent,
);

// GET https://nextfest-backend.onrender.com/api/events
router.get("/", getEvents);

// GET https://nextfest-backend.onrender.com/api/events/myEvents
router.get("/myEvents", authHandler, getMyEvents);

// GET https://nextfest-backend.onrender.com/api/events/manage-attendance
router.get("/manage-attendance", authHandler, getManageableEvents);

// GET https://nextfest-backend.onrender.com/api/events/payment/status?session_id=...
router.get("/payment/status", authHandler, getPaymentStatus);

// POST https://nextfest-backend.onrender.com/api/events/payment/cancel
router.post("/payment/cancel", authHandler, cancelPendingRegistration);

// POST https://nextfest-backend.onrender.com/api/events/:id/check-in
router.post("/:id/check-in", authHandler, checkInAttendee);

// GET https://nextfest-backend.onrender.com/api/events/recommended
router.get("/recommended", authHandler, getRecommendedEvents);

// GET https://nextfest-backend.onrender.com/api/events/:id
router.get("/:id", getEvent);

// GET https://nextfest-backend.onrender.com/api/events/:id/related
router.get("/:id/related", getRelatedEvents);

// GET https://nextfest-backend.onrender.com/api/events/:id/reaction
router.get("/:id/reaction", authHandler, getMyEventReaction);

// PUT https://nextfest-backend.onrender.com/api/events/:id/reaction
router.put("/:id/reaction", authHandler, setEventReaction);

// POST https://nextfest-backend.onrender.com/api/events/:id/register
router.post("/:id/register", authHandler, registerForEvent);

// PUT https://nextfest-backend.onrender.com/api/events/:id
router.put(
  "/:id",
  authHandler,
  uploadEventImage.single("eventImage"),
  updateEvent,
);

// DELETE https://nextfest-backend.onrender.com/api/events/:id
router.delete("/:id", authHandler, deleteEvent);

// POST https://nextfest-backend.onrender.com/api/events/:id/documents
router.post(
  "/:id/documents",
  authHandler,
  authorizeEventCreator,
  uploadEventDocuments.array("documents", 5),
  addEventDocuments,
);

// PUT https://nextfest-backend.onrender.com/api/events/:id/documents/:documentId
router.put(
  "/:id/documents/:documentId",
  authHandler,
  authorizeEventCreator,
  uploadEventDocuments.single("document"),
  replaceEventDocument,
);

// DELETE https://nextfest-backend.onrender.com/api/events/:id/documents/:documentId
router.delete(
  "/:id/documents/:documentId",
  authHandler,
  authorizeEventCreator,
  deleteEventDocument,
);

// GET https://nextfest-backend.onrender.com/api/events/:id/documents/:documentId/download
router.get("/:id/documents/:documentId/download", downloadEventDocument);

module.exports = router;
