import React from "react";
import { View, StyleSheet } from "react-native";
import * as Progress from "react-native-progress";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { ThemedText } from "../ThemedText";

// Add type definition for the ProgressIndicator props
interface ProgressIndicatorProps {
  progress: number;
  status: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  status,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Make sure progress is a number between 0 and 1
  const normalizedProgress = Math.min(Math.max(progress / 100, 0), 1);

  console.log(`Rendering progress bar: ${progress}% (${normalizedProgress})`);

  // Always show progress for uploading files
  return (
    <View style={styles.container}>
      <Progress.Bar
        progress={normalizedProgress}
        width={null}
        height={8}
        color={status === "paused" ? colors.warning : colors.primary}
        unfilledColor={colorScheme === "dark" ? "#333" : "#eee"}
        borderWidth={0}
        borderRadius={4}
        style={styles.progressBar}
      />
      <ThemedText style={styles.progressText}>
        {Math.round(progress)}%
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "bold",
  },
});

export default ProgressIndicator;
