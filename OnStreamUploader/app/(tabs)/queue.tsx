import React, { useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from "react-native";
import { useUpload } from "@/context/UploadContext";
import FileItem from "@/components/upload/FileItem";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { FileUpload } from "@/types/FileUpload";

export default function QueueScreen() {
  console.log("Queue screen rendering");
  const {
    uploadQueue,
    completedUploads,
    reorderQueue,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    startUpload,
  } = useUpload();
  const [showCompleted, setShowCompleted] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const renderItem = ({ item, index }: { item: FileUpload; index: number }) => (
    <FileItem
      file={item}
      position={index}
      onReorder={reorderQueue}
      onPause={() => pauseUpload(item.fileId)}
      onResume={() => resumeUpload(item.fileId)}
      onCancel={() => cancelUpload(item.fileId)}
    />
  );

  const renderCompletedItem = ({ item }: { item: FileUpload }) => (
    <FileItem file={item} isCompleted />
  );

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.title}>Upload Queue</ThemedText>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              !showCompleted && { backgroundColor: colors.primary },
            ]}
            onPress={() => setShowCompleted(false)}
          >
            <Text
              style={[styles.tabText, !showCompleted && { color: "white" }]}
            >
              Queue ({uploadQueue.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              showCompleted && { backgroundColor: colors.primary },
            ]}
            onPress={() => setShowCompleted(true)}
          >
            <Text style={[styles.tabText, showCompleted && { color: "white" }]}>
              Completed ({completedUploads.length})
            </Text>
          </TouchableOpacity>
        </View>
      </ThemedView>

      <ThemedView style={styles.content}>
        {!showCompleted ? (
          uploadQueue.length > 0 ? (
            <FlatList
              data={uploadQueue}
              renderItem={renderItem}
              keyExtractor={(item) => item.fileId}
              style={styles.list}
            />
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol
                name="cloud-upload"
                size={48}
                color={colors.primary}
              />
              <ThemedText style={styles.emptyText}>
                No files in queue. Add files from the Upload tab.
              </ThemedText>
            </View>
          )
        ) : completedUploads.length > 0 ? (
          <FlatList
            data={completedUploads}
            renderItem={renderCompletedItem}
            keyExtractor={(item) => item.fileId}
            style={styles.list}
          />
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol
              name="checkmark-circle"
              size={48}
              color={colors.success}
            />
            <ThemedText style={styles.emptyText}>
              No completed uploads yet.
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  tabs: {
    flexDirection: "row",
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  tabText: {
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  list: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
    opacity: 0.7,
  },
});
