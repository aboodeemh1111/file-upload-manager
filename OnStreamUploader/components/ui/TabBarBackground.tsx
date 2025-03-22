import React from "react";
import { View, StyleSheet } from "react-native";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

const TabBarBackground = (props: BottomTabBarProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BottomTabBar {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
});

export default TabBarBackground;

export function useBottomTabOverflow() {
  return 0;
}
