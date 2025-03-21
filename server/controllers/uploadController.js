const { bucket } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Handle file upload to Firebase Storage
const uploadToFirebase = async (req, res) => {
  try {
    console.log("Upload request received");
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);

    if (!req.file) {
      console.error("No file in request");
      return res.status(400).json({ error: "No file provided" });
    }

    console.log("File details:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    });

    console.log("Uploading file to Firebase:", req.file.originalname);

    // Create a unique filename
    const filename = `${Date.now()}_${req.file.originalname.replace(
      /[^a-zA-Z0-9.]/g,
      "_"
    )}`;
    const filePath = `uploads/${filename}`;

    console.log("Upload path:", filePath);

    // Upload to Firebase Storage
    const file = bucket.file(filePath);

    // Create a write stream
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    // Handle errors
    stream.on("error", (error) => {
      console.error("Stream error:", error);
      // Check if response has already been sent
      if (!res.headersSent) {
        return res
          .status(500)
          .json({ error: "Upload failed", details: error.message });
      }
    });

    // Handle completion
    stream.on("finish", async () => {
      try {
        // Make the file publicly accessible
        await file.makePublic();

        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        console.log("Upload successful, public URL:", publicUrl);

        // Check if response has already been sent
        if (!res.headersSent) {
          return res.status(200).json({
            success: true,
            url: publicUrl,
            filename: filename,
          });
        } else {
          console.log("Headers already sent, not sending another response");
        }
      } catch (error) {
        console.error("Error after upload finished:", error);
        // Check if response has already been sent
        if (!res.headersSent) {
          return res.status(500).json({
            error: "Upload processing failed",
            details: error.message || "Unknown error",
          });
        } else {
          console.error("Headers already sent, could not send error response");
        }
      }
    });

    // Pipe the file to the write stream
    fs.createReadStream(req.file.path).pipe(stream);
  } catch (error) {
    console.error("Upload error:", error);
    // Make sure we always send a valid JSON response
    return res.status(500).json({
      error: "Upload failed",
      details: error.message || "Unknown error",
    });
  }
};

// Handle chunked file upload
const uploadChunk = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No chunk provided" });
    }

    const { fileId, chunkIndex, totalChunks } = req.body;

    if (!fileId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const userId = req.body.userId || "anonymous";
    const tempDir = path.join(os.tmpdir(), "uploads", fileId);

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Move chunk to temp directory
    const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`);
    fs.renameSync(req.file.path, chunkPath);

    // Check if all chunks have been uploaded
    const uploadedChunks = fs.readdirSync(tempDir).length;

    if (uploadedChunks === parseInt(totalChunks)) {
      // All chunks received, combine them
      const fileName = req.body.fileName || `file-${fileId}`;
      const fileType = req.body.fileType || "application/octet-stream";
      const finalFilePath = path.join(os.tmpdir(), fileName);

      // Combine chunks
      const writeStream = fs.createWriteStream(finalFilePath);

      for (let i = 0; i < totalChunks; i++) {
        const chunkData = fs.readFileSync(path.join(tempDir, `chunk-${i}`));
        writeStream.write(chunkData);
      }

      writeStream.end();

      // Wait for file to be written
      await new Promise((resolve) => writeStream.on("finish", resolve));

      // Upload combined file to Firebase
      const destination = `uploads/${userId}/${fileId}/${fileName}`;

      await bucket.upload(finalFilePath, {
        destination,
        metadata: {
          contentType: fileType,
          metadata: {
            firebaseStorageDownloadTokens: fileId,
            originalName: fileName,
          },
        },
      });

      // Get public URL
      const file = bucket.file(destination);
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500", // Far future expiration
      });

      // Clean up temp files
      fs.unlinkSync(finalFilePath);
      fs.rmSync(tempDir, { recursive: true, force: true });

      res.status(200).json({
        success: true,
        fileId,
        fileName,
        fileType,
        url,
        status: "complete",
      });
    } else {
      // Not all chunks received yet
      res.status(200).json({
        success: true,
        fileId,
        chunkIndex,
        uploadedChunks,
        totalChunks,
        status: "partial",
      });
    }
  } catch (error) {
    console.error("Error handling chunk upload:", error);

    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Failed to process chunk",
      details: error.message,
    });
  }
};

module.exports = {
  uploadToFirebase,
  uploadChunk,
};
