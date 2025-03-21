import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function TestScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Screen</Text>
      <Text style={styles.subtitle}>
        If you can see this, your app is working!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
});
