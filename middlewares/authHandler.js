const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const authHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authorization token missing" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const user = await User.findById(payload.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    if (
      !Number.isSafeInteger(payload.tokenVersion) ||
      payload.tokenVersion !== (user.tokenVersion ?? 0)
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Session expired. Please log in again.",
        });
    }

    req.auth = payload;
    req.user = user; // attach user to request
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authHandler;
