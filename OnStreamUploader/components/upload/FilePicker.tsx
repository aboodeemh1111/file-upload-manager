import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useUpload } from "@/context/UploadContext";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import uploadService from "../../services/uploadService";

export default function FilePicker() {
  const { addToQueue } = useUpload();

  const pickImage = async () => {
    try {
      // Allow multiple selection with allowsMultipleSelection: true
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: true, // Enable multiple selection
      });

      if (!result.canceled) {
        console.log("Images picked:", result.assets);

        // Map the selected assets to the format expected by addToQueue
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `image-${Date.now()}.jpg`,
          size: Number(asset.fileSize || 0),
          type: asset.mimeType || "image/jpeg",
        })) as Array<{ uri: string; name: string; size: number; type: string }>;

        // Add all selected files to the queue
        addToQueue(files);
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const pickVideo = async () => {
    try {
      // Allow multiple selection with allowsMultipleSelection: true
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: true, // Enable multiple selection
      });

      if (!result.canceled) {
        console.log("Selected video:", result.assets);

        // Map the selected assets to the format expected by addToQueue
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `video-${Date.now()}.mp4`,
          size: Number(asset.fileSize || 0),
          type: asset.mimeType || "video/mp4",
        })) as Array<{ uri: string; name: string; size: number; type: string }>;

        // Add all selected videos to the queue
        addToQueue(files);
      }
    } catch (error) {
      console.error("Error picking video:", error);
    }
  };

  const pickDocument = async () => {
    try {
      // Allow multiple selection
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true, // Enable multiple selection
      });

      if (result.canceled === false) {
        console.log("Documents picked:", result.assets);

        // Map the selected assets to the format expected by addToQueue
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          size: Number(asset.size || 0),
          type: asset.mimeType || "application/octet-stream",
        })) as Array<{ uri: string; name: string; size: number; type: string }>;

        // Add all selected documents to the queue
        addToQueue(files);
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title} type="subtitle">
        Select Files
      </ThemedText>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={pickDocument}
          accessibilityLabel="Pick document"
        >
          <IconSymbol name="document" size={24} />
          <ThemedText>Document</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={pickImage}
          accessibilityLabel="Pick image"
        >
          <IconSymbol name="image" size={24} />
          <ThemedText>Image</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={pickVideo}
          accessibilityLabel="Pick video"
        >
          <IconSymbol name="video" size={24} />
          <ThemedText>Video</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    flex: 1,
    marginHorizontal: 4,
  },
});
