import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import uploadService, { uploadFile } from "../services/uploadService";
import { FileUpload } from "@/types/FileUpload";
import websocketService, {
  UploadProgressData,
  UploadStatusData,
  ConnectionStatusData,
} from "../services/websocketService";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { v4 as uuidv4 } from "uuid";

interface UploadContextType {
  uploadQueue: FileUpload[];
  completedUploads: FileUpload[];
  isConnected: boolean;
  connectionError: string | null;
  addToQueue: (
    files: Array<{ uri: string; name: string; size: number; type: string }>,
    priority?: "high" | "normal" | "low"
  ) => FileUpload[];
  removeFromQueue: (fileId: string) => boolean;
  updatePriority: (
    fileId: string,
    priority: "high" | "normal" | "low"
  ) => boolean;
  pauseUpload: (fileId: string) => void;
  resumeUpload: (fileId: string) => void;
  cancelUpload: (fileId: string) => boolean;
  pickDocument: () => Promise<void>;
  pickImage: () => Promise<void>;
  pickVideo: () => Promise<void>;
  retryUpload: (fileId: string) => boolean;
  reorderQueue: (
    fileId: string,
    newPosition: number,
    newPriority?: "high" | "normal" | "low"
  ) => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
};

const SERVER_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3000";

export const UploadProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [uploadQueue, setUploadQueue] = useState<FileUpload[]>([]);
  const [completedUploads, setCompletedUploads] = useState<FileUpload[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to WebSocket server
    websocketService.connect(WS_URL);

    // Listen for connection status changes
    const unsubscribe = websocketService.addListener(
      "connection_status",
      (data: ConnectionStatusData) => {
        setIsConnected(data.connected);
        setConnectionError(data.error);

        // If connection fails, use local mode
        if (!data.connected && data.error) {
          console.log("Using local mode due to connection error:", data.error);
        }
      }
    );

    return () => {
      unsubscribe();
      websocketService.disconnect();
    };
  }, []);

  // Optimize the interval for queue updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentQueue = uploadService.getQueue();
      // Only update state if the queue has actually changed
      setUploadQueue((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(currentQueue)) {
          return [...currentQueue];
        }
        return prev;
      });
    }, 2000); // Increase interval to 2 seconds to reduce updates

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Listen for upload progress updates from Firebase
    const unsubscribe = websocketService.addListener(
      "upload_progress",
      (data: UploadProgressData) => {
        setUploadQueue((prev) =>
          prev.map((file) =>
            file.fileId === data.fileId
              ? { ...file, progress: data.progress }
              : file
          )
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Listen for upload status updates
    const unsubscribe = websocketService.addListener(
      "upload_status",
      (data: UploadStatusData) => {
        console.log(
          `Received status update for ${data.fileId}: ${data.status}`
        );

        if (data.status === "completed") {
          // Update the file status first to trigger animation
          setUploadQueue((prev) =>
            prev.map((file) =>
              file.fileId === data.fileId
                ? { ...file, status: "completed", progress: 100 }
                : file
            )
          );

          // Delay removal to allow animation to complete
          setTimeout(() => {
            setUploadQueue((prev) => {
              const file = prev.find((f) => f.fileId === data.fileId);
              if (file) {
                // Add to completed uploads
                setCompletedUploads((current) => [
                  ...current,
                  {
                    ...file,
                    status: "completed" as const,
                    progress: 100,
                  },
                ]);
                // Remove from queue
                return prev.filter((f) => f.fileId !== data.fileId);
              }
              return prev;
            });
          }, 500); // Delay matches animation duration
        } else {
          // Update status for other statuses
          setUploadQueue((prev) =>
            prev.map((file) =>
              file.fileId === data.fileId
                ? {
                    ...file,
                    status: data.status as
                      | "uploading"
                      | "queued"
                      | "paused"
                      | "failed",
                    error: data.error || null,
                  }
                : file
            )
          );
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for queue updates from server
  useEffect(() => {
    const unsubscribe = websocketService.listenForQueueUpdates(
      (serverQueue) => {
        console.log("Received queue update from server:", serverQueue);
        // Update local queue to match server queue
        setUploadQueue(serverQueue);
      }
    );

    return () => unsubscribe();
  }, []);

  // Add this function to directly upload files
  const uploadFileToFirebase = async (file: FileUpload) => {
    try {
      // Update file status
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.fileId === file.fileId ? { ...f, status: "uploading" } : f
        )
      );

      console.log("Starting upload for file:", file.name);

      const url = await uploadFile(file);
      console.log(`Upload complete for ${file.name}, URL:`, url);
      setCompletedUploads((prev) => [
        ...prev,
        {
          ...file,
          status: "completed" as const,
          progress: 100,
        },
      ]);
      setUploadQueue((prev) => prev.filter((f) => f.fileId !== file.fileId));
    } catch (error: any) {
      console.error(`Upload error for ${file.name}:`, error);
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.fileId === file.fileId
            ? { ...f, status: "failed" as const, error: error.message }
            : f
        )
      );
    }
  };

  // Memoize functions to prevent unnecessary re-renders
  const addToQueue = useCallback(
    (
      files: Array<{ uri: string; name: string; size: number; type: string }>,
      priority: "high" | "normal" | "low" = "normal"
    ) => {
      console.log("Adding files to queue:", files.length);

      // Create FileUpload objects
      const fileUploads: FileUpload[] = files.map((file) => ({
        fileId: uuidv4(),
        uri: file.uri,
        name: file.name,
        size: file.size || 0,
        type: file.type || "application/octet-stream",
        progress: 0,
        status: "queued" as const,
        priority,
        error: null,
        retryCount: 0,
      }));

      // Add to queue first
      setUploadQueue((prev) => [...prev, ...fileUploads]);

      // Then start uploads
      fileUploads.forEach(async (file) => {
        try {
          // Update status to uploading
          setUploadQueue((prev) =>
            prev.map((f) =>
              f.fileId === file.fileId
                ? { ...f, status: "uploading" as const }
                : f
            )
          );

          // Call uploadFile with just the file parameter
          await uploadFileToFirebase(file);
        } catch (error: any) {
          console.error(`Upload error for ${file.name}:`, error);
          setUploadQueue((prev) =>
            prev.map((f) =>
              f.fileId === file.fileId
                ? { ...f, status: "failed" as const, error: error.message }
                : f
            )
          );
        }
      });

      return fileUploads;
    },
    []
  );

  const removeFromQueue = useCallback((fileId: string) => {
    const result = uploadService.removeFromQueue(fileId);
    if (result) {
      setUploadQueue((prev) => prev.filter((file) => file.fileId !== fileId));
      setCompletedUploads((prev) =>
        prev.filter((file) => file.fileId !== fileId)
      );
    }
    return result;
  }, []);

  const updatePriority = (
    fileId: string,
    priority: "high" | "normal" | "low"
  ) => {
    const result = uploadService.updatePriority(fileId, priority);
    if (result) {
      setUploadQueue([...uploadService.getQueue()]);
    }
    return result;
  };

  const pauseUpload = (fileId: string) => {
    uploadService.pauseUpload(fileId);
    setUploadQueue((prev) =>
      prev.map((file) =>
        file.fileId === fileId ? { ...file, status: "paused" } : file
      )
    );
  };

  const resumeUpload = (fileId: string) => {
    uploadService.resumeUpload(fileId);
    setUploadQueue((prev) =>
      prev.map((file) =>
        file.fileId === fileId ? { ...file, status: "queued" } : file
      )
    );
  };

  const cancelUpload = (fileId: string) => {
    const result = uploadService.cancelUpload(fileId);
    if (result) {
      setUploadQueue((prev) => prev.filter((file) => file.fileId !== fileId));
    }
    return result;
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (
        result.canceled === false &&
        result.assets &&
        result.assets.length > 0
      ) {
        console.log("Document picked:", result.assets);

        const files = result.assets.map((file) => ({
          fileId: uuidv4(),
          uri: file.uri,
          name: file.name,
          size: file.size || 0,
          type: file.mimeType || "application/octet-stream",
          status: "queued" as const,
          progress: 0,
          priority: "normal" as const,
          error: null,
          retryCount: 0,
        }));

        addToQueue(files);
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log("Images picked:", result.assets);

        const files = result.assets.map((file) => ({
          fileId: uuidv4(),
          uri: file.uri,
          name: file.fileName || `image-${Date.now()}.jpg`,
          size: file.fileSize || 0,
          type: file.mimeType || "image/jpeg",
          progress: 0,
          status: "queued" as const,
          priority: "normal" as const,
          error: null,
          retryCount: 0,
        }));

        addToQueue(files);
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log("Videos picked:", result.assets);

        const files = result.assets.map((file) => ({
          fileId: uuidv4(),
          uri: file.uri,
          name: file.fileName || `video-${Date.now()}.mp4`,
          size: file.fileSize || 0,
          type: file.mimeType || "video/mp4",
          progress: 0,
          status: "queued" as const,
          priority: "normal" as const,
          error: null,
          retryCount: 0,
        }));

        addToQueue(files);
      }
    } catch (error) {
      console.error("Error picking video:", error);
    }
  };

  const retryUpload = (fileId: string) => {
    const result = uploadService.retryUpload(fileId);
    if (result) {
      setUploadQueue(uploadService.getQueue());
    }
    return result;
  };

  // Add this function to reorder the queue
  const reorderQueue = (
    fileId: string,
    newPosition: number,
    newPriority?: "high" | "normal" | "low"
  ) => {
    setUploadQueue((prev) => {
      const newQueue = [...prev];
      const currentIndex = newQueue.findIndex((f) => f.fileId === fileId);

      if (currentIndex === -1) return prev;

      // Get the file
      const [file] = newQueue.splice(currentIndex, 1);

      // Update priority if provided
      if (newPriority) {
        file.priority = newPriority;
      }

      // Insert at new position
      newQueue.splice(newPosition, 0, file);

      // Notify server about the reordering with priorities
      websocketService.updateQueueOrder(
        newQueue.map((f) => ({
          fileId: f.fileId,
          priority: f.priority,
        }))
      );

      return newQueue;
    });
  };

  const value = {
    uploadQueue,
    completedUploads,
    isConnected,
    connectionError,
    addToQueue,
    removeFromQueue,
    updatePriority,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    pickDocument,
    pickImage,
    pickVideo,
    retryUpload,
    reorderQueue,
  };

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
};
