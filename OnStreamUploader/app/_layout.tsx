import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { UploadProvider } from "@/context/UploadContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { View, Text } from "react-native";

import { useColorScheme } from "@/hooks/useColorScheme";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) {
      console.error("Error loading fonts:", error);
    }

    if (loaded) {
      SplashScreen.hideAsync().catch((err) => {
        console.error("Error hiding splash screen:", err);
      });
    }
  }, [loaded, error]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <UploadProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="test" options={{ title: "Test Screen" }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </UploadProvider>
    </ErrorBoundary>
  );
}
