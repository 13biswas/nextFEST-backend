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

// POST http://localhost:3113/api/memberships/:groupId/invite
router.post("/:groupId/invite", authHandler, inviteMember);

// POST http://localhost:3113/api/memberships/:groupId/join
router.post("/:groupId/join", authHandler, joinGroup);

// POST http://localhost:3113/api/memberships/:groupId/leave
router.post("/:groupId/leave", authHandler, leaveGroup);

// POST http://localhost:3113/api/memberships/:groupId/promote/:userId
router.post("/:groupId/promote/:userId", authHandler, promoteMember);

// POST http://localhost:3113/api/memberships/:groupId/demote/:userId
router.post("/:groupId/demote/:userId", authHandler, demoteMember);

// GET http://localhost:3113/api/memberships/dashboard/requests
router.get("/dashboard/requests", authHandler, getDashboardJoinRequestPreviews);

// GET http://localhost:3113/api/memberships/:groupId/requests
router.get("/:groupId/requests", authHandler, joinRequests);

// GET http://localhost:3113/api/memberships/:groupId/membership
router.get("/:groupId/membership", authHandler, getMyGroupMembership);

// GET http://localhost:3113/api/memberships/my-request
router.get("/:groupId/my-request", authHandler, myJoinRequest);

// PATCH http://localhost:3113/api/memberships/:groupId/requests
router.patch("/:groupId/requests/:requestId", authHandler, reviewJoinRequest);

module.exports = router;
