import React from "react";
import { StyleSheet, View, FlatList, Text } from "react-native";
import { useUpload } from "@/context/UploadContext";
import FileItem from "./FileItem";
import { ThemedView } from "../ThemedView";
import { ThemedText } from "../ThemedText";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function UploadQueue() {
  const { uploadQueue, completedUploads, reorderQueue } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Debug logs
  console.log(`Rendering queue with ${uploadQueue.length} items`);
  console.log(`Completed uploads: ${completedUploads.length} items`);

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Upload Queue</ThemedText>
        {uploadQueue.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No files in queue</ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={uploadQueue}
            keyExtractor={(item) => item.fileId}
            renderItem={({ item, index }) => (
              <FileItem file={item} position={index} onReorder={reorderQueue} />
            )}
            style={styles.list}
          />
        )}
      </View>

      {completedUploads.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            Completed Uploads ({completedUploads.length})
          </ThemedText>
          <FlatList
            data={completedUploads}
            keyExtractor={(item) => item.fileId}
            renderItem={({ item }) => <FileItem file={item} isCompleted />}
            style={styles.list}
          />
        </View>
      )}
    </View>
  );
}

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
