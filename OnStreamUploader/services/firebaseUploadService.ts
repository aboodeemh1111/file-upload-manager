import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase";

export const uploadToFirebase = async (
  file: File | Blob,
  path: string = "uploads",
  metadata?: any
) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a unique filename
      const filename = `${path}/${Date.now()}-${
        "name" in file ? file.name : "file"
      }`;

      // Create storage reference
      const storageRef = ref(storage, filename);

      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      // Monitor upload progress
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload progress: ${progress}%`);
        },
        (error) => {
          // Handle errors
          reject(error);
        },
        async () => {
          // Upload completed successfully
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            success: true,
            url: downloadURL,
            name: "name" in file ? file.name : "uploaded-file",
            size: file.size,
            type: file.type,
            metadata: uploadTask.snapshot.metadata,
          });
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};
