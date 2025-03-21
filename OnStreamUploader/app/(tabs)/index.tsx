import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useUpload } from "@/context/UploadContext";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { router } from "expo-router";

export default function HomeScreen() {
  console.log("Home screen rendering");
  const { uploadQueue, completedUploads } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const navigateToQueue = () => {
    router.navigate("/(tabs)/queue");
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>OnStream Uploader</ThemedText>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <ThemedText style={styles.statValue}>{uploadQueue.length}</ThemedText>
          <ThemedText style={styles.statLabel}>In Queue</ThemedText>
        </View>

        <View style={styles.statCard}>
          <ThemedText style={styles.statValue}>
            {completedUploads.length}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Completed</ThemedText>
        </View>
      </View>

      {uploadQueue.length > 0 && (
        <TouchableOpacity
          style={[styles.queueButton, { backgroundColor: colors.primary }]}
          onPress={navigateToQueue}
        >
          <IconSymbol name="list" size={20} color="white" />
          <ThemedText style={styles.queueButtonText}>
            View Upload Queue ({uploadQueue.length})
          </ThemedText>
        </TouchableOpacity>
      )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => router.navigate("/upload")}
        >
          <IconSymbol name="cloud-upload" size={24} color="white" />
          <ThemedText style={styles.actionButtonText}>Upload Files</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 16,
    width: "45%",
    alignItems: "center",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  queueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  queueButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
  actionsContainer: {
    marginTop: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
});
