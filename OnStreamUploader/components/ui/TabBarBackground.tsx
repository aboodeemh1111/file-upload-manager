import React from "react";
import { View, StyleSheet } from "react-native";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

const TabBarBackground = () => {
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme].card;

  return <View style={[styles.background, { backgroundColor }]} />;
};

const styles = StyleSheet.create({
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default TabBarBackground;

export function useBottomTabOverflow() {
  return 0;
}
