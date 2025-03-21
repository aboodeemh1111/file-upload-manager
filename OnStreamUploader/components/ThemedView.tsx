import React from "react";
import { View, ViewProps } from "react-native";
import Colors from "../constants/Colors";
import { useColorScheme } from "./useColorScheme";

interface ThemedViewProps extends ViewProps {
  lightColor?: string;
  darkColor?: string;
}

export function ThemedView(props: ThemedViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const colorScheme = useColorScheme();

  const backgroundColor =
    colorScheme === "dark"
      ? darkColor || Colors.dark.background
      : lightColor || Colors.light.background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
