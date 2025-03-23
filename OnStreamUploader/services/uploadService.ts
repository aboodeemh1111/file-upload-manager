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
import { storage } from "../config/firebase";
import { Platform } from "react-native";

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
      // Update the file status but keep it in the queue
      this.uploadQueue[fileIndex].status = data.status as any;
      if (data.error) {
        this.uploadQueue[fileIndex].error = data.error;
      }

      // Only reset the current upload if it's completed or failed
      if (data.status === "completed" || data.status === "failed") {
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
      await this.uploadFile(this.currentUpload, {
        onProgress: (progress) => {
          this.currentUpload!.progress = progress;
          websocketService.updateUploadProgress(
            this.currentUpload!.fileId,
            progress
          );
        },
        onError: (error) => {
          this.currentUpload!.status = "failed";
          this.currentUpload!.error =
            error instanceof Error ? error.message : String(error);
        },
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

  async uploadFile(
    file: FileUpload,
    options?: {
      onProgress?: (progress: number) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<any> {
    console.log(`Starting upload for ${file.name} to Firebase`);

    try {
      // Get file data
      const fileData = await fetchFileData(file.uri);

      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `uploads/${file.fileId}/${file.name}`);

      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, fileData);

      return new Promise((resolve, reject) => {
        // Track the highest progress value we've seen
        let highestProgress = 0;

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            // Calculate upload progress
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );

            console.log(
              `Firebase upload progress for ${file.name}: ${progress}%`
            );

            // Only update progress if it's higher than what we've seen before
            if (progress > highestProgress) {
              highestProgress = progress;
              // Call the onProgress callback if provided
              if (options?.onProgress) {
                options.onProgress(progress);
              }
            }
          },
          (error) => {
            console.error(`Error in uploadFile for ${file.name}:`, error);
            if (options?.onError) {
              options.onError(error as Error);
            }
            reject(error);
          },
          async () => {
            console.log(`Firebase upload completed for ${file.name}`);

            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Return file info
            resolve({
              url: downloadURL,
              size: uploadTask.snapshot.totalBytes,
              type: file.type,
              name: file.name,
            });
          }
        );
      });
    } catch (error) {
      console.error(`Error in uploadFile for ${file.name}:`, error);
      if (options?.onError) {
        options.onError(error as Error);
      }
      throw error;
    }
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

// Update the uploadFile function to use Firebase
export const uploadFile = async (
  file: FileUpload,
  options?: {
    onProgress?: (progress: number) => void;
    onError?: (error: Error) => void;
  }
): Promise<any> => {
  console.log(`Starting upload for ${file.name} to Firebase`);

  try {
    // Get file data
    const fileData = await fetchFileData(file.uri);

    // Create a reference to the file in Firebase Storage
    const storageRef = ref(storage, `uploads/${file.fileId}/${file.name}`);

    // Create upload task
    const uploadTask = uploadBytesResumable(storageRef, fileData);

    return new Promise((resolve, reject) => {
      // Track the highest progress value we've seen
      let highestProgress = 0;

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate upload progress
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );

          console.log(
            `Firebase upload progress for ${file.name}: ${progress}%`
          );

          // Only update progress if it's higher than what we've seen before
          if (progress > highestProgress) {
            highestProgress = progress;
            // Call the onProgress callback if provided
            if (options?.onProgress) {
              options.onProgress(progress);
            }
          }
        },
        (error) => {
          console.error(`Error in uploadFile for ${file.name}:`, error);
          if (options?.onError) {
            options.onError(error as Error);
          }
          reject(error);
        },
        async () => {
          console.log(`Firebase upload completed for ${file.name}`);

          // Get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Return file info
          resolve({
            url: downloadURL,
            size: uploadTask.snapshot.totalBytes,
            type: file.type,
            name: file.name,
          });
        }
      );
    });
  } catch (error) {
    console.error(`Error in uploadFile for ${file.name}:`, error);
    if (options?.onError) {
      options.onError(error as Error);
    }
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

  // For large files (>10MB), use chunked upload
  if (blob.size > 10 * 1024 * 1024) {
    return uploadLargeFileInChunks(file, blob, onProgress);
  }

  // Regular upload for smaller files
  const storageRef = ref(storage, `uploads/${file.fileId}-${file.name}`);
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

// Add chunked upload implementation
const uploadLargeFileInChunks = async (
  file: FileUpload,
  blob: Blob,
  onProgress: (progress: number) => void
): Promise<string> => {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
  const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
  const storageRef = ref(storage, `uploads/${file.fileId}-${file.name}`);

  // Store upload metadata for resumability
  const metadata = {
    customMetadata: {
      originalName: file.name,
      fileId: file.fileId,
      totalChunks: totalChunks.toString(),
      totalSize: blob.size.toString(),
    },
  };

  let uploadedBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(blob.size, start + CHUNK_SIZE);
    const chunk = blob.slice(start, end);

    // Upload this chunk
    const chunkRef = ref(storage, `uploads/chunks/${file.fileId}-chunk-${i}`);
    const chunkTask = uploadBytesResumable(chunkRef, chunk);

    await new Promise<void>((resolve, reject) => {
      chunkTask.on(
        "state_changed",
        (snapshot) => {
          uploadedBytes = start + snapshot.bytesTransferred;
          const progress = (uploadedBytes / blob.size) * 100;
          onProgress(progress);
        },
        reject,
        resolve
      );
    });
  }

  // All chunks uploaded, create final file
  // In a production app, you'd use a Cloud Function to combine chunks

  // For now, return the URL of the first chunk as a placeholder
  const downloadURL = await getDownloadURL(
    ref(storage, `uploads/chunks/${file.fileId}-chunk-0`)
  );
  return downloadURL;
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

// Helper to determine if a file should be compressed
const shouldCompress = (file: FileUpload): boolean => {
  // Compress images and certain document types
  const compressibleTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  // Don't compress if already small
  if (file.size < 1 * 1024 * 1024) return false; // Skip if < 1MB

  return compressibleTypes.includes(file.type);
};

// Compress file before upload
const compressFile = async (file: FileUpload): Promise<FileUpload> => {
  // For images, use image-manipulation library
  if (file.type.startsWith("image/")) {
    // This would use a library like react-native-image-manipulator
    // For this example, we'll just simulate compression
    return {
      ...file,
      size: Math.floor(file.size * 0.7), // Simulate 30% reduction
      uri: file.uri, // In real implementation, this would be the compressed file URI
    };
  }

  // For other file types, you'd use appropriate compression techniques
  return file;
};

// Modify uploadService.ts to simulate slower uploads in development
let uploadQueue: FileUpload[] = [];
let isUploading = false;

// Add artificial delay for progress updates in development
const SIMULATE_SLOW_UPLOAD = process.env.NODE_ENV === "development";
const PROGRESS_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100];
const STEP_DELAY = 1000; // ms between progress updates

