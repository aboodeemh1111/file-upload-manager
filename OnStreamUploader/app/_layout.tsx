import { Stack } from "expo-router";
import { UploadProvider } from "@/context/UploadContext";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "@/components/useColorScheme";
import * as Sentry from "@sentry/react-native";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "../config/sentry";

Sentry.init({
  dsn: "https://8118ba334455b35a3f8830e067b8e87d@o4509030232293377.ingest.de.sentry.io/4509030241796176",

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
});
