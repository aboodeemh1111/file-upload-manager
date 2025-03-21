import * as FileSystem from "expo-file-system";
import { v4 as uuidv4 } from "uuid";
import websocketService from "./websocketService";
import { FileUpload } from "@/types/FileUpload";
import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

class UploadService {
  private uploadQueue: FileUpload[] = [];
  private currentUpload: FileUpload | null = null;
  private isUploading = false;
  private serverUrl = "http://localhost:3000"; // Update with your server URL

  constructor() {
    // Initialize listeners for WebSocket events
    websocketService.addListener(
      "upload_status",
      this.handleStatusUpdate.bind(this)
    );
  }

  private handleStatusUpdate(data: {
    fileId: string;
    status: string;
    error?: string;
  }) {
    const fileIndex = this.uploadQueue.findIndex(
      (file) => file.fileId === data.fileId
    );

    if (fileIndex !== -1) {
      this.uploadQueue[fileIndex].status = data.status as any;
      if (data.error) {
        this.uploadQueue[fileIndex].error = data.error;
      }

      if (data.status === "completed") {
        // If the current upload is completed, process the next file
        if (this.currentUpload?.fileId === data.fileId) {
          this.currentUpload = null;
          this.isUploading = false;
          this.processQueue();
        }
      }
    }
  }

  getQueue(): FileUpload[] {
    return [...this.uploadQueue];
  }

  addToQueue(
    files: Array<{ uri: string; name: string; size: number; type: string }>,
    priority: "high" | "normal" | "low" = "normal"
  ): FileUpload[] {
    const newFiles = files.map((file) => ({
      ...file,
      fileId: uuidv4(),
      status: "queued" as const,
      progress: 0,
      priority,
      error: null,
      retryCount: 0,
    }));

    this.uploadQueue = [...this.uploadQueue, ...newFiles];

    if (!this.isUploading) {
      this.processQueue();
    }

    return newFiles;
  }

  removeFromQueue(fileId: string): boolean {
    const index = this.uploadQueue.findIndex((file) => file.fileId === fileId);

    if (index !== -1) {
      this.uploadQueue.splice(index, 1);
      return true;
    }

    return false;
  }

  updatePriority(fileId: string, priority: "high" | "normal" | "low"): boolean {
    const file = this.uploadQueue.find((file) => file.fileId === fileId);

    if (file) {
      file.priority = priority;
      // Re-sort queue based on priority
      this.sortQueue();
      return true;
    }

    return false;
  }

  private sortQueue() {
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    this.uploadQueue.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async processQueue() {
    if (this.isUploading || this.uploadQueue.length === 0) {
      return;
    }

    this.isUploading = true;
    this.sortQueue();

    this.currentUpload = this.uploadQueue[0];
    this.currentUpload.status = "uploading";

    try {
      // Request upload from server via WebSocket
      websocketService.requestUpload(this.currentUpload);

      // Start the actual file upload
      await this.uploadFile(new Blob([this.currentUpload.uri]), {
        fileId: this.currentUpload.fileId,
      });
    } catch (error: unknown) {
      console.error("Upload failed:", error);

      if (this.currentUpload) {
        this.currentUpload.status = "failed";
        this.currentUpload.error =
          error instanceof Error ? error.message : String(error);

        // Retry logic
        if (this.currentUpload.retryCount < 3) {
          this.currentUpload.retryCount++;
          this.currentUpload.status = "queued";
          setTimeout(() => {
            this.isUploading = false;
            this.processQueue();
          }, 3000); // Wait 3 seconds before retrying
        } else {
          // Move to the end of the queue after max retries
          const failedFile = this.uploadQueue.shift();
          if (failedFile) {
            this.uploadQueue.push(failedFile);
          }

          this.isUploading = false;
          this.currentUpload = null;
          this.processQueue();
        }
      }
    }
  }

  async uploadFile(file: File | Blob, options: any = {}) {
    return new Promise((resolve, reject) => {
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;

        // Notify about progress
        websocketService.notifyListeners("upload_progress", {
          fileId: options.fileId,
          progress,
          loaded: (progress * file.size) / 100,
          total: file.size,
        });

        if (progress >= 100) {
          clearInterval(interval);
          resolve({
            success: true,
            url: "https://example.com/mock-upload-url",
            name: "name" in file ? file.name : "uploaded-file",
            size: file.size,
            type: file.type,
          });
        }
      }, 500);
    });
  }

  pauseUpload(fileId: string) {
    const file = this.uploadQueue.find((f) => f.fileId === fileId);
    if (file) {
      file.status = "paused";
      websocketService.pauseUpload(fileId);

      if (this.currentUpload?.fileId === fileId) {
        this.isUploading = false;
        this.currentUpload = null;
        // Process next file in queue
        this.processQueue();
      }
    }
  }

  resumeUpload(fileId: string) {
    const file = this.uploadQueue.find((f) => f.fileId === fileId);
    if (file) {
      file.status = "queued";
      websocketService.resumeUpload(fileId);

      if (!this.isUploading) {
        this.processQueue();
      }
    }
  }

  cancelUpload(fileId: string): boolean {
    if (this.currentUpload?.fileId === fileId) {
      // Cancel current upload
      websocketService.cancelUpload(fileId);
      this.isUploading = false;
      this.currentUpload = null;
      this.removeFromQueue(fileId);
      this.processQueue();
      return true;
    } else {
      // Remove from queue
      return this.removeFromQueue(fileId);
    }
  }

  retryUpload(fileId: string): boolean {
    const file = this.uploadQueue.find((f) => f.fileId === fileId);
    if (file && file.status === "failed") {
      file.status = "queued";
      file.error = null;

      if (!this.isUploading) {
        this.processQueue();
      }
      return true;
    }
    return false;
  }

  updateProgress(fileId: string, progress: number) {
    const file = this.uploadQueue.find((f) => f.fileId === fileId);
    if (file) {
      file.progress = progress;
    }
  }

  completeUpload(fileId: string) {
    this.removeFromQueue(fileId);
  }

  failUpload(fileId: string, errorMessage: string) {
    const file = this.uploadQueue.find((f) => f.fileId === fileId);
    if (file) {
      file.status = "failed";
      file.error = errorMessage;
    }
  }
}

