import React from "react";
import { View, StyleSheet, TouchableOpacity, SafeAreaView } from "react-native";
import { router, usePathname } from "expo-router";
import { ThemedText } from "./ThemedText";
import { IconSymbol } from "./ui/IconSymbol";
import Colors from "@/constants/Colors";
import { useColorScheme } from "./useColorScheme";

export default function NavigationButtons() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const currentPath = usePathname();

  const routes = [
    { name: "Home", path: "/(tabs)", icon: "house" },
    { name: "Upload", path: "/(tabs)/upload", icon: "plus.circle" },
    { name: "Queue", path: "/(tabs)/queue", icon: "list" },
    { name: "Settings", path: "/(tabs)/settings", icon: "gear" },
  ];

  const isActive = (path: string) =>
    currentPath === path || (path === "/(tabs)" && currentPath === "/");

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        {routes.map((route) => (
          <TouchableOpacity
            key={route.path}
            style={styles.tabButton}
            onPress={() => router.navigate(route.path as any)}
          >
            <IconSymbol
              name={route.icon}
              size={24}
              color={isActive(route.path) ? colors.primary : colors.text}
            />
            <ThemedText
              style={[
                styles.tabText,
                { color: isActive(route.path) ? colors.primary : colors.text },
              ]}
            >
              {route.name}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
  },
});
