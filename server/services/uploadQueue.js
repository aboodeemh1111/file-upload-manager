const { bucket } = require("../config/firebase");
const { sendUploadProgress, broadcastQueueStatus } = require("./websocket");
const fs = require("fs");
const path = require("path");
const os = require("os");

class UploadQueue {
  constructor() {
    this.queue = [];
    this.activeUploads = new Map();
    this.maxConcurrentUploads = 3; // Limit concurrent uploads
    this.processing = false;
  }

  addToQueue(fileInfo) {
    this.queue.push({
      ...fileInfo,
      status: "queued",
      progress: 0,
      addedAt: Date.now(),
    });

    // Sort queue by priority and time added
    this.sortQueue();

    // Start processing if not already
    if (!this.processing) {
      this.processQueue();
    }
  }

  sortQueue() {
    const priorityValues = {
      high: 3,
      normal: 2,
      low: 1,
    };

    this.queue.sort((a, b) => {
      // First sort by priority
      const priorityDiff =
        priorityValues[b.priority] - priorityValues[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by time added (FIFO)
      return a.addedAt - b.addedAt;
    });
  }

  async processQueue() {
    if (this.processing) return;

    this.processing = true;

    while (
      this.queue.length > 0 &&
      this.activeUploads.size < this.maxConcurrentUploads
    ) {
      const fileInfo = this.queue.shift();

      // Update status to 'uploading'
      fileInfo.status = "uploading";
      this.activeUploads.set(fileInfo.fileId, fileInfo);

      // Broadcast updated queue status
      broadcastQueueStatus();

      // Start upload process (non-blocking)
      this.uploadFile(fileInfo);
    }

    this.processing = false;
  }

  async uploadFile(fileInfo) {
    try {
      // In a real implementation, we would receive the file chunks here
      // and upload them to Firebase Storage

      // Simulate upload progress for demonstration
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;

        if (progress <= 100) {
          // Update progress
          fileInfo.progress = progress;
          sendUploadProgress(fileInfo.clientId, fileInfo.fileId, progress);

          if (progress === 100) {
            clearInterval(progressInterval);
            this.completeUpload(fileInfo);
          }
        }
      }, 500);

      // Store the interval reference for potential cancellation
      fileInfo.progressInterval = progressInterval;
    } catch (error) {
      console.error(`Error uploading file ${fileInfo.fileName}:`, error);
      this.handleUploadError(fileInfo, error.message);
    }
  }

  completeUpload(fileInfo) {
    // Remove from active uploads
    this.activeUploads.delete(fileInfo.fileId);

    // Update client
    const { ws } = require("./websocket").clients.get(fileInfo.clientId) || {};
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "upload_complete",
          fileId: fileInfo.fileId,
          fileName: fileInfo.fileName,
        })
      );
    }

    // Process next in queue
    this.processQueue();
  }

  handleUploadError(fileInfo, errorMessage) {
    // Clear any intervals
    if (fileInfo.progressInterval) {
      clearInterval(fileInfo.progressInterval);
    }

    // Remove from active uploads
    this.activeUploads.delete(fileInfo.fileId);

    // Update client
    const { ws } = require("./websocket").clients.get(fileInfo.clientId) || {};
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "upload_error",
          fileId: fileInfo.fileId,
          fileName: fileInfo.fileName,
          error: errorMessage,
        })
      );
    }

    // Process next in queue
    this.processQueue();
  }

  removeFromQueue(fileId) {
    // Check if in queue
    const queueIndex = this.queue.findIndex((item) => item.fileId === fileId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      return true;
    }

    // Check if active upload
    if (this.activeUploads.has(fileId)) {
      const fileInfo = this.activeUploads.get(fileId);

      // Clear any intervals
      if (fileInfo.progressInterval) {
        clearInterval(fileInfo.progressInterval);
      }

      // Remove from active uploads
      this.activeUploads.delete(fileId);

      // Process next in queue
      this.processQueue();

      return true;
    }

    return false;
  }

  pauseUpload(fileId) {
    // Only active uploads can be paused
    if (this.activeUploads.has(fileId)) {
      const fileInfo = this.activeUploads.get(fileId);

      // Clear progress interval
      if (fileInfo.progressInterval) {
        clearInterval(fileInfo.progressInterval);
      }

      // Update status
      fileInfo.status = "paused";

      // Move back to queue
      this.queue.unshift({
        ...fileInfo,
        addedAt: Date.now(), // Update time to maintain priority
      });

      // Remove from active uploads
      this.activeUploads.delete(fileId);

      // Process next in queue
      this.processQueue();

      return true;
    }

    return false;
  }

  resumeUpload(fileId) {
    // Find in queue
    const queueIndex = this.queue.findIndex(
      (item) => item.fileId === fileId && item.status === "paused"
    );

    if (queueIndex !== -1) {
      // Update status
      this.queue[queueIndex].status = "queued";

      // Process queue
      this.processQueue();

      return true;
    }

    return false;
  }

  pauseUploadsForClient(clientId) {
    // Pause all active uploads for this client
    this.activeUploads.forEach((fileInfo, fileId) => {
      if (fileInfo.clientId === clientId) {
        this.pauseUpload(fileId);
      }
    });

    // Mark queued uploads as paused
    this.queue.forEach((fileInfo) => {
      if (fileInfo.clientId === clientId) {
        fileInfo.status = "paused";
      }
    });
  }

  getQueueStatus() {
    // Return combined status of queue and active uploads
    return [...Array.from(this.activeUploads.values()), ...this.queue];
  }
}

module.exports = {
  UploadQueue,
};
