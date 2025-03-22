import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import * as FileSystem from "expo-file-system";
import { MaterialIcons } from "@expo/vector-icons";
import { storage } from "../../firebase";
import { FileUpload } from "@/types/FileUpload";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from "firebase/storage";

// Define the props interface
interface UploadManagerProps {
  file: FileUpload;
  onComplete: (downloadURL: string) => void;
  onError: (error: any) => void;
}

const UploadManager: React.FC<UploadManagerProps> = ({
  file,
  onComplete,
  onError,
}) => {
  const [uploadState, setUploadState] = useState("idle"); // idle, uploading, paused, completed, error
  const [progress, setProgress] = useState(0);
  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);

  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate the progress bar width
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    // Check if the file is already in an uploading or paused state
    if (file) {
      if (file.status === "uploading") {
        setUploadState("uploading");
        setProgress(file.progress / 100);
        // You might need to reconnect to an existing upload task here
      } else if (file.status === "paused") {
        setUploadState("paused");
        setProgress(file.progress / 100);
      } else if (file.status === "queued") {
        // Auto-start upload for queued files
        startUpload();
      }
    }
  }, [file]);

  useEffect(() => {
    // Initialize with file's current progress if available
    if (file && file.progress) {
      setProgress(file.progress / 100);
    }
  }, [file]);

  const startUpload = async () => {
    if (!file || !file.uri) {
      console.error("No file or file URI provided");
      return;
    }

    try {
      // Create a reference to the file in Firebase Storage
      const fileName = file.name || `file-${new Date().getTime()}`;
      const storageRef = ref(storage, `uploads/${fileName}`);

      // Get file data as Base64
      const base64Data = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert Base64 to Blob
      const response = await fetch(`data:${file.type};base64,${base64Data}`);
      const blob = await response.blob();

      // Start the upload task
      const task = uploadBytesResumable(storageRef, blob, {
        contentType: file.type,
      });

      setUploadTask(task);
      setUploadState("uploading");

      // Monitor upload progress
      task.on(
        "state_changed",
        (snapshot) => {
          const currentProgress =
            snapshot.bytesTransferred / snapshot.totalBytes;
          setProgress(currentProgress);
          setBytesTransferred(snapshot.bytesTransferred);
          setTotalBytes(snapshot.totalBytes);

          // Update state based on task state
          switch (snapshot.state) {
            case "paused":
              setUploadState("paused");
              break;
            case "running":
              setUploadState("uploading");
              break;
          }
        },
        (error) => {
          setUploadState("error");
          if (onError) onError(error);
        },
        () => {
          setUploadState("completed");
          setProgress(1);
          if (onComplete) {
            getDownloadURL(task.snapshot.ref).then((downloadURL) => {
              onComplete(downloadURL);
            });
          }
        }
      );
    } catch (error) {
      setUploadState("error");
      if (onError) onError(error);
    }
  };

  const pauseUpload = () => {
    if (uploadTask && uploadState === "uploading") {
      uploadTask.pause();
      setUploadState("paused");
    }
  };

  const resumeUpload = () => {
    if (uploadTask && uploadState === "paused") {
      uploadTask.resume();
      setUploadState("uploading");
    }
  };

  const cancelUpload = () => {
    if (uploadTask) {
      uploadTask.cancel();
      setUploadState("idle");
      setProgress(0);
      setBytesTransferred(0);
      setTotalBytes(0);
      animatedWidth.setValue(0);
    }
  };

  // Format bytes to human-readable size
  const formatBytes = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (
      parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
    );
  };

  // Get appropriate status text
  const getStatusText = () => {
    switch (uploadState) {
      case "idle":
        return "Ready to upload";
      case "uploading":
        return "Uploading...";
      case "paused":
        return "Upload paused";
      case "completed":
        return "Upload complete";
      case "error":
        return "Upload failed";
      default:
        return "";
    }
  };

  // Get appropriate action buttons based on state
  const renderActionButtons = () => {
    if (uploadState === "idle") {
      return (
        <TouchableOpacity style={styles.actionButton} onPress={startUpload}>
          <MaterialIcons name="cloud-upload" size={24} color="#fff" />
          <Text style={styles.buttonText}>Start Upload</Text>
        </TouchableOpacity>
      );
    }

    if (uploadState === "uploading") {
      return (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.smallButton]}
            onPress={pauseUpload}
          >
            <MaterialIcons name="pause" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.smallButton,
              styles.cancelButton,
            ]}
            onPress={cancelUpload}
          >
            <MaterialIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    if (uploadState === "paused") {
      return (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.smallButton]}
            onPress={resumeUpload}
          >
            <MaterialIcons name="play-arrow" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.smallButton,
              styles.cancelButton,
            ]}
            onPress={cancelUpload}
          >
            <MaterialIcons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    if (uploadState === "completed") {
      return (
        <TouchableOpacity style={[styles.actionButton, styles.completeButton]}>
          <MaterialIcons name="check" size={24} color="#fff" />
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      );
    }

    if (uploadState === "error") {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.errorButton]}
          onPress={startUpload}
        >
          <MaterialIcons name="refresh" size={24} color="#fff" />
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      );
    }
  };

  console.log(
    `UploadManager rendering: state=${uploadState}, progress=${progress}, file status=${file.status}`
  );

  return (
    <View style={styles.container}>
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
            uploadState === "completed" && styles.completedBar,
            uploadState === "error" && styles.errorBar,
          ]}
        />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {(uploadState === "uploading" || uploadState === "paused") && (
          <Text style={styles.bytesText}>
            {`${formatBytes(bytesTransferred)} / ${formatBytes(
              totalBytes
            )} (${Math.round(progress * 100)}%)`}
          </Text>
        )}
      </View>

      <View style={styles.actionsContainer}>{renderActionButtons()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginVertical: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#2196F3",
  },
  completedBar: {
    backgroundColor: "#4CAF50",
  },
  errorBar: {
    backgroundColor: "#F44336",
  },
  infoContainer: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  bytesText: {
    fontSize: 12,
    color: "#757575",
  },
  actionsContainer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  buttonContainer: {
    flexDirection: "row",
  },
  actionButton: {
    backgroundColor: "#2196F3",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: "#F44336",
  },
  completeButton: {
    backgroundColor: "#4CAF50",
  },
  errorButton: {
    backgroundColor: "#F44336",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "500",
    marginLeft: 6,
  },
});

export default UploadManager;
