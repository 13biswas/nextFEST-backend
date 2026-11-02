const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { OAuth2Client } = require("google-auth-library");
const { signToken } = require("../utils/jwt");
const User = require("../models/userModel");
const {
  sendPasswordResetEmail,
  sendAccountVerificationEmail,
  sendVerificationSuccessEmail,
} = require("../utils/email");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createSessionToken = async (user) => {
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { $inc: { tokenVersion: 1 } },
    { new: true },
  );

  if (!updatedUser) {
    throw new Error("Could not create an authentication session");
  }

  return signToken({
    id: updatedUser._id,
    email: updatedUser.email,
    tokenVersion: updatedUser.tokenVersion,
  });
};

const signupUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Prevent duplicate user signup
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = await createSessionToken(user);

    res.status(201).json({
      success: true,
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    });
  } catch (err) {
    console.log("Error in signupUser", err);
    next(err);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid login credentials" });
    }

    const token = await createSessionToken(user);

    res.json({
      success: true,
      userData: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    });
  } catch (err) {
    console.error("Error in loginUser:", err);
    next(err);
  }
};

const verifyGoogleCredential = async (credential) => {
  if (!credential) {
    const error = new Error("Google credential is required");
    error.statusCode = 400;
    throw error;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    const error = new Error("Invalid Google credential");
    error.statusCode = 401;
    throw error;
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    const error = new Error("Google account email is not verified");
    error.statusCode = 401;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split("@")[0],
    profileImage: payload.picture || "",
    isEmailVerified: true,
  };
};

const sendGoogleAuthResponse = async (res, user, status = 200) => {
  const token = await createSessionToken(user);

  return res.status(status).json({
    success: true,
    userData: {
      id: user._id,
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    },
    token,
  });
};

const googleSignup = async (req, res, next) => {
  try {
    const googleUser = await verifyGoogleCredential(req.body.credential);

    const existingGoogleUser = await User.findOne({
      googleId: googleUser.googleId,
    });

    if (existingGoogleUser) {
      return res.status(409).json({
        success: false,
        message: "This Google account is already registered. Log in instead.",
      });
    }

    const existingEmail = await User.findOne({ email: googleUser.email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Log in using its existing method.",
      });
    }

    const user = await User.create(googleUser);
    return await sendGoogleAuthResponse(res, user, 201);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this Google identity or email already exists.",
      });
    }
    next(error);
  }
};

const googleLogin = async (req, res, next) => {
  try {
    const googleUser = await verifyGoogleCredential(req.body.credential);
    const user = await User.findOne({ googleId: googleUser.googleId });

    if (!user) {
      const emailAccount = await User.findOne({ email: googleUser.email });
      return res.status(emailAccount ? 409 : 401).json({
        success: false,
        message: emailAccount
          ? "This email belongs to an account registered another way. Use that login method."
          : "No account exists for this Google identity. Sign up first.",
      });
    }

    return await sendGoogleAuthResponse(res, user);
  } catch (error) {
    next(error);
  }
};

const logoutUser = async (req, res, next) => {
  try {
    await User.updateOne(
      {
        _id: req.user._id,
        tokenVersion: req.auth.tokenVersion,
      },
      { $inc: { tokenVersion: 1 } },
    );

    return res.json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    return next(error);
  }
};

const requestEmailVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(400).json({
        message: "This account does not use email-and-password sign-in",
      });
    }

    if (user.isEmailVerified) {
      return res.json({
        message: "Account is already verified",
        isEmailVerified: true,
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3113";

    const verificationUrl = `${backendUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

    try {
      await sendAccountVerificationEmail(user.email, verificationUrl);
    } catch (error) {
      user.emailVerificationTokenHash = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      console.error("Account verification email delivery failed:", error);
      return res.status(502).json({
        message: "Unable to send the verification email right now",
      });
    }

    return res.json({
      message: "Verification email sent",
      isEmailVerified: false,
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const rawToken = req.query.token;

    if (typeof rawToken !== "string" || !rawToken) {
      return res.redirect(`${frontendUrl}/dashboard?verification=invalid`);
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await User.findOneAndUpdate(
      {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: { $gt: new Date() },
        isEmailVerified: { $ne: true },
      },
      {
        $set: { isEmailVerified: true },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpires: 1,
        },
      },
      { new: true },
    );

    if (!user) {
      return res.redirect(`${frontendUrl}/dashboard?verification=invalid`);
    }

    try {
      await sendVerificationSuccessEmail(user.email);
    } catch (error) {
      console.error("Verification success email delivery failed:", error);
      return res.redirect(
        `${frontendUrl}/dashboard?verification=success&confirmationEmail=failed`,
      );
    }

    return res.redirect(`${frontendUrl}/dashboard?verification=success`);
  } catch (error) {
    next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (user?.password) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (error) {
        console.error("Password reset email delivery failed:", error);
      }
    }

    return res.status(202).json({
      message:
        "If an account exists for that email, a reset link will be sent.",
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== "string" || !token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const saltRounds = Number.parseInt(
      process.env.BCRYPT_SALT_ROUNDS || "10",
      10,
    );
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { $gt: new Date() },
        password: { $exists: true, $ne: null },
      },
      {
        $set: { password: hashedPassword },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpires: 1,
        },
        $inc: { tokenVersion: 1 },
      },
      { new: false },
    );

    if (!user) {
      return res.status(400).json({
        message: "This reset link is invalid or has expired",
      });
    }

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6 || currentPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user?.password) {
      return res.status(403).json({
        success: false,
        message: "Password changes are unavailable for Google sign-in accounts",
      });
    }

    const currentPasswordIsValid = await user.comparePassword(currentPassword);

    if (!currentPasswordIsValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
