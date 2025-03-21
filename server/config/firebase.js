const admin = require("firebase-admin");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

// Use service account file directly
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "onstream-6a46b.appspot.com",
});

const bucket = admin.storage().bucket();

// Log the configuration to verify it's correct
console.log("Firebase config:", {
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

// Log more details about the configuration
console.log("Firebase config details:", {
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  serviceAccountEmail: serviceAccount.client_email,
  bucketName: bucket.name,
});

module.exports = {
  admin,
  bucket,
};