export default new UploadService();

// First uploadFile function (mock implementation)
export const mockUploadFile = async (file: File | Blob, metadata?: any) => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Return a mock successful response
  return {
    success: true,
    url: "https://example.com/mock-upload-url",
    name:
      typeof file === "object" && "name" in file ? file.name : "uploaded-file",
    size: file.size,
    type: file.type,
    metadata,
  };
};

// Initialize Firebase with your config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: "onstream-6a46b.appspot.com", // Use your actual bucket
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Update the uploadFile function to use Firebase
export const uploadFile = async (file: FileUpload): Promise<string> => {
  console.log(`Starting upload process for ${file.name}`);

  try {
    console.log(`Beginning Firebase upload for ${file.name}`);

    // Start the real upload to Firebase
    const downloadURL = await uploadToFirebase(file, (progress) => {
      console.log(
        `Firebase upload progress for ${file.name}: ${progress.toFixed(1)}%`
      );

      // Use the default export instead of uploadService
      const uploadServiceInstance = require("./uploadService").default;
      uploadServiceInstance.updateProgress(file.fileId, progress);

      // Notify listeners about progress
      notifyProgressListeners(file.fileId, progress);
    });

    console.log(`Firebase upload completed for ${file.name}`);

    // Use the default export
    const uploadServiceInstance = require("./uploadService").default;
    uploadServiceInstance.completeUpload(file.fileId);

    // Notify listeners about completion
    notifyStatusListeners(file.fileId, "completed");

    return downloadURL;
  } catch (error: unknown) {
    console.error(`Error in uploadFile for ${file.name}:`, error);

    // Use the default export
    const uploadServiceInstance = require("./uploadService").default;

    // Check if error is an Error object with a message property
    const errorMessage = error instanceof Error ? error.message : String(error);
    uploadServiceInstance.failUpload(file.fileId, errorMessage);

    // Notify listeners about failure
    notifyStatusListeners(file.fileId, "failed", errorMessage);

    throw error;
  }
};

// Add this function to your uploadService.ts file
const uploadToFirebase = async (
  file: FileUpload,
  onProgress: (progress: number) => void
): Promise<string> => {
  // Get the file data as a blob
  const response = await fetch(file.uri);
  const blob = await response.blob();

  // Create a storage reference
  const storageRef = ref(storage, `uploads/${file.fileId}-${file.name}`);

  // Start the upload
  const uploadTask = uploadBytesResumable(storageRef, blob);

  return new Promise((resolve, reject) => {
    // Listen for state changes, errors, and completion
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        // Get upload progress
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      (error) => {
        // Handle errors
        reject(error);
      },
      async () => {
        // Handle successful upload
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};

// Add these helper functions for notifying listeners
const notifyProgressListeners = (fileId: string, progress: number) => {
  websocketService.notifyListeners("upload_progress", {
    fileId,
    progress,
  });
};

const notifyStatusListeners = (
  fileId: string,
  status: string,
  error?: string
) => {
  websocketService.notifyListeners("upload_status", {
    fileId,
    status,
    error,
  });
};
