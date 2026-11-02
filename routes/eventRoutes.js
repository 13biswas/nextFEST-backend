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

// POST http://localhost:3113/api/events
router.post(
  "/",
  authHandler,
  uploadEventImage.single("eventImage"),
  createEvent,
);

// GET http://localhost:3113/api/events
router.get("/", getEvents);

// GET http://localhost:3113/api/myEvents
router.get("/myEvents", authHandler, getMyEvents);

// GET http://localhost:3113/api/manage-attendance
router.get("/manage-attendance", authHandler, getManageableEvents);

// GET http://localhost:3113/api/events/payment/status?session_id=...
router.get("/payment/status", authHandler, getPaymentStatus);

// POST http://localhost:3113/api/events/payment/cancel
router.post("/payment/cancel", authHandler, cancelPendingRegistration);

// GET http://localhost:3113/api/events/:id/check-in
router.post("/:id/check-in", authHandler, checkInAttendee);

// GET http://localhost:3113/api/recommended
router.get("/recommended", authHandler, getRecommendedEvents);

// GET http://localhost:3113/api/events/:id
router.get("/:id", getEvent);

// GET http://localhost:3113/api/events/:id/related
router.get("/:id/related", getRelatedEvents);

// GET http://localhost:3113/api/events/:id/reaction
router.get("/:id/reaction", authHandler, getMyEventReaction);

// PUT http://localhost:3113/api/events/:id/reaction
router.put("/:id/reaction", authHandler, setEventReaction);

// POST http://localhost:3113/api/events/:id/register
router.post("/:id/register", authHandler, registerForEvent);

// PUT http://localhost:3113/api/events/:id
router.put(
  "/:id",
  authHandler,
  uploadEventImage.single("eventImage"),
  updateEvent,
);

// DELETE http://localhost:3113/api/events/:id
router.delete("/:id", authHandler, deleteEvent);

// POST http://localhost:3113/api/events/:id/documents
router.post(
  "/:id/documents",
  authHandler,
  authorizeEventCreator,
  uploadEventDocuments.array("documents", 5),
  addEventDocuments,
);

// PUT http://localhost:3113/api/events/:id/documents/:documentId
router.put(
  "/:id/documents/:documentId",
  authHandler,
  authorizeEventCreator,
  uploadEventDocuments.single("document"),
  replaceEventDocument,
);

// DELETE http://localhost:3113/api/events/:id/documents/:documentId
router.delete(
  "/:id/documents/:documentId",
  authHandler,
  authorizeEventCreator,
  deleteEventDocument,
);

// GET http://localhost:3113/api/events/:id/documents/:documentId/download
router.get("/:id/documents/:documentId/download", downloadEventDocument);

module.exports = router;
