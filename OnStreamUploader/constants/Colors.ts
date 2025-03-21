/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#2f95dc";
const tintColorDark = "#fff";

export default {
  light: {
    text: "#000",
    background: "#f9f9f9",
    tint: tintColorLight,
    tabIconDefault: "#ccc",
    tabIconSelected: tintColorLight,
    card: "#fff",
    warning: "#FFC107",
    error: "#F44336",
    success: "#4CAF50",
    primary: "#2196F3",
    secondary: "#9C27B0",
    tertiary: "#FF9800",
    info: "#0288D1",
  },
  dark: {
    text: "#fff",
    background: "#121212",
    tint: tintColorDark,
    tabIconDefault: "#ccc",
    tabIconSelected: tintColorDark,
    card: "#1e1e1e",
    warning: "#FFC107",
    error: "#F44336",
    success: "#4CAF50",
    primary: "#2196F3",
    secondary: "#9C27B0",
    tertiary: "#FF9800",
    info: "#29B6F6",
  },
};
