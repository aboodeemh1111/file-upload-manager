import React, { useCallback, useRef } from "react";
import { StyleSheet, View, FlatList, Text, Platform } from "react-native";
import { useUpload } from "@/context/UploadContext";
import FileItem from "./FileItem";
import { ThemedView } from "../ThemedView";
import { ThemedText } from "../ThemedText";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { FileUpload } from "@/types/FileUpload";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

// Check if running on web
const isWeb = Platform.OS === "web";

// Use conditional component based on platform
const AnimatedFlatList = isWeb
  ? FlatList // Use regular FlatList on web
  : Animated.createAnimatedComponent(FlatList);

const UploadQueue = () => {
  const { uploadQueue, completedUploads, reorderQueue } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Use memoized renderItem function to prevent re-renders
  const renderItem = useCallback(
    ({ item, index }: { item: FileUpload; index: number }) => (
      <FileItem
        file={item}
        position={index}
        onReorder={reorderQueue}
        isCompleted={completedUploads.includes(item)}
      />
    ),
    [reorderQueue, completedUploads]
  );

  // Use stable key extractor
  const keyExtractor = useCallback((item: FileUpload) => item.fileId, []);

  // Debug logs
  console.log(`Rendering queue with ${uploadQueue.length} items`);
  console.log(`Completed uploads: ${completedUploads.length} items`);

  // Create animation props conditionally
  const animationProps = isWeb
    ? {} // No animation props on web
    : {
        itemLayoutAnimation: Layout.springify(),
        entering: FadeIn.duration(300),
        exiting: FadeOut.duration(300),
      };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Upload Queue</ThemedText>
        {uploadQueue.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No files in queue</ThemedText>
          </ThemedView>
        ) : (
          <AnimatedFlatList
            data={uploadQueue}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            {...animationProps}
          />
        )}
      </View>

      {completedUploads.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            Completed Uploads ({completedUploads.length})
          </ThemedText>
          <AnimatedFlatList
            data={completedUploads}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            {...animationProps}
          />
        </View>
      )}
    </View>
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
