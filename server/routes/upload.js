const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const os = require("os");
const {
  uploadToFirebase,
  uploadChunk,
} = require("../controllers/uploadController");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), "uploads");
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for direct uploads
  },
});

// Routes
router.post("/file", upload.single("file"), async (req, res) => {
  try {
    const result = await uploadToFirebase(req, res);
    res.json(result);
  } catch (error) {
    console.error("Error in upload route:", error);
    res.status(500).json({
      error: "Upload failed",
      message: error.message || "Unknown error",
    });
  }
});
router.post("/chunk", upload.single("chunk"), uploadChunk);

// Add a test endpoint
router.post("/test", (req, res) => {
  res.json({
    success: true,
    message: "Test endpoint working",
    url: "https://example.com/test-url",
  });
});

module.exports = router;
