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
  const { uploadQueue, completedUploads, reorderQueue } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Use a ref to keep track of the last non-empty queue
  const lastQueueRef = useRef<FileUpload[]>([]);

  // Update the ref whenever we have a non-empty queue
  useEffect(() => {
    if (uploadQueue.length > 0) {
      lastQueueRef.current = [...uploadQueue];
      console.log("📝 Saved queue state with", uploadQueue.length, "items");
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

  // Render the actual queue or the last known state if empty
  const queueToRender =
    uploadQueue.length > 0 ? uploadQueue : lastQueueRef.current;

  // Use memoized renderItem function to prevent re-renders
  const renderItem = useCallback(
    ({ item, index }: { item: FileUpload; index: number }) => (
      <FileItem
        file={item}
        position={index}
        onReorder={(fileId, newPosition) => reorderQueue(fileId, newPosition)}
      />
    ),
    [reorderQueue]
  );

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
