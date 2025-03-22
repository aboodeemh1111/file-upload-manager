import React, {
  useCallback,
  useEffect,
  useState,
  createRef,
  useRef,
} from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Pressable,
  Text,
} from "react-native";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import ProgressIndicator from "./ProgressIndicator";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { FileUpload } from "@/types/FileUpload";
import { useUpload } from "@/context/UploadContext";
import { IconSymbol } from "../ui/IconSymbol";
import * as Progress from "react-native-progress";
import { formatFileSize } from "@/utils/formatters";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import UploadManager from "./UploadManager";

// Add type definition for the FileItem props
interface FileItemProps {
  file: FileUpload;
  isCompleted?: boolean;
  position?: number;
  onReorder?: (fileId: string, newPosition: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

// Add this type definition for the gesture context
type GestureContext = {
  startY: number;
};

const FileItem: React.FC<FileItemProps> = ({
  file,
  isCompleted = false,
  position,
  onReorder,
  onPause,
  onResume,
  onCancel,
}) => {
  // Add state to track upload status independently
  const [uploadStatus, setUploadStatus] = useState({
    progress: file.progress,
    status: file.status,
    lastUpdated: new Date(),
  });

  // Update the status when file changes
  useEffect(() => {
    setUploadStatus({
      progress: file.progress,
      status: file.status,
      lastUpdated: new Date(),
    });

    console.log(
      `FileItem status updated: ${file.name}, progress: ${file.progress}%, status: ${file.status}`
    );
  }, [file.progress, file.status]);

  const {
    removeFromQueue,
    cancelUpload,
    retryUpload,
    updatePriority,
    reorderQueue,
    pauseUpload,
    resumeUpload,
  } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const translateY = useSharedValue(0);

  const panGestureEvent = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    GestureContext
  >({
    onStart: (_, ctx) => {
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      translateY.value = ctx.startY + event.translationY;
    },
    onEnd: () => {
      translateY.value = withSpring(0);
      // Calculate new position based on translation
      const newPosition = Math.round(translateY.value / 80); // 80 is approximate height of item
      if (newPosition !== 0) {
        reorderQueue(file.fileId, newPosition);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const getFileIcon = () => {
    const type = file.type.split("/")[0];

    if (type === "image") return "image";
    if (type === "video") return "videocam";
    if (type === "audio") return "musical-notes";
    if (file.type.includes("pdf")) return "document-text";
    return "document";
  };

  const getIconColor = () => {
    const type = file.type.split("/")[0];

    if (type === "image") return colors.success;
    if (type === "video") return colors.warning;
    if (type === "audio") return colors.info;
    if (file.type.includes("pdf")) return colors.error;
    return colors.tint;
  };

  const handleCancel = () => {
    cancelUpload(file.fileId);
  };

  const handleRetry = () => {
    retryUpload(file.fileId);
  };

  const handleRemove = useCallback(() => {
    removeFromQueue(file.fileId);
  }, [file.fileId, removeFromQueue]);

  const handlePriorityToggle = () => {
    const newPriority = file.priority === "high" ? "normal" : "high";
    updatePriority(file.fileId, newPriority);
  };

  const handlePause = useCallback(() => {
    pauseUpload(file.fileId);
  }, [file.fileId, pauseUpload]);

  const handleResume = useCallback(() => {
    resumeUpload(file.fileId);
  }, [file.fileId, resumeUpload]);

  const getStatusColor = () => {
    switch (file.status) {
      case "completed":
        return "#4CAF50";
      case "failed":
        return "#F44336";
      case "uploading":
        return "#2196F3";
      default:
        return "#9E9E9E";
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "uploading":
        return `Uploading ${Math.round(file.progress)}%`;
      case "queued":
        return "Queued";
      case "paused":
        return "Paused";
      default:
        return file.status;
    }
  };

  if (file.progress % 10 === 0 || file.progress === 100) {
    console.log(
      `FileItem rendering: ${file.name}, progress: ${file.progress}%, status: ${file.status}`
    );
  }

  const fileItemRef = useRef(null);

  return (
    <PanGestureHandler
      ref={fileItemRef}
      onGestureEvent={panGestureEvent}
      enabled={!isCompleted && file.status !== "uploading"}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        <ThemedView
          style={{
            ...styles.container,
            backgroundColor: colors.card,
            boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <View style={styles.fileInfo}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: getIconColor() + "20" },
              ]}
            >
              <Ionicons name={getFileIcon()} size={24} color={getIconColor()} />
            </View>

            <View style={styles.fileDetails}>
              <ThemedText style={styles.fileName} numberOfLines={1}>
                {file.name}
              </ThemedText>

              <View style={styles.fileMetaRow}>
                <ThemedText style={styles.fileSize}>
                  {formatFileSize(file.size)}
                </ThemedText>

                <View style={styles.statusBadge}>
                  <ThemedText
                    style={[
                      styles.statusText,
                      {
                        color: getStatusColor(),
                      },
                    ]}
                  >
                    {getStatusText()}
                  </ThemedText>
                </View>

                {file.priority === "high" && (
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: colors.warning + "20" },
                    ]}
                  >
                    <ThemedText
                      style={[styles.priorityText, { color: colors.warning }]}
                    >
                      Priority
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Add separate status indicator */}
              {file.status === "uploading" && (
                <View style={styles.statusIndicatorContainer}>
                  <Text style={styles.statusIndicatorText}>
                    Upload Status: {uploadStatus.status} (
                    {uploadStatus.progress}%)
                  </Text>
                  <Text style={styles.statusIndicatorText}>
                    Last Updated:{" "}
                    {uploadStatus.lastUpdated.toLocaleTimeString()}
                  </Text>
                </View>
              )}

              {/* Original progress bar */}
              {(file.status === "uploading" ||
                file.status === "paused" ||
                file.status === "queued" ||
                file.status === "failed") && (
                <View style={[styles.progressContainer, { opacity: 1 }]}>
                  <UploadManager
                    file={file}
                    onComplete={(downloadURL) => {
                      console.log("Upload complete:", downloadURL);
                      // Update your context with the completed upload
                    }}
                    onError={(error) => {
                      console.error("Upload error:", error);
                      // Handle the error in your context
                    }}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            {file.status === "uploading" && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onPause}
                accessibilityLabel="Pause upload"
              >
                <IconSymbol name="pause" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}

            {file.status === "paused" && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onResume}
                accessibilityLabel="Resume upload"
              >
                <IconSymbol name="play" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}

            {(file.status === "uploading" ||
              file.status === "paused" ||
              file.status === "queued" ||
              file.status === "failed") && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onCancel}
                accessibilityLabel="Cancel upload"
              >
                <IconSymbol
                  name="close-circle"
                  size={20}
                  color={colors.error}
                />
              </TouchableOpacity>
            )}

            {!isCompleted && file.status === "failed" && (
              <Pressable onPress={handleRetry} style={styles.actionButton}>
                <Ionicons name="refresh" size={20} color={colors.success} />
              </Pressable>
            )}

            {(isCompleted ||
              file.status === "completed" ||
              file.status === "failed") && (
              <Pressable onPress={handleRemove} style={styles.actionButton}>
                <Ionicons name="trash" size={20} color={colors.error} />
              </Pressable>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePriorityToggle}
            >
              <Ionicons
                name={file.priority === "high" ? "star" : "star-outline"}
                size={20}
                color={
                  file.priority === "high"
                    ? colors.warning
                    : colors.tabIconDefault
                }
              />
            </TouchableOpacity>
          </View>
        </ThemedView>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fileInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  fileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  fileSize: {
    fontSize: 13,
    opacity: 0.6,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  progressContainer: {
    marginBottom: 4,
  },
  // Add new styles for the status indicator
  statusIndicatorContainer: {
    marginTop: 4,
    marginBottom: 4,
    padding: 4,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 4,
  },
  statusIndicatorText: {
    fontSize: 10,
    color: "#666",
  },
});

export default React.memo(FileItem);
