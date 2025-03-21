import { Platform } from "react-native";

/**
 * Returns the value if it's a web platform, otherwise returns the fallback value.
 * This is useful for values that should only be used on web.
 */
export function useClientOnlyValue<T>(web: T, native: T): T {
  return Platform.OS === "web" ? web : native;
}
