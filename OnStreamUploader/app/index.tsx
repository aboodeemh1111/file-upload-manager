import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useUpload } from "@/context/UploadContext";
import UploadQueue from "@/components/upload/UploadQueue";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function Index() {
  const { pickImage, pickDocument, pickVideo, isConnected } = useUpload();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

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

      <UploadQueue />

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
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
  actionButtons: {
    marginTop: 16,
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
});
