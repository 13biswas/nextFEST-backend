const express = require("express");
const {
  signupUser,
  loginUser,
  googleLogin,
  googleSignup,
  logoutUser,
  requestEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
} = require("../controllers/authController");
const authHandler = require("../middlewares/authHandler");
const router = express.Router();

// POST http://localhost:3113/api/auth/signup
router.post("/signup", signupUser);

// POST http://localhost:3113/api/auth/google-login
router.post("/google-signup", googleSignup);

// POST http://localhost:3113/api/auth/login
router.post("/login", loginUser);

// POST http://localhost:3113/api/auth/google-login
router.post("/google-login", googleLogin);

router.post("/logout", authHandler, logoutUser);

// POST http://localhost:3113/api/auth/request-verification
router.post("/request-verification", authHandler, requestEmailVerification);

// POST http://localhost:3113/api/auth/verify-email
router.get("/verify-email", verifyEmail);

// POST http://localhost:3113/api/auth/forgot-password
router.post("/forgot-password", requestPasswordReset);

// POST http://localhost:3113/api/auth/reset-password
router.post("/reset-password", resetPassword);

router.post("/change-password", authHandler, changePassword);

module.exports = router;
