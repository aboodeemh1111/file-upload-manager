import React from "react";
import { StyleSheet, FlatList, View } from "react-native";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import FileItem from "./FileItem";
import { useUpload } from "@/context/UploadContext";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

const UploadQueue = () => {
  const {
    uploadQueue,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    updatePriority,
    reorderQueue,
  } = useUpload();

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const handlePriorityToggle = (fileId: string) => {
    const file = uploadQueue.find((f) => f.fileId === fileId);
    if (file) {
      const newPriority = file.priority === "high" ? "normal" : "high";
      updatePriority(fileId, newPriority);
    }
  };

  if (uploadQueue.length === 0) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIconContainer,
            { backgroundColor: colors.info + "10" },
          ]}
        >
          <Ionicons name="cloud-upload" size={48} color={colors.info} />
        </View>
        <ThemedText style={styles.emptyTitle}>No files in queue</ThemedText>
        <ThemedText style={styles.emptyText}>
          Upload files to see them appear here
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          Upload Queue
        </ThemedText>
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{uploadQueue.length}</ThemedText>
        </View>
      </View>

      <FlatList
        data={uploadQueue}
        keyExtractor={(item) => item.fileId}
        renderItem={({ item, index }) => (
          <View style={styles.queueItem}>
            <View style={styles.positionIndicator}>
              <ThemedText style={styles.positionText}>{index + 1}</ThemedText>
            </View>
            <FileItem
              file={item}
              isCompleted={false}
              position={index}
              onReorder={reorderQueue}
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#0066FF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.6,
    maxWidth: 250,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  positionIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#0066FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  positionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default UploadQueue;
