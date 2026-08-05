// ==========================================================================
// Firebase Storage — book covers and profile pictures
// ==========================================================================

import { storage } from "./firebase-config.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/**
 * Uploads a file and returns its public URL.
 * folder: "covers" | "avatars"
 */
export async function uploadImage(file, folder, fileName) {
  const path = `${folder}/${fileName}-${Date.now()}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
