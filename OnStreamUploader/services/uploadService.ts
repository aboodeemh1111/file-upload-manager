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
  completedUploads: FileUpload[] = [];
  activeUploads: Map<string, { task: any; file: FileUpload }> = new Map();
  private maxConcurrentUploads = 3; // Allow 3 concurrent uploads
  private serverUrl = "http://localhost:3000"; // Update with your server URL
  private uploadListeners: Set<(queue: FileUpload[]) => void> = new Set();
  private isProcessing: boolean = false;

  // Add a lock mechanism to prevent race conditions
  private queueLock: boolean = false;
  private lockTimeout: number = 5000; // 5 seconds max lock time
  private lockAcquiredTime: number = 0;

  // Add a stable ID tracking system
  private stableIds = new Set<string>();

  // Add a flag to track if a file is being processed to prevent removal
  private processingFiles: Set<string> = new Set();

  // Wait for the lock to be released
  async waitForLock(maxAttempts = 50): Promise<boolean> {
    let attempts = 0;

    while (this.queueLock && attempts < maxAttempts) {
      // Check for lock timeout
      if (
        this.lockAcquiredTime > 0 &&
        Date.now() - this.lockAcquiredTime > this.lockTimeout
      ) {
        console.warn("Force releasing lock due to timeout");
        this.queueLock = false;
        this.lockAcquiredTime = 0;
        return true;
      }

      // Wait a bit before trying again
      await new Promise((resolve) => setTimeout(resolve, 10));
      attempts++;
    }

    return !this.queueLock;
  }

  // Acquire the lock
  async acquireLock(): Promise<boolean> {
    const lockAcquired = await this.waitForLock();
    if (lockAcquired) {
      this.queueLock = true;
      this.lockAcquiredTime = Date.now();
    }
    return lockAcquired;
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
  private saveQueue(): void {
    try {
      // Only save active uploads to reduce storage size
      const activeUploads = this.uploadQueue.filter(
        (file) => file.status === "uploading" || file.status === "queued"
      );

      // If there are too many items, only save the most recent ones
      const itemsToSave =
        activeUploads.length > 10 ? activeUploads.slice(-10) : activeUploads;

      // Serialize and save
      const queueData = JSON.stringify(itemsToSave);
      localStorage.setItem("uploadQueue", queueData);

      console.log(
        `📝 Saved queue state with ${itemsToSave.length} active items`
      );
    } catch (error) {
      console.error("Error saving queue state:", error);

      // If quota exceeded, try to clear some space
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        try {
          // Remove old data
          localStorage.removeItem("uploadQueue");
          // Try with fewer items
          const minimalQueue = this.uploadQueue
            .filter((file) => file.status === "uploading")
            .slice(-5);
          localStorage.setItem("uploadQueue", JSON.stringify(minimalQueue));
          console.log("Saved minimal queue after quota error");
        } catch (e) {
          console.error("Failed to save even minimal queue:", e);
        }
      }
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

  // Add to queue method with stability tracking
  async addToQueue(files: FileUpload[]): Promise<FileUpload[]> {
    const addedFiles: FileUpload[] = [];

    for (const file of files) {
      // Track this ID as stable
      this.stableIds.add(file.fileId);

      // Add to queue
      this.uploadQueue.push(file);
      addedFiles.push(file);
    }

    // Notify listeners
    this.notifyListeners();

    // Start processing the queue
    this.processQueue();

    return addedFiles;
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

  // Modify the removeFromQueue method to prevent removing files being processed
  async removeFromQueue(fileId: string): Promise<boolean> {
    try {
      await this.waitForLock();
      this.queueLock = true;
      this.lockAcquiredTime = Date.now();

      // Don't remove files that are currently being processed
      if (this.processingFiles.has(fileId)) {
        console.log(`🔒 Prevented removal of file being processed: ${fileId}`);
        this.queueLock = false;
        return false;
      }

      // Find the file in the queue
      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === fileId
      );

      if (fileIndex === -1) return false;

      // Check if this is an active upload in progress
      const isActiveUpload = this.activeUploads.has(fileId);
      const uploadStatus = this.uploadQueue[fileIndex].status;

      // Don't remove files that are currently uploading
      if (isActiveUpload && uploadStatus === "uploading") {
        console.log(`🔒 Prevented removal of active upload: ${fileId}`);
        this.queueLock = false;
        return false;
      }

      // Remove from stable IDs tracking
      this.stableIds.delete(fileId);

      // Cancel the upload if it's active
      if (this.activeUploads.has(fileId)) {
        const upload = this.activeUploads.get(fileId);
        if (upload?.task?.cancel) {
          upload.task.cancel();
        }
        this.activeUploads.delete(fileId);
      }

      // Remove from queue
      this.uploadQueue.splice(fileIndex, 1);

      console.log(`🗑️ Removing from queue: ${fileId}`);
      this.notifyListeners();
      this.queueLock = false;
      return true;
    } catch (error) {
      console.error("Error removing from queue:", error);
      this.queueLock = false;
      return false;
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;

      // Count active uploads
      const activeCount = Array.from(this.activeUploads.values()).filter(
        ({ file }) => file.status === "uploading"
      ).length;

      // If we're at max concurrent uploads, don't start more
      if (activeCount >= this.maxConcurrentUploads) return;

      // Get next queued file
      const nextFile = this.uploadQueue.find(
        (file) => file.status === "queued" || file.status === "paused"
      );

      if (!nextFile) return;

      // Mark file as uploading
      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === nextFile.fileId
      );

      if (fileIndex !== -1) {
        // Update in place without removing from queue
        this.uploadQueue[fileIndex].status = "uploading";
        (this.uploadQueue[fileIndex] as any).startedAt = Date.now();

        // Start the upload
        this.startUpload(nextFile);

        // Notify listeners
        this.notifyListeners();
      }
    } finally {
      this.isProcessing = false;
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

  // Add a new method to ensure file is in queue
  async ensureFileInQueue(fileId: string): Promise<boolean> {
    // Check if file is already in queue
    const fileIndex = this.uploadQueue.findIndex(
      (file) => file.fileId === fileId
    );

    // If file is already in queue, no need to do anything
    if (fileIndex !== -1) {
      return true;
    }

    // If file is not in queue but we have it in activeUploads, restore it
    if (this.activeUploads.has(fileId)) {
      const activeUpload = this.activeUploads.get(fileId);
      if (activeUpload) {
        // Get the current progress from the upload task if available
        let progress = 0;
        if (activeUpload.task) {
          try {
            // Try to get the current progress
            const snapshot = await activeUpload.task;
            if (snapshot && snapshot.bytesTransferred && snapshot.totalBytes) {
              progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
            }
          } catch (error) {
            console.error("Error getting upload progress:", error);
          }
        }

        // Add the file back to the queue
        this.uploadQueue.push({
          ...activeUpload.file,
          progress,
          status: progress === 100 ? "completed" : "uploading",
        });

        console.log(
          `⚠️ Restored file ${fileId} to queue during ensureFileInQueue`
        );

        // Add to stable IDs to prevent future flickering
        this.stableIds.add(fileId);

        // Notify listeners
        this.notifyListeners();
        return true;
      }
    }

    return false;
  }

  // Modify the updateProgress method to mark files as processing
  async updateProgress(fileId: string, progress: number): Promise<void> {
    try {
      await this.waitForLock();
      this.queueLock = true;
      this.lockAcquiredTime = Date.now();

      // Mark this file as being processed
      this.processingFiles.add(fileId);

      // Find the file in the queue
      const fileIndex = this.uploadQueue.findIndex(
        (file) => file.fileId === fileId
      );

      // If file is not in queue but is in stableIds, restore it
      if (fileIndex === -1 && this.stableIds.has(fileId)) {
        console.log(
          `⚠️ Restoring file ${fileId} to queue during progress update`
        );

        // Find the original file data from activeUploads
        const activeUpload = this.activeUploads.get(fileId);
        if (activeUpload) {
          // Re-add the file to the queue with current progress
          this.uploadQueue.push({
            ...activeUpload.file,
            progress,
            status: progress === 100 ? "completed" : "uploading",
          });

          // Update the UI immediately
          this.notifyListeners();
        }
      } else if (fileIndex !== -1) {
        // Update progress for existing file
        this.uploadQueue[fileIndex].progress = progress;

        // Update status if needed
        if (progress === 100) {
          this.uploadQueue[fileIndex].status = "completed";
        } else if (this.uploadQueue[fileIndex].status !== "uploading") {
          this.uploadQueue[fileIndex].status = "uploading";
        }

        // Notify listeners of the update
        this.notifyListeners();
      }

      this.queueLock = false;
    } catch (error) {
      console.error("Error updating progress:", error);
      this.queueLock = false;
    } finally {
      // Always unmark the file as being processed when done
      this.processingFiles.delete(fileId);
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

  // Modify the uploadFile method to use the correct property name
  async uploadFile(file: FileUpload): Promise<void> {
    try {
      console.log(`Starting upload for file: ${file.name}`);

      // Mark file as uploading
      const fileIndex = this.uploadQueue.findIndex(
        (item) => item.fileId === file.fileId
      );

      if (fileIndex !== -1) {
        this.uploadQueue[fileIndex].status = "uploading";
        this.notifyListeners();
      }

      // Get file data
      let fileData: Blob;
      try {
        fileData = await fetchFileData(file.uri);
      } catch (error) {
        console.error(`Error fetching file data for ${file.name}:`, error);
        this.handleUploadError(file.fileId, "Failed to read file data");
        return;
      }

      // Create a storage reference
      const storageRef = ref(storage, `uploads/${file.name}`);

      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, fileData);

      // Store the upload task
      this.activeUploads.set(file.fileId, {
        file,
        task: uploadTask,
      });

      // Add to stable IDs to prevent flickering
      this.stableIds.add(file.fileId);

      // For video files, we need to manually track progress since the events may not fire frequently
      const isVideo = file.name.match(/\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i);

      // Declare progressInterval outside the if block so it's in scope for the cleanup
      let progressInterval: NodeJS.Timeout | null = null;

      if (isVideo) {
        // Set up manual progress tracking for videos
        let lastProgress = 0;
        progressInterval = setInterval(() => {
          if (uploadTask.snapshot) {
            const progress = Math.round(
              (uploadTask.snapshot.bytesTransferred /
                uploadTask.snapshot.totalBytes) *
                100
            );

            // Only update if progress has changed
            if (progress !== lastProgress) {
              lastProgress = progress;
              this.updateProgress(file.fileId, progress);

              // If upload is complete, clear the interval
              if (progress >= 100 && progressInterval) {
                clearInterval(progressInterval as NodeJS.Timeout);
                progressInterval = null;
              }
            }
          }
        }, 500);
      }

      // Listen for state changes
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate progress
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );

          // Update progress in the queue
          this.updateProgress(file.fileId, progress);
        },
        (error) => {
          // Handle errors
          console.error(`Upload error for ${file.name}:`, error);
          this.handleUploadError(file.fileId, error.message || "Upload failed");

          // Clear interval if it was a video
          if (isVideo && progressInterval !== null) {
            clearInterval(progressInterval as NodeJS.Timeout);
          }
        },
        async () => {
          try {
            // Upload completed successfully
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Ensure 100% progress
            this.updateProgress(file.fileId, 100);

            console.log(`✅ Upload complete for: ${file.fileId}`);

            // Notify server about the completed upload
            websocketService.sendMessage({
              type: "upload_complete",
              fileId: file.fileId,
              fileName: file.name,
              downloadURL,
            });

            // Process next file in queue
            this.processQueue();

            // Clear interval if it was a video
            if (isVideo && progressInterval !== null) {
              clearInterval(progressInterval as NodeJS.Timeout);
            }

            // Move to completed uploads after a short delay
            setTimeout(() => {
              // Check if the file is still in the queue (hasn't been removed)
              const currentFileIndex = this.uploadQueue.findIndex(
                (file) => file.fileId === file.fileId
              );

              if (currentFileIndex !== -1) {
                // Move to completed uploads
                const completedFile = this.uploadQueue[currentFileIndex];
                this.completedUploads.push(completedFile);

                // Remove from queue
                this.uploadQueue.splice(currentFileIndex, 1);

                // Notify listeners about the update
                this.notifyListeners();
              }
            }, 1000); // 1 second delay
          } catch (error) {
            console.error(
              `Error getting download URL for ${file.name}:`,
              error
            );
            this.handleUploadError(file.fileId, "Failed to get download URL");
          }
        }
      );
    } catch (error) {
      console.error(`Error starting upload for ${file.name}:`, error);
      this.handleUploadError(file.fileId, "Failed to start upload");
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

  // Add this method to handle upload errors
  private handleUploadError(fileId: string, errorMessage: string): void {
    // Find the file in the queue
    const fileIndex = this.uploadQueue.findIndex(
      (file) => file.fileId === fileId
    );

    if (fileIndex !== -1) {
      // Update the file status and error message
      this.uploadQueue[fileIndex].status = "failed";
      this.uploadQueue[fileIndex].error = errorMessage;

      // Remove from processing files set
      this.processingFiles.delete(fileId);

      // Notify listeners about the update
      this.notifyListeners();

      console.error(`Upload failed for file ${fileId}: ${errorMessage}`);
    }
  }
}

export default new UploadService();
