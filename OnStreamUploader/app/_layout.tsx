import { Stack } from "expo-router";
import { UploadProvider } from "@/context/UploadContext";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "@/components/useColorScheme";
import NavigationButtons from "@/components/NavigationButtons";
import { View, StyleSheet } from "react-native";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <UploadProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
            animation: "fade",
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
        <NavigationButtons />
      </View>
    </UploadProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 60, // Add padding to account for the navigation bar
  },
});