// Process the upload queue
const processQueue = async () => {
  if (isUploading || uploadQueue.length === 0) return;

  isUploading = true;
  const nextFile = uploadQueue.find((file) => file.status === "queued");

  if (!nextFile) {
    isUploading = false;
    return;
  }

  try {
    console.log(`Starting upload for file: ${nextFile.name}`);

    // Update file status to uploading
    nextFile.status = "uploading";
    nextFile.progress = 0;
    websocketService.updateFileStatus(nextFile.fileId, "uploading");

    // Start the upload process
    if (SIMULATE_SLOW_UPLOAD) {
      await simulateSlowUpload(nextFile);
    } else {
      await uploadFile(nextFile, {
        onProgress: (progress) => {
          nextFile.progress = progress;
          websocketService.updateUploadProgress(nextFile.fileId, progress);
        },
        onError: (error) => {
          nextFile.status = "failed";
          nextFile.error =
            error instanceof Error ? error.message : String(error);
        },
      });
    }

    // Continue with next file
    isUploading = false;
    processQueue();
  } catch (error: unknown) {
    console.error(`Error uploading file ${nextFile.name}:`, error);

    // Update file status to failed
    uploadQueue = uploadQueue.map((file) =>
      file.fileId === nextFile.fileId
        ? {
            ...file,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          }
        : file
    );

    websocketService.updateFileStatus(
      nextFile.fileId,
      "failed",
      error instanceof Error ? error.message : String(error)
    );

    // Continue with next file
    isUploading = false;
    processQueue();
  }
};

// Simulate a slow upload with progress updates
const simulateSlowUpload = async (file: FileUpload): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Simulating slow upload for ${file.name}`);

      // Simulate progress updates
      for (const progress of PROGRESS_STEPS) {
        // Update progress
        file.progress = progress;
        console.log(`Upload progress for ${file.name}: ${progress}%`);

        // Notify about progress
        websocketService.updateUploadProgress(file.fileId, progress);

        // Wait before next update
        if (progress < 100) {
          await new Promise((r) => setTimeout(r, STEP_DELAY));
        }
      }

      // Mark as completed
      file.status = "completed";
      file.progress = 100;
      websocketService.updateFileStatus(file.fileId, "completed");

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

// Add this function to fetch file data from a URI
const fetchFileData = async (uri: string): Promise<Blob> => {
  console.log(`Fetching file data from URI: ${uri}`);

  try {
    // For web platform, handle data URIs and remote URLs
    if (Platform.OS === "web") {
      if (uri.startsWith("data:")) {
        // Handle data URI
        const response = await fetch(uri);
        return await response.blob();
      } else {
        // Handle remote URL
        const response = await fetch(uri);
        return await response.blob();
      }
    } else {
      // For native platforms, use FileSystem
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (!fileInfo.exists) {
        throw new Error(`File does not exist at URI: ${uri}`);
      }

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const blob = await new Promise<Blob>((resolve) => {
        const byteCharacters = atob(base64);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);

          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }

          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        resolve(new Blob(byteArrays));
      });

      return blob;
    }
  } catch (error) {
    console.error(`Error fetching file data from URI: ${uri}`, error);
    throw error;
  }
};
