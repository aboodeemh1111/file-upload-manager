// Learn more https://docs.expo.io/guides/customizing-metro
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// Get the default Expo config with Sentry integration
const config = getSentryExpoConfig(__dirname);

// You can add additional customizations here if needed
// For example:
// config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

module.exports = config;
