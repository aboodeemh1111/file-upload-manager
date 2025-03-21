import React, { useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Pressable,
  Platform,
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
  withTiming,
  runOnJS,
} from "react-native-reanimated";

// Add isWeb check
const isWeb = Platform.OS === "web";

// Add type definition for the FileItem props
interface FileItemProps {
  file: FileUpload;
  isCompleted?: boolean;
  position?: number;
  onReorder?: (fileId: string, newPosition: number) => void;
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
}) => {
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
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);

  const prevStatusRef = useRef(file.status);

  // Fix the animation effect with web platform check
  useEffect(() => {
    if (isWeb) {
      // On web, use simpler animations or skip them
      return;
    }

    // When a file is completed in the upload queue
    if (
      prevStatusRef.current !== "completed" &&
      file.status === "completed" &&
      !isCompleted
    ) {
      // Animate out
      opacity.value = withTiming(0.5, { duration: 300 });
      scale.value = withTiming(0.95, { duration: 300 });
      translateX.value = withTiming(100, { duration: 400 });
    }

    // When a file appears in the completed section
    if (isCompleted && file.status === "completed") {
      // Start from hidden state
      opacity.value = 0;
      scale.value = 0.9;
      translateX.value = -50;

      // Animate in
      setTimeout(() => {
        opacity.value = withTiming(1, { duration: 400 });
        scale.value = withTiming(1, { duration: 400 });
        translateX.value = withTiming(0, { duration: 300 });
      }, 50); // Small delay to ensure initial values are applied
    }

    prevStatusRef.current = file.status;
  }, [file.status, isCompleted]);

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
      if (newPosition !== 0 && onReorder) {
        runOnJS(onReorder)(file.fileId, newPosition);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    if (isWeb) {
      // Simplified style for web to avoid errors
      return {
        opacity: 1,
        transform: [{ translateY: translateY.value }],
      };
    }

    return {
      opacity: opacity.value,
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
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

  // Conditionally render with or without PanGestureHandler based on platform
  if (isWeb) {
    return (
      <Animated.View style={animatedStyle}>
        <ThemedView
          style={{
            ...styles.container,
            backgroundColor: colors.card,
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

              {file.status === "uploading" && (
                <View style={styles.progressContainer}>
                  <ProgressIndicator
                    progress={file.progress}
                    status={file.status}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            {!isCompleted && file.status === "uploading" && (
              <Pressable onPress={handleCancel} style={styles.actionButton}>
                <Ionicons name="close" size={20} color={colors.error} />
              </Pressable>
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
    );
  }

  return (
    <PanGestureHandler
      onGestureEvent={panGestureEvent}
      enabled={!isCompleted && file.status !== "uploading"}
    >
      <Animated.View style={animatedStyle}>
        <ThemedView
          style={{
            ...styles.container,
            backgroundColor: colors.card,
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

              {file.status === "uploading" && (
                <View style={styles.progressContainer}>
                  <ProgressIndicator
                    progress={file.progress}
                    status={file.status}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            {!isCompleted && file.status === "uploading" && (
              <Pressable onPress={handleCancel} style={styles.actionButton}>
                <Ionicons name="close" size={20} color={colors.error} />
              </Pressable>
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
});

export default React.memo(FileItem);
