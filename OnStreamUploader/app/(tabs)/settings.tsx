import React from "react";
import { StyleSheet, View, Button, Alert } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import * as Sentry from "@sentry/react-native";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const testSentry = () => {
    try {
      // Send a test event to Sentry
      Sentry.captureMessage("Test message from settings screen");

      // Also test exception tracking
      setTimeout(() => {
        try {
          // Intentionally throw an error
          throw new Error("Test error from OnStreamUploader");
        } catch (error) {
          Sentry.captureException(error);
        }
      }, 500);

      // Show confirmation to user
      Alert.alert(
        "Sentry Test",
        "Test events sent to Sentry. Check your Sentry dashboard.",
        [{ text: "OK" }]
      );
    } catch (e) {
      console.error("Failed to send test event:", e);
      Alert.alert("Error", "Failed to send test event to Sentry");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Settings</ThemedText>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Error Reporting</ThemedText>
        <View style={styles.buttonContainer}>
          <Button
            title="Test Sentry Integration"
            onPress={testSentry}
            color={colors.primary}
          />
        </View>
        <ThemedText style={styles.description}>
          This will send a test event to Sentry to verify the integration is
          working.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>About</ThemedText>
        <ThemedText style={styles.description}>
          OnStream Uploader v1.0.0
        </ThemedText>
        <ThemedText style={styles.description}>
          A powerful file upload manager for your streaming needs.
        </ThemedText>
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
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  buttonContainer: {
    marginVertical: 10,
  },
  description: {
    fontSize: 14,
    marginTop: 5,
    opacity: 0.7,
  },
});
