import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { Platform } from "react-native";
import { FileUpload } from "@/types/FileUpload";

// Define event types for type safety
export interface ConnectionStatusData {
  connected: boolean;
  error: string | null;
}

export interface UploadProgressData {
  fileId: string;
  progress: number;
}

export interface UploadStatusData {
  fileId: string;
  status: string;
  error?: string;
}

// Mock WebSocket service implementation

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private clientId: string | null = null;

  connect(url: string) {
    try {
      console.log("Connecting to WebSocket server:", url);

      // Add a timeout to prevent hanging if server is unreachable
      const connectTimeout = setTimeout(() => {
        console.log("WebSocket connection timeout - using offline mode");
        this.notifyListeners("connection_status", {
          connected: false,
          error: "Connection timeout",
        });
      }, 5000);

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        clearTimeout(connectTimeout);
        console.log("WebSocket connection established");
        this.reconnectAttempts = 0;
        this.notifyListeners("connection_status", {
          connected: true,
          error: null,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received message:", data);

          // Handle client ID assignment
          if (data.type === "connection" && data.clientId) {
            this.clientId = data.clientId;
          }

          this.notifyListeners(data.type, data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.notifyListeners("connection_status", {
          connected: false,
          error: "Connection error",
        });
      };

      this.ws.onclose = () => {
        console.log("WebSocket connection closed");
        this.notifyListeners("connection_status", {
          connected: false,
          error: null,
        });

        // Attempt to reconnect
        this.attemptReconnect(url);
      };
    } catch (error) {
      // Use offline mode when connection fails
      console.log("Using offline mode due to connection error");
      this.notifyListeners("connection_status", {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      console.log(
        `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
      );

      this.reconnectTimeout = setTimeout(() => {
        this.connect(url);
      }, delay);
    } else {
      console.error("Max reconnect attempts reached");
      this.notifyListeners("connection_status", {
        connected: false,
        error: "Failed to connect after multiple attempts",
      });
    }
  }

  disconnect() {
    console.log("Disconnecting from mock WebSocket service");
    this.ws = null;
    return true;
  }

  getConnectionStatus() {
    return this.ws !== null;
  }

  addListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const listeners = this.listeners.get(event)!;
    listeners.add(callback);
    return () => this.removeListener(event, callback);
  }

  removeListener(event: string, callback: Function) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event)!;
      listeners.delete(callback);
    }
  }

  notifyListeners(event: string, data: any) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event)!;
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Mock methods for upload operations
  pauseUpload(fileId: string) {
    console.log(`Mock pause upload for file ${fileId}`);
    setTimeout(() => {
      this.notifyListeners("upload_status", { fileId, status: "paused" });
    }, 500);
    return true;
  }

  resumeUpload(fileId: string) {
    console.log(`Mock resume upload for file ${fileId}`);
    setTimeout(() => {
      this.notifyListeners("upload_status", { fileId, status: "uploading" });
      // Simulate completion after a delay
      setTimeout(() => {
        this.notifyListeners("upload_status", { fileId, status: "completed" });
      }, 2000);
    }, 500);
    return true;
  }

  cancelUpload(fileId: string) {
    console.log(`Mock cancel upload for file ${fileId}`);
    setTimeout(() => {
      this.notifyListeners("upload_status", { fileId, status: "cancelled" });
    }, 500);
    return true;
  }

  requestUpload(fileInfo: {
    fileId?: string;
    name: string;
    size: number;
    type: string;
    priority?: "high" | "normal" | "low";
  }) {
    const uploadRequest = {
      fileId: fileInfo.fileId || uuidv4(),
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      priority: fileInfo.priority || "normal",
    };

    return this.notifyListeners("upload_request", uploadRequest);
  }

  sendMessage(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    } else {
      console.warn("WebSocket not connected, message not sent:", data);
      // Store message to send when connection is established
      this.notifyListeners(data.type, data);
      return false;
    }
  }

  // Request upload slot from server
  requestUploadSlot(file: FileUpload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, cannot request upload slot");
      return false;
    }

    const message = {
      type: "upload_request",
      fileId: file.fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      priority: file.priority,
    };

    this.ws.send(JSON.stringify(message));
    return true;
  }

  // Update queue order
  updateQueueOrder(
    queue: Array<{ fileId: string; priority: "high" | "normal" | "low" }>
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, can't update queue order");
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "update_queue_order",
        queue: queue,
      })
    );
  }

  // Listen for queue updates from server
  listenForQueueUpdates(callback: (queue: FileUpload[]) => void) {
    return this.addListener("queue_update", callback);
  }
}

export default new WebSocketService();
