import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, FlatList, Text } from "react-native";
import { useUpload } from "@/context/UploadContext";
import FileItem from "./FileItem";
import { ThemedView } from "../ThemedView";
import { ThemedText } from "../ThemedText";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { FileUpload } from "@/types/FileUpload";

const UploadQueue = () => {
  const {
    uploadQueue,
    completedUploads,
    reorderQueue,
    cancelUpload,
    retryUpload,
  } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Use a ref to keep track of the last non-empty queue
  const lastQueueRef = useRef<FileUpload[]>([]);

  // Track completed file IDs to filter them out
  const completedFileIds = useRef(new Set<string>());

  // Update completed file IDs
  useEffect(() => {
    completedUploads.forEach((file) => {
      completedFileIds.current.add(file.fileId);
    });
  }, [completedUploads]);

  // Update the ref whenever we have a non-empty queue
  useEffect(() => {
    if (uploadQueue.length > 0) {
      // Only save files that aren't completed
      const activeUploads = uploadQueue.filter(
        (file) =>
          file.status !== "completed" ||
          !completedFileIds.current.has(file.fileId)
      );

      if (activeUploads.length > 0) {
        lastQueueRef.current = [...activeUploads];
        console.log(
          "📝 Saved queue state with",
          activeUploads.length,
          "active items"
        );
      }
    }
  }, [uploadQueue]);

  // Debug logs to check what's happening
  console.log("🔄 UPLOAD QUEUE RENDER");
  console.log("📋 Upload Queue Items:", uploadQueue.length);

  if (uploadQueue.length > 0) {
    uploadQueue.forEach((item, index) => {
      console.log(
        `📦 Queue Item ${index}: ${item.fileId} ${item.name} ${item.status} ${item.progress}`
      );
    });
  }

  // Filter out completed uploads from the queue display
  const filterCompletedUploads = (queue: FileUpload[]) => {
    return queue.filter((file) => {
      // Check if this file is in the completed uploads list
      const isInCompletedList = completedUploads.some(
        (completed) => completed.fileId === file.fileId
      );

      // If it's in the completed list, don't show it in the queue
      if (isInCompletedList) {
        return false;
      }

      // Otherwise, show it if it's not completed or if it's recently completed
      return (
        file.status !== "completed" ||
        (file.status === "completed" &&
          file.progress === 100 &&
          Date.now() - (file.completedAt || Date.now()) < 3000)
      );
    });
  };

  // Render the actual queue or the last known state if empty
  const queueToRender = filterCompletedUploads(
    uploadQueue.length > 0 ? uploadQueue : lastQueueRef.current
  );

  // Use memoized renderItem function to prevent re-renders
  const renderItem = ({ item }: { item: FileUpload }) => {
    console.log(
      `FileItem rendering: ${item.name}, progress: ${item.progress}%, status: ${item.status}`
    );
    return (
      <FileItem
        file={item}
        onCancel={async () => {
          await cancelUpload(item.fileId);
          return true;
        }}
        onRetry={async () => {
          await retryUpload(item.fileId);
          return true;
        }}
      />
    );
  };

  // Render completed items
  const renderCompletedItem = useCallback(
    ({ item }: { item: FileUpload }) => <FileItem file={item} isCompleted />,
    []
  );

  // Use stable key extractor
  const keyExtractor = useCallback((item: FileUpload) => item.fileId, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Upload Queue</ThemedText>
        <FlatList
          data={queueToRender}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedView style={styles.emptyState}>
              <ThemedText style={styles.emptyText}>
                No files in upload queue
              </ThemedText>
            </ThemedView>
          }
        />
      </View>

      {/* Always show the completed section, even if empty */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>
          Completed Uploads ({completedUploads.length})
        </ThemedText>
        {completedUploads.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>
              No completed uploads
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={completedUploads}
            keyExtractor={keyExtractor}
            renderItem={renderCompletedItem}
            style={styles.list}
            extraData={completedUploads.map((item) => item.fileId).join(",")}
          />
        )}
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  list: {
    flexGrow: 0,
    minHeight: 50, // Ensure the list has some minimum height
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
});

export default React.memo(UploadQueue);
