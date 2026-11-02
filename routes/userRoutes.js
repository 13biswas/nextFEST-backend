const express = require("express");
const authHandler = require("../middlewares/authHandler");
const uploadImage = require("../middlewares/uploadImage");
const {
  getMyProfile,
  updateMyProfile,
  getUserProfile,
  uploadMyProfileImage,
  getMyBookmarks,
  addMyBookmark,
  removeMyBookmark,
} = require("../controllers/userController");

const router = express.Router();

// GET http://localhost:3113/api/me
router.get("/me", authHandler, getMyProfile);

// PUT http://localhost:3113/api/me
router.put("/me", authHandler, updateMyProfile);

// PUT http://localhost:3113/api/me/profile-image
router.put(
  "/me/profile-image",
  authHandler,
  uploadImage.single("profileImage"),
  uploadMyProfileImage,
);

router.get("/bookmarks", authHandler, getMyBookmarks);
router.post("/bookmarks/:eventId", authHandler, addMyBookmark);
router.delete("/bookmarks/:eventId", authHandler, removeMyBookmark);

router.get("/:userId", authHandler, getUserProfile);

module.exports = router;
