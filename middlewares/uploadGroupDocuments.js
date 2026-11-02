const multer = require("multer");
const path = require("node:path");

const uploadGroupDocuments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 MB per file
    files: 5,
  },
  fileFilter: (req, file, callback) => {
    const normalizedName = file.originalname.replace(/\\/g, "/");
    const extension = path.extname(normalizedName).toLowerCase();

    if (file.mimetype !== "application/pdf" || extension !== ".pdf") {
      return callback(new Error("Only PDF files are allowed"));
    }

    callback(null, true);
  },
});

module.exports = uploadGroupDocuments;
