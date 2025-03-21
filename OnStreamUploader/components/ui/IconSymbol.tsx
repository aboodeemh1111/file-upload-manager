// This file is a fallback for using MaterialIcons on Android and web.

import React from "react";
import { StyleSheet, View, StyleProp, ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

// Map SF Symbol names to Material Icons
const MAPPING: Record<string, any> = {
  document: "description",
  image: "image",
  video: "videocam",
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.right": "chevron-right",
  pause: "pause",
  play: "play-arrow",
  "close-circle": "cancel",
  "arrow-up": "arrow-upward",
  "swap-vertical": "swap-vert",
  "checkmark-circle": "check-circle",
  "alert-circle": "error",
  time: "access-time",
};

export type IconSymbolName = keyof typeof MAPPING;

type IconSymbolProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  weight?: any;
};

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: IconSymbolProps) {
  const colorScheme = useColorScheme();
  const defaultColor = Colors[colorScheme].text;
  const iconColor = color || defaultColor;

  // Use Material Icons as fallback
  const materialName = MAPPING[name] || "help-outline";

  return (
    <View style={[styles.container, style]}>
      <MaterialIcons name={materialName} size={size} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
