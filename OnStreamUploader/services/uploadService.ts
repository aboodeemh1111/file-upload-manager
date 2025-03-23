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
    console.error("Error fetching file data:", error);
    throw error;
  }
};

class UploadService {
  uploadQueue: FileUpload[] = [];
  activeUploads: Map<string, { task: any; file: FileUpload }> = new Map();
  private maxConcurrentUploads = 3; // Allow 3 concurrent uploads
  private serverUrl = "http://localhost:3000"; // Update with your server URL
  private uploadListeners: Set<(queue: FileUpload[]) => void> = new Set();
  private isProcessing: boolean = false;

  // Add a lock mechanism to prevent race conditions
  private queueLock: boolean = false;
  private lockTimeout: number = 5000; // 5 seconds max lock time
  private lockAcquiredTime: number = 0;

  // Wait for the lock to be released
  private async waitForLock(timeout = 1000): Promise<boolean> {
    const startTime = Date.now();

    // Auto-release lock if it's been held too long (deadlock prevention)
    if (
      this.queueLock &&
      Date.now() - this.lockAcquiredTime > this.lockTimeout
    ) {
      console.warn("Force releasing lock due to timeout");
      this.queueLock = false;
    }

    while (this.queueLock) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (Date.now() - startTime > timeout) {
        console.warn("Lock wait timeout exceeded");
        return false;
      }
    }
    return true;
  }

  // Acquire the lock
  private async acquireLock(): Promise<boolean> {
    if (await this.waitForLock()) {
      this.queueLock = true;
      this.lockAcquiredTime = Date.now();
      return true;
    }
    return false;
  }

  // Release the lock
  private releaseLock() {
    this.queueLock = false;
  }

  constructor() {
    // Try to restore queue from storage on initialization
    this.restoreQueue();

    // Set up periodic queue state saving
    setInterval(() => {
      this.saveQueue();
    }, 5000); // Save every 5 seconds
  }

  // Save queue state to storage
  private saveQueue() {
    try {
      const queueToSave = this.uploadQueue.filter(
        (file) =>
          file.status !== "completed" ||
          Date.now() - new Date(file.addedAt).getTime() < 24 * 60 * 60 * 1000
      );

      if (queueToSave.length > 0) {
        console.log(
          `📝 Saved queue state with ${queueToSave.length} active items`
        );
        localStorage.setItem("uploadQueue", JSON.stringify(queueToSave));
      }
    } catch (error) {
      console.error("Error saving queue state:", error);
    }
  }

  // Restore queue from storage
  private restoreQueue() {
    try {
      const savedQueue = localStorage.getItem("uploadQueue");
      if (savedQueue) {
        const parsedQueue = JSON.parse(savedQueue) as FileUpload[];
        if (Array.isArray(parsedQueue) && parsedQueue.length > 0) {
          console.log(
            `📝 Restored ${parsedQueue.length} items from saved queue`
          );
          this.uploadQueue = parsedQueue;

          // Resume uploads for any files that were in progress
          const filesToResume = parsedQueue.filter(
            (file) => file.status === "uploading" || file.status === "queued"
          );

          if (filesToResume.length > 0) {
            console.log(
              `🔄 Resuming uploads for ${filesToResume.length} files`
            );
            setTimeout(() => this.processQueue(), 1000);
          }
        }
      }
    } catch (error) {
      console.error("Error restoring queue:", error);
    }
  }

  async addToQueue(file: FileUpload): Promise<void> {
    try {
      if (!(await this.acquireLock())) {
        console.error("Failed to acquire lock for adding to queue");
        return;
      }

      // Check if file is already in queue
      const existingIndex = this.uploadQueue.findIndex(
        (f) => f.fileId === file.fileId
      );

      if (existingIndex !== -1) {
        console.log(`File ${file.name} already in queue, updating`);
        this.uploadQueue[existingIndex] = {
          ...this.uploadQueue[existingIndex],
          ...file,
        };
      } else {
        console.log(`Adding file to queue: ${file.name}`);
        this.uploadQueue.push(file);
      }

      this.notifyListeners();

      if (!this.isProcessing) {
        this.processQueue();
      }
    } finally {
      this.releaseLock();
    }
  }

  // Add multiple files to the queue
  async addFilesToQueue(
    files: Array<{ uri: string; name: string; size: number; type: string }>,
    priority: "high" | "normal" | "low" = "normal"
  ): Promise<FileUpload[]> {
    try {
      if (!(await this.acquireLock())) {
        console.error("Failed to acquire lock for adding multiple files");
        return [];
      }

      console.log(`Adding files to queue: ${files.length}`);

      const filesToAdd: FileUpload[] = files.map((file) => ({
        fileId: uuidv4(),
        uri: file.uri,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "queued",
        progress: 0,
        priority: priority,
        addedAt: new Date().toISOString(),
        error: null,
        retryCount: 0,
      }));

      // Add new files to the queue
      this.uploadQueue = [...this.uploadQueue, ...filesToAdd];

      console.log(`Queue after adding files: ${this.uploadQueue.length}`);

      // Notify about the updated queue
      this.notifyListeners();

      // Start processing the queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }

      return filesToAdd;
    } finally {
      this.releaseLock();
    }
  }

  // Remove a file from the queue
  async removeFromQueue(fileId: string): Promise<boolean> {
    try {
      await this.waitForLock();
      this.queueLock = true;
      this.lockAcquiredTime = Date.now();

      // Cancel the upload if it's active
      if (this.activeUploads.has(fileId)) {
        const { task } = this.activeUploads.get(fileId)!;
        if (task && typeof task.cancel === "function") {
          task.cancel();
        }
        this.activeUploads.delete(fileId);
      }

      // Remove from queue
      const initialLength = this.uploadQueue.length;
      this.uploadQueue = this.uploadQueue.filter(
        (file) => file.fileId !== fileId
      );

      this.notifyListeners();
      this.queueLock = false;

      return this.uploadQueue.length < initialLength;
    } catch (error) {
      this.queueLock = false;
      console.error("Error removing from queue:", error);
      return false;
    }
  }

  async processQueue(): Promise<void> {
    if (!(await this.acquireLock())) {
      console.error("Failed to acquire lock for processing queue");
      return;
    }

    try {
      if (this.isProcessing) {
        return;
      }

      this.isProcessing = true;

      // Process until no more files to upload or max concurrent uploads reached
      while (
        this.uploadQueue.length > 0 &&
        this.activeUploads.size < this.maxConcurrentUploads
      ) {
        // Find the next file to upload (that isn't already being uploaded)
        const nextFile = this.uploadQueue.find(
          (file) =>
            (file.status === "queued" || file.status === "failed") &&
            !this.activeUploads.has(file.fileId)
        );

        if (!nextFile) {
          console.log("No more files to upload in the queue");
          break;
        }

        // Start uploading this file
        nextFile.status = "uploading";
        this.startUpload(nextFile);

        // Update the queue and notify listeners
        this.notifyListeners();
      }
    } finally {
      this.isProcessing = false;
      this.releaseLock();
    }
  }

  // Start uploading a file
  async startUpload(file: FileUpload) {
    console.log(`Starting upload for ${file.name}...`);

    try {
      // Update file status to uploading
      const fileIndex = this.uploadQueue.findIndex(
        (f) => f.fileId === file.fileId
      );
      if (fileIndex !== -1) {
        this.uploadQueue[fileIndex].status = "uploading";
        this.uploadQueue[fileIndex].progress = 0;
        this.notifyListeners();
      } else {
        console.error(`File ${file.name} not found in queue`);
        return;
      }

      // Start the actual upload
      await this.uploadFile(file);
    } catch (error) {
      console.error(`Error starting upload for ${file.name}:`, error);

      // Update file status to failed
      const fileIndex = this.uploadQueue.findIndex(
        (f) => f.fileId === file.fileId
      );
      if (fileIndex !== -1) {
        this.uploadQueue[fileIndex].status = "failed";
        this.uploadQueue[fileIndex].error =
          error instanceof Error ? error.message : String(error);
        this.notifyListeners();
      }

      // Remove from active uploads
      this.activeUploads.delete(file.fileId);

      // Try to process the next file
      this.processQueue();
    }
  }

  // Update progress for a file
  async updateProgress(fileId: string, progress: number) {
    try {
      if (!(await this.acquireLock())) {
        return;
      }

      console.log(`📊 Updating progress for ${fileId}: ${progress}%`);

      // Find the file in the queue
      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === fileId
      );

      if (fileIndex !== -1) {
        // Update progress
        this.uploadQueue[fileIndex].progress = progress;

        // Notify listeners
        this.notifyListeners();
      } else {
        console.error(
          `⚠️ Tried to update progress for file ${fileId} but it was not found in queue`
        );

        // Check if it's in active uploads but not in queue (race condition)
        if (this.activeUploads.has(fileId)) {
          console.error(
            `File ${fileId} is marked as active but not found in queue! Attempting to restore it.`
          );

          // Get the file from active uploads and add it back to queue
          const { file } = this.activeUploads.get(fileId)!;
          file.progress = progress;

          // Add it back to the queue
          this.uploadQueue.push(file);
          console.log(`⚠️ File was removed from queue, re-adding it`);

          this.notifyListeners();
        }
      }
    } finally {
      this.releaseLock();
    }
  }

  // Mark a file as complete
  async completeUpload(fileId: string, downloadUrl?: string) {
    try {
      if (!(await this.acquireLock())) {
        return;
      }

      console.log(`✅ Upload complete for: ${fileId}`);

      // Find the file in the queue
      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === fileId
      );

      if (fileIndex !== -1) {
        // Update status and progress
        this.uploadQueue[fileIndex].status = "completed";
        this.uploadQueue[fileIndex].progress = 100;
        if (downloadUrl) {
          this.uploadQueue[fileIndex].downloadUrl = downloadUrl;
        }

        // Notify listeners
        this.notifyListeners();
      } else {
        // Instead of just logging a warning, try to find the file in active uploads
        if (this.activeUploads.has(fileId)) {
          const { file } = this.activeUploads.get(fileId)!;
          file.status = "completed";
          file.progress = 100;
          if (downloadUrl) {
            file.downloadUrl = downloadUrl;
          }

          // Add it back to the queue
          this.uploadQueue.push(file);

          // Notify listeners
          this.notifyListeners();
        } else {
          // Clean up the tracking if we can't restore it
          console.warn(
            `File ${fileId} not found in queue or active uploads when completing`
          );
        }
      }

      // Remove from active uploads
      this.activeUploads.delete(fileId);

      // Process the next file in queue
      this.processQueue();
    } finally {
      this.releaseLock();
    }
  }

  // Upload a file to Firebase Storage
  async uploadFile(file: FileUpload): Promise<string> {
    try {
      console.log(`Starting upload for file: ${file.name}`);

      // Fetch the file data
      const fileData = await fetchFileData(file.uri);

      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `uploads/${file.fileId}/${file.name}`);

      // Start the upload
      const uploadTask = uploadBytesResumable(storageRef, fileData);

      // Track the upload task
      this.activeUploads.set(file.fileId, { task: uploadTask, file });

      // Return a promise that resolves when the upload is complete
      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            // Calculate progress
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );

            // Update progress
            this.updateProgress(file.fileId, progress);
          },
          (error) => {
            // Handle upload error
            console.error(`Error uploading ${file.name}:`, error);

            // Update file status to failed
            const fileIndex = this.uploadQueue.findIndex(
              (f) => f.fileId === file.fileId
            );
            if (fileIndex !== -1) {
              this.uploadQueue[fileIndex].status = "failed";
              this.uploadQueue[fileIndex].error = error.message;
            }

            // Remove from active uploads
            this.activeUploads.delete(file.fileId);

            // Notify listeners
            this.notifyListeners();

            // Reject the promise
            reject(error);
          },
          async () => {
            try {
              // Upload completed successfully, get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              // Mark as complete
              await this.completeUpload(file.fileId, downloadURL);

              // Resolve the promise with the download URL
              resolve(downloadURL);
            } catch (urlError) {
              console.error(
                `Error getting download URL for ${file.name}:`,
                urlError
              );

              // Update file status to failed
              const fileIndex = this.uploadQueue.findIndex(
                (f) => f.fileId === file.fileId
              );
              if (fileIndex !== -1) {
                this.uploadQueue[fileIndex].status = "failed";
                this.uploadQueue[fileIndex].error =
                  urlError instanceof Error
                    ? urlError.message
                    : String(urlError);
              }

              reject(urlError);
            }
          }
        );
      });
    } catch (error) {
      console.error(`Error in uploadFile for ${file.name}:`, error);

      // Update file status to failed with proper error handling
      const fileIndex = this.uploadQueue.findIndex(
        (f) => f.fileId === file.fileId
      );
      if (fileIndex !== -1) {
        this.uploadQueue[fileIndex].status = "failed";
        this.uploadQueue[fileIndex].error =
          error instanceof Error ? error.message : String(error); // Convert to string if not an Error object
      }

      throw error;
    }
  }

  // Notify all listeners of queue changes
  private notifyListeners(): void {
    this.uploadListeners.forEach((listener) => {
      listener([...this.uploadQueue]);
    });

    // Also update the WebSocket service
    websocketService.updateQueue(this.uploadQueue);
  }

  // Subscribe to queue changes
  subscribeToQueue(callback: (queue: FileUpload[]) => void): () => void {
    this.uploadListeners.add(callback);
    callback([...this.uploadQueue]);

    return () => {
      this.uploadListeners.delete(callback);
    };
  }

  // Add this method to the UploadService class
  getQueue(): FileUpload[] {
    return [...this.uploadQueue];
  }

  // Update priority of a file in the queue
  async updatePriority(
    fileId: string,
    priority: "high" | "normal" | "low"
  ): Promise<boolean> {
    try {
      await this.waitForLock();
      this.queueLock = true;

      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === fileId
      );
      if (fileIndex === -1) return false;

      this.uploadQueue[fileIndex].priority = priority;
      this.notifyListeners();
      this.queueLock = false;
      return true;
    } catch (error) {
      this.queueLock = false;
      return false;
    }
  }

  // Pause an upload
  async pauseUpload(fileId: string): Promise<void> {
    const upload = this.activeUploads.get(fileId);
    if (upload?.task?.pause) {
      upload.task.pause();

      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === fileId
      );
      if (fileIndex !== -1) {
        this.uploadQueue[fileIndex].status = "paused";
        this.notifyListeners();
      }
    }
  }

  // Resume an upload
  async resumeUpload(fileId: string): Promise<void> {
    const upload = this.activeUploads.get(fileId);
    if (upload?.task?.resume) {
      upload.task.resume();

      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === fileId
      );
      if (fileIndex !== -1) {
        this.uploadQueue[fileIndex].status = "uploading";
        this.notifyListeners();
      }
    }
  }

  // Cancel an upload
  async cancelUpload(fileId: string): Promise<boolean> {
    return this.removeFromQueue(fileId);
  }

  // Retry a failed upload
  async retryUpload(fileId: string): Promise<boolean> {
    const fileIndex = this.uploadQueue.findIndex(
      (file) => file.fileId === fileId
    );
    if (fileIndex === -1) return false;

    this.uploadQueue[fileIndex].status = "queued";
    this.uploadQueue[fileIndex].error = null;
    this.notifyListeners();
    this.processQueue();
    return true;
  }
}

export default new UploadService();
