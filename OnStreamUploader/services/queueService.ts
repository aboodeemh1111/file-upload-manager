import { FileUpload } from "../types/FileUpload";
import { storage } from "../config/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as FileSystem from "expo-file-system";
import * as Sentry from "@sentry/react-native";

// Create a mock for the missing react-native-queue
const queueFactory = {
  async createQueue() {
    return {
      addWorker: (name: string, concurrency: number, worker: Function) => {},
      createJob: (name: string, payload: any, options: any) => {
        return { save: async () => {} };
      },
    };
  },
};

// Rest of your code...

// Fix the type error in the Blob creation function
function dataURItoBlob(dataURI: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const byteString = atob(dataURI.split(",")[1]);
      const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);

      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      const byteArrays: Uint8Array[] = []; // Explicitly type as array of Uint8Array
      const sliceSize = 512;

      for (let offset = 0; offset < byteString.length; offset += sliceSize) {
        const slice = byteString.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);

        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray); // Now correctly typed
      }

      resolve(new Blob(byteArrays, { type: mimeString }));
    } catch (error) {
      Sentry.captureException(error);
      reject(error);
    }
  });
}

const isLocalStorageAvailable = () => {
  try {
    return typeof window !== "undefined" && window.localStorage !== undefined;
  } catch (e) {
    return false;
  }
};

const queueService = {
  queue: [] as FileUpload[],

  // Add a method to handle storage quota issues
  clearStorage() {
    try {
      // Clear only the upload queue data to free up space
      localStorage.removeItem("uploadQueue");
      return true;
    } catch (error: unknown) {
      // Add proper type checking for the error
      Sentry.captureException(error);
      return false;
    }
  },

  // Add a method to compress queue data before saving
  compressQueueData(queue: FileUpload[]) {
    // Create a minimal version of the queue with only essential data
    return queue.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      progress: item.progress,
    }));
  },

  // Modify your saveQueue method to handle quota errors
  saveQueue() {
    try {
      // Check if localStorage is available
      if (!isLocalStorageAvailable()) {
        console.log("localStorage not available, skipping queue save");
        return;
      }

      // Create a serializable version of the queue
      const serializableQueue = this.queue.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.type,
        status: item.status,
        progress: item.progress,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        downloadUrl: item.downloadUrl,
      }));

      // Save to localStorage
      localStorage.setItem("uploadQueue", JSON.stringify(serializableQueue));
      console.log(
        `📝 Saved queue state with ${this.queue.length} active items`
      );
    } catch (error) {
      console.error("Failed to save queue:", error);
    }
  },

  loadQueue() {
    try {
      // Check if localStorage is available
      if (!isLocalStorageAvailable()) {
        console.log("localStorage not available, skipping queue load");
        return;
      }

      const savedQueue = localStorage.getItem("uploadQueue");
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue);
        console.log(`📝 Loaded queue with ${this.queue.length} items`);
      }
    } catch (error) {
      console.error("Failed to load queue:", error);
    }
  },
};

export default queueService;
