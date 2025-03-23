import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
  useRef,
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
import { Platform } from "react-native";

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
  setUploadQueue: React.Dispatch<React.SetStateAction<FileUpload[]>>;
  setCompletedUploads: React.Dispatch<React.SetStateAction<FileUpload[]>>;
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

// Add this function to handle progress updates properly
const handleUploadProgress = (
  fileId: string,
  progress: number,
  uploadQueue: FileUpload[],
  setUploadQueue: React.Dispatch<React.SetStateAction<FileUpload[]>>
) => {
  console.log(`Progress update for ${fileId}: ${progress}%`);

  setUploadQueue((prev) =>
    prev.map((file) =>
      file.fileId === fileId
        ? {
            ...file,
            progress,
            status: progress === 100 ? "completed" : "uploading",
          }
        : file
    )
  );
};

export const UploadProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [uploadQueue, setUploadQueue] = useState<FileUpload[]>([]);
  const [completedUploads, setCompletedUploads] = useState<FileUpload[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [testUploads, setTestUploads] = useState<Set<string>>(new Set());
  const lastQueueRef = useRef<FileUpload[]>([]);

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
    // Listen for upload progress updates
    const unsubscribeProgress = websocketService.addListener(
      "upload_progress",
      (data: { fileId: string; progress: number }) => {
        handleUploadProgress(
          data.fileId,
          data.progress,
          uploadQueue,
          setUploadQueue
        );
      }
    );

    return () => {
      unsubscribeProgress();
    };
  }, [uploadQueue]);

  useEffect(() => {
    // Listen for upload status updates
    const handleStatusUpdate = (data: UploadStatusData) => {
      console.log(`Received status update for ${data.fileId}: ${data.status}`);

      // Update the file status in the queue
      setUploadQueue((prevQueue) => {
        return prevQueue.map((file) =>
          file.fileId === data.fileId
            ? {
                ...file,
                status: data.status as FileUpload["status"],
                error: data.error || file.error,
                progress: data.status === "completed" ? 100 : file.progress,
              }
            : file
        );
      });

      // If completed, add to completed uploads but keep in queue for a moment
      if (data.status === "completed") {
        // Find the file in the queue
        const file = uploadQueue.find((f) => f.fileId === data.fileId);
        if (!file) return;

        // Add to completed uploads
        setCompletedUploads((prev) => {
          // Check if already in completed uploads
          const exists = prev.some((file) => file.fileId === data.fileId);
          if (exists) return prev;

          return [...prev, { ...file, status: "completed", progress: 100 }];
        });

        // Keep in queue for 3 seconds before removing
        setTimeout(() => {
          setUploadQueue((prev) =>
            prev.filter((f) => f.fileId !== data.fileId)
          );
        }, 3000);
      }
    };

    websocketService.addListener("upload_status", handleStatusUpdate);

    return () => {
      websocketService.removeListener("upload_status", handleStatusUpdate);
    };
  }, [uploadQueue]);

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

      // Update status to completed but keep in queue
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.fileId === file.fileId
            ? { ...f, status: "completed", progress: 100 }
            : f
        )
      );

      // Add to completed uploads
      setCompletedUploads((prev) => [
        ...prev,
        {
          ...file,
          status: "completed" as const,
          progress: 100,
        },
      ]);

      // Remove from queue after delay
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((f) => f.fileId !== file.fileId));
      }, 3000);
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

  // Update the addToQueue function to properly handle video uploads
  const addToQueue = useCallback(
    (
      files: Array<{ uri: string; name: string; size: number; type: string }>,
      priority: "high" | "normal" | "low" = "normal"
    ) => {
      console.log("Adding files to queue:", files.length);

      const newFiles: FileUpload[] = files.map((file) => {
        const fileId = uuidv4();
        return {
          fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          uri: file.uri,
          progress: 0,
          status: "queued",
          priority,
          addedAt: new Date().toISOString(),
        };
      });

      // Update the queue with the new files
      setUploadQueue((prevQueue) => {
        const updatedQueue = [...prevQueue, ...newFiles];
        console.log("Queue after adding files:", updatedQueue.length);
        return updatedQueue;
      });

      // Update the lastQueueRef with the new files
      if (lastQueueRef.current) {
        lastQueueRef.current = [...lastQueueRef.current, ...newFiles];
      } else {
        lastQueueRef.current = [...newFiles];
      }

      // Start uploads after a short delay to ensure UI updates first
      setTimeout(() => {
        newFiles.forEach((file) => {
          try {
            startUpload(file);
          } catch (error: any) {
            console.error(`Upload error for ${file.name}:`, error);
          }
        });
      }, 100);

      return newFiles;
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

        // Create file objects
        const files = result.assets.map((file) => ({
          uri: file.uri,
          name: file.fileName || `image-${Date.now()}.jpg`,
          size: file.fileSize || 0,
          type: file.mimeType || "image/jpeg",
        }));

        // Add to queue - this will trigger UI update
        const uploads = addToQueue(files);

        // Log the queue state after adding
        console.log("Queue after adding in pickImage:", uploadQueue.length);

        return uploads;
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log("Selected video:", asset);

        // Create a file upload object
        const fileId = uuidv4();
        const fileUpload: FileUpload = {
          fileId,
          uri: asset.uri,
          name: asset.fileName || `video-${new Date().getTime()}.mp4`,
          size: asset.fileSize || 0,
          type: "video/mp4",
          progress: 0,
          status: "queued",
          priority: "normal",
          createdAt: new Date().toISOString(),
          error: null,
          retryCount: 0,
        };

        // Add to queue first
        const addedFiles = addToQueue([fileUpload]);
        console.log("Added video to queue:", addedFiles);

        // Start upload after adding to queue, but don't remove from queue until completed
        if (addedFiles.length > 0) {
          // Use a timeout to ensure the UI updates with the queued item first
          setTimeout(() => {
            console.log("Starting upload for video:", addedFiles[0].name);
            startUpload(addedFiles[0]);
          }, 500);
        }
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

  // Fix the startUpload function to properly handle video uploads and prevent duplicates
  const startUpload = async (file: FileUpload) => {
    try {
      console.log(`Starting upload for ${file.name}...`);

      // Update file status to uploading
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.fileId === file.fileId
            ? { ...f, status: "uploading", progress: 0 }
            : f
        )
      );

      // Start the upload process
      const result = await uploadFile(file, {
        onProgress: (progress) => {
          console.log(`Upload progress for ${file.name}: ${progress}%`);
          updateProgress(file.fileId, progress);
        },
        onError: (error) => {
          console.error(`Upload error for ${file.name}:`, error);
          setUploadQueue((prev) =>
            prev.map((f) =>
              f.fileId === file.fileId
                ? { ...f, status: "error", error: error.message }
                : f
            )
          );
        },
      });

      console.log("Upload result:", result);

      // Check if the file is already in completed uploads to prevent duplicates
      setCompletedUploads((prev) => {
        const fileExists = prev.some((f) => f.fileId === file.fileId);

        if (fileExists) {
          // Update the existing file instead of adding a new one
          return prev.map((f) =>
            f.fileId === file.fileId
              ? { ...f, progress: 100, status: "completed", result }
              : f
          );
        } else {
          // Add the file to completed uploads
          return [
            ...prev,
            {
              ...file,
              progress: 100,
              status: "completed",
              result,
            },
          ];
        }
      });

      // Only remove from queue AFTER adding to completed uploads
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((f) => f.fileId !== file.fileId));
      }, 500);

      return result;
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);

      // Update file status to error
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.fileId === file.fileId
            ? {
                ...f,
                status: "error",
                error: error instanceof Error ? error.message : String(error),
                retryCount: f.retryCount + 1,
              }
            : f
        )
      );

      throw error;
    }
  };

  const testAddToQueue = () => {
    // Create a test file with a dummy URI
    const testFile = {
      uri: "https://placekitten.com/200/300",
      name: `test-file-${Date.now()}.jpg`,
      size: 1024 * 1024, // 1MB
      type: "image/jpeg",
    };

    // Create a FileUpload object directly
    const fileUpload: FileUpload = {
      fileId: `test-${Date.now()}`,
      uri: testFile.uri,
      name: testFile.name,
      size: testFile.size,
      type: testFile.type,
      progress: 0,
      status: "queued",
      priority: "normal",
      error: null,
      retryCount: 0,
    };

    console.log("⬆️ ADDING TEST UPLOAD:", fileUpload.fileId);

    // Mark this as a test upload that shouldn't be auto-removed
    setTestUploads((prev) => new Set([...prev, fileUpload.fileId]));

    // Add directly to queue
    setUploadQueue((prev) => [...prev, fileUpload]);

    // Switch to queue tab to see the upload
    setActiveTab("queue");

    // Simulate upload progress
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 5;

      // Update progress
      setUploadQueue((prev) => {
        // Find the file in the queue
        const fileExists = prev.some(
          (item) => item.fileId === fileUpload.fileId
        );

        // If file doesn't exist, add it back
        if (!fileExists) {
          return [
            ...prev,
            {
              ...fileUpload,
              progress: currentProgress,
              status: currentProgress > 0 ? "uploading" : "queued",
            },
          ];
        }

        // Update progress
        return prev.map((item) =>
          item.fileId === fileUpload.fileId
            ? {
                ...item,
                progress: currentProgress,
                status: currentProgress > 0 ? "uploading" : "queued",
              }
            : item
        );
      });

      // Handle completion
      if (currentProgress >= 100) {
        clearInterval(progressInterval);

        // Update status to completed
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.fileId === fileUpload.fileId
              ? {
                  ...item,
                  progress: 100,
                  status: "completed",
                  completedAt: Date.now(),
                }
              : item
          )
        );

        // Add to completed uploads
        setCompletedUploads((prev) => [
          ...prev,
          {
            ...fileUpload,
            progress: 100,
            status: "completed",
            completedAt: Date.now(),
          },
        ]);

        // Remove from queue after delay
        setTimeout(() => {
          // Remove from test uploads set
          setTestUploads((prev) => {
            const newSet = new Set(prev);
            newSet.delete(fileUpload.fileId);
            return newSet;
          });

          // Remove from queue
          setUploadQueue((prev) =>
            prev.filter((item) => item.fileId !== fileUpload.fileId)
          );
        }, 5000);
      }
    }, 500);
  };

  // Update the updateProgress function to properly handle video uploads
  const updateProgress = (fileId: string, progress: number) => {
    console.log(`📊 Updating progress for ${fileId}: ${progress}%`);

    // Check if file is in queue
    const fileInQueue = uploadQueue.find((f) => f.fileId === fileId);

    if (!fileInQueue && progress < 100) {
      console.log("⚠️ File was removed from queue, re-adding it");
      // Try to find the file in the lastQueueRef
      const lastFile = lastQueueRef.current?.find((f) => f.fileId === fileId);
      if (lastFile) {
        setUploadQueue((prev) => {
          // Check if file is already in queue to prevent duplicates
          if (prev.some((f) => f.fileId === fileId)) {
            return prev.map((f) =>
              f.fileId === fileId ? { ...f, progress, status: "uploading" } : f
            );
          }
          // Otherwise add it back
          return [...prev, { ...lastFile, progress, status: "uploading" }];
        });
        return;
      }
    }

    setUploadQueue((prev) => {
      return prev.map((file) =>
        file.fileId === fileId
          ? {
              ...file,
              progress,
              status: progress === 100 ? "completed" : "uploading",
            }
          : file
      );
    });
  };

  // Add useEffect to update lastQueueRef when uploadQueue changes
  useEffect(() => {
    // Only update the ref if the queue has items
    if (uploadQueue.length > 0) {
      lastQueueRef.current = [...uploadQueue];
      console.log(
        "📝 Updated lastQueueRef with current queue:",
        uploadQueue.length,
        "items"
      );
    }
  }, [uploadQueue]);

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
    startUpload,
    setUploadQueue,
    setCompletedUploads,
    testAddToQueue,
  };

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
};
