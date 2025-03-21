import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useUpload } from "@/context/UploadContext";

export default function FilePicker() {
  const { pickDocument, pickImage, pickVideo } = useUpload();

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
