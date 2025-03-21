import React, { useState } from "react";
import { StyleSheet, Text, View, Button, Platform } from "react-native";

export default function App() {
  const [message, setMessage] = useState("Welcome to File Upload App");

  const handlePress = () => {
    setMessage("Button pressed! Platform: " + Platform.OS);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>File Upload App</Text>
      <Text style={styles.message}>{message}</Text>
      <Button title="Test Button" onPress={handlePress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  message: {
    marginBottom: 30,
    textAlign: "center",
  },
});
