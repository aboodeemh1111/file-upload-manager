/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#2f95dc";
const tintColorDark = "#fff";

export default {
  light: {
    text: "#000",
    background: "#fff",
    tint: tintColorLight,
    tabIconDefault: "#ccc",
    tabIconSelected: tintColorLight,
    card: "#FFFFFF",
    border: "#E5E7EB",
    notification: "#FF3B30",
    success: "#34C759",
    warning: "#FF9500",
    error: "#FF3B30",
    info: "#0066FF",
    progressBackground: "#E5E7EB",
    progressFill: "#0066FF",
    progressPaused: "#FF9500",
    progressError: "#FF3B30",
  },
  dark: {
    text: "#fff",
    background: "#000",
    tint: tintColorDark,
    tabIconDefault: "#ccc",
    tabIconSelected: tintColorDark,
    card: "#1E1E1E",
    border: "#2C2C2C",
    notification: "#FF453A",
    success: "#30D158",
    warning: "#FF9F0A",
    error: "#FF453A",
    info: "#4D9AFF",
    progressBackground: "#2C2C2C",
    progressFill: "#4D9AFF",
    progressPaused: "#FF9F0A",
    progressError: "#FF453A",
  },
};
