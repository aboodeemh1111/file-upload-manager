import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Text } from "react-native";
import * as Progress from "react-native-progress";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

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
  const prevProgressRef = useRef(progress);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Log when progress changes
  useEffect(() => {
    console.log(`Rendering progress bar: ${progress}% (${status})`);
    prevProgressRef.current = progress;

    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // If progress is 100%, keep the progress bar visible for a moment
    if (progress === 100) {
      animationTimeoutRef.current = setTimeout(() => {
        // This timeout will allow the progress bar to remain visible
        console.log("Progress bar completion animation finished");
      }, 1000);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [progress, status]);

  const getProgressColor = () => {
    if (status === "paused") return colors.warning;
    if (status === "failed") return colors.error;
    return colors.primary;
  };

  return (
    <View style={styles.container}>
      <Progress.Bar
        progress={progress / 100}
        width={null}
        height={8}
        color={getProgressColor()}
        unfilledColor={`${getProgressColor()}20`}
        borderWidth={0}
        borderRadius={4}
        style={styles.progressBar}
      />
      <Text style={styles.progressText}>{Math.round(progress)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    flex: 1,
    borderRadius: 4,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    width: 40,
    textAlign: "right",
  },
});

export default ProgressIndicator;
