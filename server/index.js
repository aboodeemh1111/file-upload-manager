const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const dotenv = require("dotenv");
const uploadRoutes = require("./routes/upload");
const { setupWebSocketServer } = require("./services/websocket");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: "*", // For development
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/upload", uploadRoutes);

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server
setupWebSocketServer(server);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
