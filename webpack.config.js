const createExpoWebpackConfigAsync = require("@expo/webpack-config");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Add polyfills for web
  if (config.resolve) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      path: require.resolve("path-browserify"),
      zlib: require.resolve("browserify-zlib"),
      fs: false,
      net: false,
      tls: false,
    };
  }

  return config;
};
