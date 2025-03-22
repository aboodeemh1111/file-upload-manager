import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useUpload } from "@/context/UploadContext";
import UploadQueue from "@/components/upload/UploadQueue";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { FileUpload } from "@/types/FileUpload";

export default function Index() {
  const {
    pickImage,
    pickDocument,
    pickVideo,
    isConnected,
    uploadQueue,
    completedUploads,
    addToQueue,
    setUploadQueue,
    setCompletedUploads,
  } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [activeTab, setActiveTab] = useState("home");

  // Render the appropriate content based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <>
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <ThemedText style={styles.statValue}>
                  {uploadQueue.length}
                </ThemedText>
                <ThemedText style={styles.statLabel}>In Queue</ThemedText>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                <ThemedText style={styles.statValue}>
                  {completedUploads.length}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Completed</ThemedText>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={pickImage}
              >
                <Ionicons name="image" size={24} color="white" />
                <Text style={styles.buttonText}>Upload Images</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.secondary }]}
                onPress={pickVideo}
              >
                <Ionicons name="videocam" size={24} color="white" />
                <Text style={styles.buttonText}>Upload Videos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.tertiary }]}
                onPress={pickDocument}
              >
                <Ionicons name="document" size={24} color="white" />
                <Text style={styles.buttonText}>Upload Files</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.info }]}
                onPress={testAddToQueue}
              >
                <Ionicons name="bug" size={24} color="white" />
                <Text style={styles.buttonText}>Test Upload</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      case "queue":
        return <UploadQueue />;
      case "settings":
        return (
          <ThemedView style={styles.settingsContainer}>
            <ThemedText style={styles.settingsTitle}>Settings</ThemedText>
            <ThemedText>App settings will appear here</ThemedText>
          </ThemedView>
        );
      default:
        return null;
    }
  };

  const testAddToQueue = () => {
    // Create a test file with a dummy URI
    const testFile = {
      uri: "https://placekitten.com/200/300",
      name: `test-file-${Date.now()}.jpg`,
      size: 1024 * 1024, // 1MB
      type: "image/jpeg",
    };

    // Create a FileUpload object directly
    const fileUpload: FileUpload = {
      fileId: `test-${Date.now()}`,
      uri: testFile.uri,
      name: testFile.name,
      size: testFile.size,
      type: testFile.type,
      progress: 0,
      status: "queued",
      priority: "normal",
      error: null,
      retryCount: 0,
    };

    console.log("⬆️ ADDING TEST UPLOAD:", fileUpload.fileId);

    // Add directly to queue and verify it was added
    setUploadQueue((prev) => {
      const newQueue = [...prev, fileUpload];
      console.log("📋 Queue after adding:", newQueue.length, "items");
      return newQueue;
    });

    // Switch to queue tab to see the upload
    setActiveTab("queue");

    // Simulate upload progress more slowly
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 5;
      console.log(
        `📊 Updating progress for ${fileUpload.fileId}: ${progress}%`
      );

      setUploadQueue((prev) => {
        // Check if the file is still in the queue
        const fileExists = prev.some(
          (item) => item.fileId === fileUpload.fileId
        );
        if (!fileExists) {
          console.log("❌ File not found in queue during progress update!");
          return prev;
        }

        return prev.map((item) =>
          item.fileId === fileUpload.fileId
            ? {
                ...item,
                progress,
                status: progress > 0 ? "uploading" : "queued",
              }
            : item
        );
      });

      if (progress >= 100) {
        clearInterval(progressInterval);
        console.log("✅ Upload complete for:", fileUpload.fileId);

        // Keep in queue for 5 more seconds
        setTimeout(() => {
          console.log("🏁 Moving to completed uploads:", fileUpload.fileId);

          // Add to completed uploads
          setCompletedUploads((prev) => [
            ...prev,
            { ...fileUpload, progress: 100, status: "completed" },
          ]);

          // Remove from queue after delay
          setTimeout(() => {
            console.log("🗑️ Removing from queue:", fileUpload.fileId);
            setUploadQueue((prev) =>
              prev.filter((item) => item.fileId !== fileUpload.fileId)
            );
          }, 5000);
        }, 1000);
      }
    }, 300);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          OnStream Uploader
        </Text>
        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: isConnected ? colors.success : colors.error,
              },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {isConnected ? "Connected" : "Offline"}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>{renderContent()}</ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab("home")}
        >
          <Ionicons
            name="home"
            size={24}
            color={activeTab === "home" ? colors.primary : colors.text}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === "home" ? colors.primary : colors.text },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab("queue")}
        >
          <Ionicons
            name="list"
            size={24}
            color={activeTab === "queue" ? colors.primary : colors.text}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === "queue" ? colors.primary : colors.text },
            ]}
          >
            Queue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab("settings")}
        >
          <Ionicons
            name="settings"
            size={24}
            color={activeTab === "settings" ? colors.primary : colors.text}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === "settings" ? colors.primary : colors.text,
              },
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    borderRadius: 12,
    padding: 16,
    width: "48%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
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
  actionButtons: {
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 12,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingVertical: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  settingsContainer: {
    padding: 20,
    alignItems: "center",
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
