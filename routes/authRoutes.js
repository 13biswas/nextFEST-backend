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

// POST https://nextfest-backend.onrender.com/api/auth/signup
router.post("/signup", signupUser);

// POST https://nextfest-backend.onrender.com/api/auth/google-signup
router.post("/google-signup", googleSignup);

// POST https://nextfest-backend.onrender.com/api/auth/login
router.post("/login", loginUser);

// POST https://nextfest-backend.onrender.com/api/auth/google-login
router.post("/google-login", googleLogin);

router.post("/logout", authHandler, logoutUser);

// POST https://nextfest-backend.onrender.com/api/auth/request-verification
router.post("/request-verification", authHandler, requestEmailVerification);

// GET https://nextfest-backend.onrender.com/api/auth/verify-email
router.get("/verify-email", verifyEmail);

// POST https://nextfest-backend.onrender.com/api/auth/forgot-password
router.post("/forgot-password", requestPasswordReset);

// POST https://nextfest-backend.onrender.com/api/auth/reset-password
router.post("/reset-password", resetPassword);

router.post("/change-password", authHandler, changePassword);

module.exports = router;
