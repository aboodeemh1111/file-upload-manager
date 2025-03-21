import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useClientOnlyValue } from "../../components/useClientOnlyValue";
import { useColorScheme } from "@/hooks/useColorScheme";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import Colors from "@/constants/Colors";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: useClientOnlyValue(false, true),
        tabBarBackground: () => <TabBarBackground />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="house.fill" color={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "Upload",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="arrow.up.circle.fill" color={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="gear" color={color} size={28} />
          ),
        }}
      />
    </Tabs>
  );
}
