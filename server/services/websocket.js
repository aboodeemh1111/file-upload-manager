const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const { UploadQueue } = require("./uploadQueue");

// Initialize upload queue
const uploadQueue = new UploadQueue();

// Map to store client connections
const clients = new Map();

// Example fix:
let uploadProgressCallback = null;
let queueStatusCallback = null;

// Export setters for these callbacks
function setUploadProgressCallback(callback) {
  uploadProgressCallback = callback;
}

function setQueueStatusCallback(callback) {
  queueStatusCallback = callback;
}

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server: server });

  wss.on("connection", (ws) => {
    const clientId = uuidv4();
    clients.set(clientId, { ws, uploads: [] });

    console.log(`Client connected: ${clientId}`);

    // Send initial queue status
    sendQueueStatus(ws);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        handleClientMessage(clientId, data);
      } catch (error) {
        console.error("Error parsing message:", error);
        sendError(ws, "Invalid message format");
      }
    });

    ws.on("close", () => {
      console.log(`Client disconnected: ${clientId}`);
      // Handle client disconnection (pause uploads, etc.)
      uploadQueue.pauseUploadsForClient(clientId);
      clients.delete(clientId);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connection",
        status: "connected",
        clientId,
      })
    );
  });

  return wss;
}

function handleClientMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  const { ws } = client;

  switch (data.type) {
    case "upload_request":
      // Add file to upload queue
      uploadQueue.addToQueue({
        clientId,
        fileId: data.fileId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        priority: data.priority || "normal",
      });

      // Send updated queue status to all clients
      broadcastQueueStatus();
      break;

    case "cancel_upload":
      // Cancel specific upload
      uploadQueue.removeFromQueue(data.fileId);
      broadcastQueueStatus();
      break;

    case "pause_upload":
      // Pause specific upload
      uploadQueue.pauseUpload(data.fileId);
      broadcastQueueStatus();
      break;

    case "resume_upload":
      // Resume specific upload
      handleResumeUpload(client, data);
      break;

    case "ping":
      // Respond to ping
      ws.send(JSON.stringify({ type: "pong" }));
      break;

    default:
      sendError(ws, "Unknown message type");
  }
}

function sendQueueStatus(ws) {
  ws.send(
    JSON.stringify({
      type: "queue_status",
      queue: uploadQueue.getQueueStatus(),
    })
  );
}

function broadcastQueueStatus() {
  const queueStatus = {
    type: "queue_status",
    queue: uploadQueue.getQueueStatus(),
  };

  clients.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(queueStatus));
    }
  });
}

function sendUploadProgress(clientId, fileId, progress) {
  if (uploadProgressCallback) {
    uploadProgressCallback(clientId, fileId, progress);
  }
}

function sendError(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "error",
        message,
      })
    );
  }
}

// Add resume upload support on the server
const handleResumeUpload = (client, data) => {
  const { fileId, uploadedChunks } = data;

  // Find the file in the queue
  const fileIndex = uploadQueue.findIndex((file) => file.fileId === fileId);
  if (fileIndex === -1) {
    return client.send(
      JSON.stringify({
        type: "error",
        message: "File not found in queue",
      })
    );
  }

  // Update the file status
  uploadQueue[fileIndex].status = "uploading";
  uploadQueue[fileIndex].uploadedChunks = uploadedChunks || [];

  // Broadcast queue update
  broadcastQueueStatus();

  // Send resume confirmation
  client.send(
    JSON.stringify({
      type: "resume_upload",
      fileId,
      status: "resumed",
      nextChunk: uploadQueue[fileIndex].uploadedChunks.length,
    })
  );
};

module.exports = {
  setupWebSocketServer,
  setUploadProgressCallback,
  setQueueStatusCallback,
  sendUploadProgress,
  broadcastQueueStatus,
  clients,
};
