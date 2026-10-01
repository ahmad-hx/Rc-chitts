import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

async function ensureAuthReady() {
  if (auth?.authStateReady) {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.warn('[FIREBASE AUTH STATE NOTICE]', e?.message);
    }
  }
}

export const calculationService = {
  /**
   * Fetch all saved working notes from Firestore 'calculations' collection.
   */
  async getCalculations() {
    await ensureAuthReady();
    try {
      const calcRef = collection(db, 'calculations');
      const qSnap = await getDocs(calcRef);
      const list = [];

      qSnap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          title: d.title || 'New Note',
          content: d.content || '',
          createdAt: d.createdAt || d.updatedAt || new Date().toISOString(),
          updatedAt: d.updatedAt || d.createdAt || new Date().toISOString(),
          createdBy: d.createdBy || d.performedBy || 'Admin',
        });
      });

      // Sort by updatedAt descending (newest updated first)
      list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      return list;
    } catch (err) {
      console.error('Firestore getCalculations error:', err.message);
      throw err;
    }
  },

  /**
   * Save a new working note to Firestore.
   */
  async createCalculation({ title = 'New Note', content = '' }) {
    await ensureAuthReady();
    const adminUser = auth.currentUser?.email || 'Admin';
    const nowIso = new Date().toISOString();

    try {
      const calcRef = collection(db, 'calculations');
      const docRef = await addDoc(calcRef, {
        title: title.trim() || 'New Note',
        content: content || '',
        createdAt: nowIso,
        updatedAt: nowIso,
        timestamp: serverTimestamp(),
        createdBy: adminUser,
        performedBy: adminUser,
      });

      return {
        id: docRef.id,
        title: title.trim() || 'New Note',
        content: content || '',
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: adminUser,
      };
    } catch (err) {
      console.error('Firestore createCalculation error:', err.message);
      throw err;
    }
  },

  /**
   * Update an existing note document in Firestore.
   */
  async updateCalculation(id, { title, content }) {
    if (!id) throw new Error('Note ID is required for update.');
    await ensureAuthReady();
    const nowIso = new Date().toISOString();

    try {
      const docRef = doc(db, 'calculations', id);
      const updateData = {
        updatedAt: nowIso,
        timestamp: serverTimestamp(),
      };

      if (title !== undefined) updateData.title = title.trim() || 'New Note';
      if (content !== undefined) updateData.content = content || '';

      await updateDoc(docRef, updateData);
      return { id, ...updateData };
    } catch (err) {
      console.error('Firestore updateCalculation error:', err.message);
      throw err;
    }
  },

  /**
   * Delete a note document from Firestore.
   */
  async deleteCalculation(id) {
    if (!id) throw new Error('Note ID is required for deletion.');
    await ensureAuthReady();

    try {
      const docRef = doc(db, 'calculations', id);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.error('Firestore deleteCalculation error:', err.message);
      throw err;
    }
  },
};

