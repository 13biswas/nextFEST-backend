const path = require("node:path");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const Event = require("../models/eventModel");
const cloudinary = require("../utils/cloudinary");

const isPdf = (file) =>
  file.mimetype === "application/pdf" &&
  file.buffer.subarray(0, 5).toString() === "%PDF-";

const getDisplayName = (originalName) => {
  const normalizedName = originalName.replace(/\\/g, "/");
  const name = path
    .basename(normalizedName)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 180);

  return name || "event-document.pdf";
};

const uploadRawPdf = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-connect/event-documents",
        public_id: `${randomUUID()}.pdf`,
        resource_type: "raw",
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.public_id) {
          return reject(new Error("Cloudinary did not return a document ID"));
        }

        resolve(result);
      },
    );

    stream.end(file.buffer);
  });

const deleteRawPdf = (publicId) =>
  cloudinary.uploader.destroy(publicId, {
    resource_type: "raw",
    type: "upload",
  });

const documentResponse = (eventId, document) => ({
  _id: document._id,
  name: document.name,
  format: document.format,
  bytes: document.bytes,
  uploadedAt: document.uploadedAt,
  downloadUrl: `/api/events/${eventId}/documents/${document._id}/download`,
});

const addEventDocuments = async (req, res, next) => {
  const uploadedAssets = [];

  try {
    if (!req.files?.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one PDF document",
      });
    }

    const invalidFile = req.files.find((file) => !isPdf(file));

    if (invalidFile) {
      return res.status(400).json({
        success: false,
        message: `${invalidFile.originalname} is not a valid PDF`,
      });
    }

    for (const file of req.files) {
      const asset = await uploadRawPdf(file);
      uploadedAssets.push(asset);

      req.event.documents.push({
        name: getDisplayName(file.originalname),
        publicId: asset.public_id,
        format: "pdf",
        bytes: file.size,
        uploadedAt: new Date(),
      });
    }

    await req.event.save();

    res.status(201).json({
      success: true,
      data: req.event.documents.map((document) =>
        documentResponse(req.event._id, document),
      ),
    });
  } catch (error) {
    await Promise.allSettled(
      uploadedAssets.map((asset) => deleteRawPdf(asset.public_id)),
    );
    next(error);
  }
};

const replaceEventDocument = async (req, res, next) => {
  let newAsset;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Select a PDF document",
      });
    }

    if (!isPdf(req.file)) {
      return res.status(400).json({
        success: false,
        message: "The uploaded file is not a valid PDF",
      });
    }

    if (!mongoose.isValidObjectId(req.params.documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
    }

    const document = req.event.documents.id(req.params.documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const oldPublicId = document.publicId;
    newAsset = await uploadRawPdf(req.file);

    document.name = getDisplayName(req.file.originalname);
    document.publicId = newAsset.public_id;
    document.format = "pdf";
    document.bytes = req.file.size;
    document.uploadedAt = new Date();

    await req.event.save();

    await deleteRawPdf(oldPublicId);

    res.json({
      success: true,
      data: documentResponse(req.event._id, document),
    });
  } catch (error) {
    if (newAsset) {
      await Promise.allSettled([deleteRawPdf(newAsset.public_id)]);
    }
    next(error);
  }
};

const deleteEventDocument = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
    }

    const document = req.event.documents.id(req.params.documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const deletionResult = await deleteRawPdf(document.publicId);

    if (!["ok", "not found"].includes(deletionResult?.result)) {
      throw new Error("Cloudinary did not delete the event document");
    }

    req.event.documents.splice(req.event.documents.indexOf(document), 1);

    await req.event.save();

    res.json({
      success: true,
      message: "Document deleted",
    });
  } catch (error) {
    next(error);
  }
};

const downloadEventDocument = async (req, res, next) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.documentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid event or document ID",
      });
    }

    const event = await Event.findById(req.params.id).select(
      "+documents.publicId",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "No such event found",
      });
    }

    const document = event.documents.id(req.params.documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const downloadUrl = cloudinary.url(document.publicId, {
      resource_type: "raw",
      type: "upload",
      secure: true,
      flags: "attachment",
    });

    res.redirect(downloadUrl);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addEventDocuments,
  replaceEventDocument,
  deleteEventDocument,
  downloadEventDocument,
};
