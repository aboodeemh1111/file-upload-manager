import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import FilePicker from "@/components/upload/FilePicker";
import FileItem from "@/components/upload/FileItem";
import { useUpload } from "@/context/UploadContext";
import { IconSymbol } from "@/components/ui/IconSymbol";

export default function UploadScreen() {
  const { uploadQueue, completedUploads } = useUpload();
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <View style={styles.container}>
      <FilePicker />

      <View style={styles.queueContainer}>
        <Text style={styles.sectionTitle}>Upload Queue</Text>
        {uploadQueue.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="cloud-upload-outline" size={48} color="#BDBDBD" />
            <Text style={styles.emptyText}>No files in queue</Text>
          </View>
        ) : (
          <FlatList
            data={uploadQueue}
            keyExtractor={(item) => item.fileId}
            renderItem={({ item }) => <FileItem file={item} />}
            style={styles.list}
          />
        )}
      </View>

      {/* Completed uploads section */}
      <View style={styles.completedContainer}>
        <TouchableOpacity
          style={styles.completedHeader}
          onPress={() => setShowCompleted(!showCompleted)}
        >
          <Text style={styles.sectionTitle}>Completed Uploads</Text>
          <IconSymbol
            name={showCompleted ? "chevron-up" : "chevron-down"}
            size={24}
            color="#757575"
          />
        </TouchableOpacity>

        {showCompleted &&
          (completedUploads.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                name="check-circle-outline"
                size={48}
                color="#BDBDBD"
              />
              <Text style={styles.emptyText}>No completed uploads</Text>
            </View>
          ) : (
            <FlatList
              data={completedUploads}
              keyExtractor={(item) => item.fileId}
              renderItem={({ item }) => (
                <FileItem file={item} isCompleted={true} />
              )}
              style={styles.list}
            />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F5F5F5",
  },
  queueContainer: {
    marginTop: 16,
    marginBottom: 16,
    flex: 0.5,
  },
  completedContainer: {
    flex: 0.5,
  },
  completedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 8,
  },
  list: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    maxHeight: 300,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 16,
    color: "#757575",
  },
});
