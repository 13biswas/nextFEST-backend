const cloudinary = require("../utils/cloudinary");

const getLegacyEventImagePublicId = (imageUrl) => {
  try {
    const { pathname } = new URL(imageUrl);
    const match = pathname.match(
      /\/upload\/(?:v\d+\/)?(campus-connect\/event-images\/.+)$/,
    );

    if (!match) {
      return null;
    }

    return match[1].replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
};

const uploadToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-connect/event-images",
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.end(file.buffer);
  });

function parseRegistrationLimit(value) {
  if (value === undefined || value === null || value === "") {
    return { value: null, error: null };
  }

  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit < 1) {
    return {
      value: null,
      error: "Registration limit must be a positive whole number",
    };
  }

  return { value: limit, error: null };
}

function parseEventGeoLocation(value) {
  if (value === undefined || value === null || value === "") {
    return { geoLocation: null, error: null };
  }

  let parsed;

  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return {
      geoLocation: null,
      error: "Event location coordinates must be valid JSON.",
    };
  }

  const coordinates = parsed?.coordinates;

  if (
    parsed?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  ) {
    return {
      geoLocation: null,
      error: "Event location must be a GeoJSON Point.",
    };
  }

  const [longitude, latitude] = coordinates;

  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return {
      geoLocation: null,
      error: "Event location coordinates are out of range.",
    };
  }

  return {
    geoLocation: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
    error: null,
  };
}

function parseEventPrice(value) {
  if (value === undefined || value === null || value === "") {
    return { value: 0, error: null };
  }

  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return {
      value: null,
      error: "Price must be a valid number of 0 or more",
    };
  }

  return { value: price, error: null };
}

module.exports = {
  uploadToCloudinary,
  parseRegistrationLimit,
  parseEventGeoLocation,
  parseEventPrice,
  getLegacyEventImagePublicId,
};
