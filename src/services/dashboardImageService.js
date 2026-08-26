/**
 * Raghavendra Chitts — Dashboard Image Storage Service
 *
 * Handles persistent image file storage in Firebase Storage
 * and metadata indexing in the 'dashboardImages' Firestore collection.
 */

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, auth } from '../firebase.js';

// Helper to ensure auth is ready before Firestore/Storage operations
const ensureAuthReady = async () => {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB max

export const dashboardImageService = {
  /**
   * Validate an image file before upload.
   * @param {File} file
   * @returns {{ valid: boolean, error?: string }}
   */
  validateImageFile(file) {
    if (!file) {
      return { valid: false, error: 'No file selected. Please choose an image.' };
    }

    const fileType = (file.type || '').toLowerCase();
    const fileName = (file.name || '').toLowerCase();
    const isExtensionAllowed = /\.(jpg|jpeg|png|webp)$/i.test(fileName);
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(fileType);

    if (!isMimeAllowed && !isExtensionAllowed) {
      return {
        valid: false,
        error: 'Invalid file format. Supported formats: JPG, JPEG, PNG, WEBP.',
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File is too large (${sizeMB} MB). Maximum allowed size is 15 MB.`,
      };
    }

    return { valid: true };
  },

  /**
   * Upload an image to Firebase Storage and save its metadata in Firestore.
   * @param {Object} params
   * @param {File} params.file - The image file to upload
   * @param {string} [params.title] - Optional title for the image
   * @param {string} [params.description] - Optional description for the image
   * @param {function} [params.onProgress] - Optional progress callback
   * @returns {Promise<Object>} The saved image document
   */
  async uploadDashboardImage({ file, title = '', description = '', onProgress = null }) {
    await ensureAuthReady();

    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 1. Generate unique image ID and clean storage path
    const uniqueId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sanitizedFileName = (file.name || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `dashboard-images/${uniqueId}/${sanitizedFileName}`;

    if (onProgress) onProgress({ status: 'uploading', message: 'Uploading image to Firebase Storage...' });

    // 2. Upload the binary file to Firebase Storage
    const storageRef = ref(storage, storagePath);
    const metadata = {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    };

    await uploadBytes(storageRef, file, metadata);

    // 3. Obtain public download URL
    if (onProgress) onProgress({ status: 'download_url', message: 'Generating download URL...' });
    const downloadUrl = await getDownloadURL(storageRef);

    // 4. Save metadata in dedicated 'dashboardImages' collection
    if (onProgress) onProgress({ status: 'saving_metadata', message: 'Saving image information in Firestore...' });

    const docData = {
      title: (title || '').trim(),
      description: (description || '').trim(),
      imageUrl: downloadUrl,
      storagePath,
      fileName: file.name,
      fileType: file.type || 'image/jpeg',
      fileSize: file.size,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'dashboardImages'), docData);

    if (onProgress) onProgress({ status: 'done', message: 'Image saved successfully!' });

    return {
      id: docRef.id,
      ...docData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Fetch all saved dashboard images from Firestore.
   * @returns {Promise<Array>} Array of saved image records
   */
  async getDashboardImages() {
    await ensureAuthReady();
    try {
      let qSnap;
      try {
        const q = query(collection(db, 'dashboardImages'), orderBy('createdAt', 'desc'));
        qSnap = await getDocs(q);
      } catch (_) {
        // Fallback if index on createdAt is not present
        qSnap = await getDocs(collection(db, 'dashboardImages'));
      }

      const images = [];
      qSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        let createdAtStr = new Date().toISOString();
        if (data.createdAt?.toDate) {
          createdAtStr = data.createdAt.toDate().toISOString();
        } else if (typeof data.createdAt === 'string') {
          createdAtStr = data.createdAt;
        }

        let updatedAtStr = createdAtStr;
        if (data.updatedAt?.toDate) {
          updatedAtStr = data.updatedAt.toDate().toISOString();
        } else if (typeof data.updatedAt === 'string') {
          updatedAtStr = data.updatedAt;
        }

        images.push({
          id: docSnap.id,
          title: data.title || '',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          storagePath: data.storagePath || '',
          fileName: data.fileName || 'image.jpg',
          fileType: data.fileType || 'image/jpeg',
          fileSize: Number(data.fileSize) || 0,
          createdAt: createdAtStr,
          updatedAt: updatedAtStr,
        });
      });

      // Sort by createdAt descending
      images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return images;
    } catch (err) {
      console.error('Firestore getDashboardImages error:', err.message);
      return [];
    }
  },

  /**
   * Delete an image from both Firebase Storage and Firestore.
   * @param {Object} imageDoc - The image document to delete
   * @returns {Promise<void>}
   */
  async deleteDashboardImage(imageDoc) {
    if (!imageDoc || !imageDoc.id) {
      throw new Error('Invalid image record for deletion.');
    }
    await ensureAuthReady();

    // 1. Delete the physical image file from Firebase Storage
    if (imageDoc.storagePath) {
      try {
        const storageRef = ref(storage, imageDoc.storagePath);
        await deleteObject(storageRef);
      } catch (storageErr) {
        console.warn('Storage file delete warning (continuing doc deletion):', storageErr.message);
      }
    }

    // 2. Delete the metadata document from Firestore
    try {
      await deleteDoc(doc(db, 'dashboardImages', imageDoc.id));
    } catch (firestoreErr) {
      console.error('Firestore document delete error:', firestoreErr.message);
      throw new Error(`Failed to delete image record: ${firestoreErr.message}`);
    }
  },

  /**
   * Update title and description for an existing image document.
   * @param {string} id - The document ID
   * @param {Object} updates - { title, description }
   * @returns {Promise<void>}
   */
  async updateDashboardImage(id, { title = '', description = '' }) {
    if (!id) throw new Error('Image ID is required for update.');
    await ensureAuthReady();

    const docRef = doc(db, 'dashboardImages', id);
    await updateDoc(docRef, {
      title: title.trim(),
      description: description.trim(),
      updatedAt: serverTimestamp(),
    });
  },
};
