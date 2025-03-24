import * as Sentry from "@sentry/react-native";

// Initialize Sentry with minimal configuration
Sentry.init({
  dsn: "https://8118ba334455b35a3f8830e067b8e87d@o4509030232293377.ingest.de.sentry.io/4509030241796176",
  // Remove the problematic integration
  integrations: [],
  // Performance monitoring
  tracesSampleRate: 1.0,
  // Session tracking
  enableAutoSessionTracking: true,
  // Send user IP address and other context data
  sendDefaultPii: true,
  // Only enable in production
  enabled: true, // Enable in all environments for testing
  // Add app version for release tracking
  release: "onstream-uploader@1.0.0",
});

// Export for use in other files
export default Sentry;
