const express = require("express");
const authHandler = require("../middlewares/authHandler");
const {
  inviteMember,
  getMyGroupMembership,
  joinGroup,
  leaveGroup,
  promoteMember,
  demoteMember,
  joinRequests,
  myJoinRequest,
  reviewJoinRequest,
  getDashboardJoinRequestPreviews,
} = require("../controllers/membershipController.js");
const router = express.Router();

// POST https://nextfest-backend.onrender.com/api/memberships/:groupId/invite
router.post("/:groupId/invite", authHandler, inviteMember);

// POST https://nextfest-backend.onrender.com/api/memberships/:groupId/join
router.post("/:groupId/join", authHandler, joinGroup);

// POST https://nextfest-backend.onrender.com/api/memberships/:groupId/leave
router.post("/:groupId/leave", authHandler, leaveGroup);

// POST https://nextfest-backend.onrender.com/api/memberships/:groupId/promote/:userId
router.post("/:groupId/promote/:userId", authHandler, promoteMember);

// POST https://nextfest-backend.onrender.com/api/memberships/:groupId/demote/:userId
router.post("/:groupId/demote/:userId", authHandler, demoteMember);

// GET https://nextfest-backend.onrender.com/api/memberships/dashboard/requests
router.get("/dashboard/requests", authHandler, getDashboardJoinRequestPreviews);

// GET https://nextfest-backend.onrender.com/api/memberships/:groupId/requests
router.get("/:groupId/requests", authHandler, joinRequests);

// GET https://nextfest-backend.onrender.com/api/memberships/:groupId/membership
router.get("/:groupId/membership", authHandler, getMyGroupMembership);

// GET https://nextfest-backend.onrender.com/api/memberships/:groupId/my-request
router.get("/:groupId/my-request", authHandler, myJoinRequest);

// PATCH https://nextfest-backend.onrender.com/api/memberships/:groupId/requests/:requestId
router.patch("/:groupId/requests/:requestId", authHandler, reviewJoinRequest);

module.exports = router;
