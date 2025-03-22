import { Stack } from "expo-router";
import { UploadProvider } from "@/context/UploadContext";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "@/components/useColorScheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <UploadProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </UploadProvider>
  );
}
