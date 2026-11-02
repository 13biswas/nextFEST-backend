const express = require("express");
const {
  createGroup,
  getGroups,
  getGroup,
  getMyGroups,
  updateGroup,
  deleteGroup,
} = require("../controllers/groupController");
const {
  addGroupDocuments,
  replaceGroupDocument,
  deleteGroupDocument,
  downloadGroupDocument,
} = require("../controllers/groupDocumentController");
const authHandler = require("../middlewares/authHandler");
const uploadImage = require("../middlewares/uploadImage");
const uploadGroupDocuments = require("../middlewares/uploadGroupDocuments");
const authorizeGroupCreator = require("../middlewares/authorizeGroupCreator");

const router = express.Router();

// POST http://localhost:3113/api/groups
router.post(
  "/",
  authHandler,
  uploadImage.fields([
    { name: "logo", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
  ]),
  createGroup,
);

// GET http://localhost:3113/api/groups
router.get("/", getGroups);

// GET http://localhost:3113/api/groups/myGroups
router.get("/myGroups", authHandler, getMyGroups);

// GET http://localhost:3113/api/groups/:id
router.get("/:id", authHandler, getGroup);

// PUT http://localhost:3113/api/groups/:id
router.put(
  "/:id",
  authHandler,
  uploadImage.fields([
    { name: "logo", maxCount: 1 },
    { name: "backgroundImage", maxCount: 1 },
  ]),
  updateGroup,
);

// DELETE http://localhost:3113/api/groups/:id
router.delete("/:id", authHandler, deleteGroup);

// POST http://localhost:3113/api/groups/:id/documents
router.post(
  "/:id/documents",
  authHandler,
  authorizeGroupCreator,
  uploadGroupDocuments.array("documents", 5),
  addGroupDocuments,
);

// PUT http://localhost:3113/api/groups/:id/documents/:documentId
router.put(
  "/:id/documents/:documentId",
  authHandler,
  authorizeGroupCreator,
  uploadGroupDocuments.single("document"),
  replaceGroupDocument,
);

// DELETE http://localhost:3113/api/groups/:id/documents/:documentId
router.delete(
  "/:id/documents/:documentId",
  authHandler,
  authorizeGroupCreator,
  deleteGroupDocument,
);

// GET http://localhost:3113/api/groups/:id/documents/:documentId/download
router.get("/:id/documents/:documentId/download", downloadGroupDocument);

module.exports = router;
