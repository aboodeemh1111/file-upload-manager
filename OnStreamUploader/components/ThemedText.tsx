import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";
import Colors from "../constants/Colors";
import { useColorScheme } from "./useColorScheme";

interface ThemedTextProps extends TextProps {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "subtitle" | "link";
}

export function ThemedText(props: ThemedTextProps) {
  const {
    style,
    lightColor,
    darkColor,
    type = "default",
    ...otherProps
  } = props;
  const colorScheme = useColorScheme();

  const color =
    colorScheme === "dark"
      ? darkColor || Colors.dark.text
      : lightColor || Colors.light.text;

  return (
    <Text
      style={[
        { color },
        type === "title" && styles.title,
        type === "subtitle" && styles.subtitle,
        type === "link" && styles.link,
        style,
      ]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  link: {
    color: "#0066FF",
    textDecorationLine: "underline",
  },
});
