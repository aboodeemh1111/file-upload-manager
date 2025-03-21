const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// Simple upload endpoint that returns success
app.get("/upload", (req, res) => {
  res.json({ success: true, message: "Upload endpoint is working" });
});

app.post("/upload", (req, res) => {
  try {
    // For testing, just return success without actually processing the file
    console.log("Upload request received");
    return res.status(200).json({
      success: true,
      message: "Upload received",
      url: "https://example.com/mock-upload-url",
    });
  } catch (error) {
    console.error("Error handling upload:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Upload failed",
        message: error.message,
      });
    }
  }
});

// Add better error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Server error",
    message: err.message,
  });
});

const PORT = 8083;
app.listen(PORT, () => {
  console.log(`Mock server running on port ${PORT}`);
});
