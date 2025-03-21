import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI",
  authDomain: "onstream-6a46b.firebaseapp.com",
  projectId: "onstream-6a46b",
  storageBucket: "onstream-6a46b.appspot.com",
  messagingSenderId: "635674662728",
  appId: "1:635674662728:web:603b0f17a1e43fd096457d",
  measurementId: "G-Y6J312X406",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export { app, storage };
