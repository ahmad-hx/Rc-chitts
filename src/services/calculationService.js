import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

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
   * Fetch all saved calculations from Firestore 'calculations' collection.
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
          title: d.title || 'Untitled Calculation',
          content: d.content || '',
          result: d.result || '',
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString(),
          performedBy: d.performedBy || 'Admin',
        });
      });

      // Sort by updatedAt descending (newest updated first)
      list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      return list;
    } catch (err) {
      console.error('Firestore getCalculations error:', err.message);
      return [];
    }
  },

  /**
   * Save a new calculation to Firestore.
   */
  async createCalculation({ title = 'Untitled Calculation', content = '', result = '' }) {
    await ensureAuthReady();
    const adminUser = auth.currentUser?.email || 'Admin';
    const nowIso = new Date().toISOString();

    try {
      const calcRef = collection(db, 'calculations');
      const docRef = await addDoc(calcRef, {
        title: title.trim() || 'Untitled Calculation',
        content,
        result: String(result),
        createdAt: nowIso,
        updatedAt: nowIso,
        timestamp: serverTimestamp(),
        performedBy: adminUser,
      });

      return {
        id: docRef.id,
        title: title.trim() || 'Untitled Calculation',
        content,
        result: String(result),
        createdAt: nowIso,
        updatedAt: nowIso,
        performedBy: adminUser,
      };
    } catch (err) {
      console.error('Firestore createCalculation error:', err.message);
      throw err;
    }
  },

  /**
   * Update an existing calculation document in Firestore.
   */
  async updateCalculation(id, { title, content, result }) {
    if (!id) throw new Error('Calculation ID is required for update.');
    await ensureAuthReady();
    const nowIso = new Date().toISOString();

    try {
      const docRef = doc(db, 'calculations', id);
      const updateData = {
        updatedAt: nowIso,
        timestamp: serverTimestamp(),
      };

      if (title !== undefined) updateData.title = title.trim() || 'Untitled Calculation';
      if (content !== undefined) updateData.content = content;
      if (result !== undefined) updateData.result = String(result);

      await updateDoc(docRef, updateData);
      return { id, ...updateData };
    } catch (err) {
      console.error('Firestore updateCalculation error:', err.message);
      throw err;
    }
  },

  /**
   * Duplicate a calculation in Firestore.
   */
  async duplicateCalculation(calculation) {
    if (!calculation) throw new Error('Calculation object is required.');
    const duplicateTitle = `Copy of ${calculation.title || 'Untitled Calculation'}`;
    return await this.createCalculation({
      title: duplicateTitle,
      content: calculation.content || '',
      result: calculation.result || '',
    });
  },

  /**
   * Delete a calculation from Firestore.
   */
  async deleteCalculation(id) {
    if (!id) throw new Error('Calculation ID is required for deletion.');
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
