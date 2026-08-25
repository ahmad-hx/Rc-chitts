import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

async function ensureAuthReady() {
  if (auth.authStateReady) {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.warn('[FIREBASE AUTH STATE NOTICE]', e?.message);
    }
  }
}

export const historyService = {
  /**
   * Log an immutable audit event to the `history` collection in Firestore.
   */
  async logHistoryEvent({
    category = 'General',
    action = 'ACTION',
    title = '',
    details = '',
    entityId = null,
    entityType = null,
    previousData = null,
    newData = null,
    year = new Date().getFullYear(),
    month = new Date().toLocaleString('en-US', { month: 'long' }),
    groupId = null,
    chitValue = null,
    memberId = null,
  }) {
    await ensureAuthReady();
    const adminUser = auth.currentUser?.email || 'Admin';

    try {
      const historyRef = collection(db, 'history');
      const docRef = await addDoc(historyRef, {
        category,
        action,
        title: title || `${action} - ${category}`,
        details,
        entityId,
        entityType,
        previousData,
        newData,
        year: Number(year),
        month: String(month),
        groupId: groupId ? String(groupId) : null,
        chitValue: chitValue ? Number(chitValue) : null,
        memberId: memberId ? String(memberId) : null,
        performedBy: adminUser,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (err) {
      console.error('Firestore logHistoryEvent error:', err.message);
      // Non-blocking fallback so UI operations complete smoothly
      return null;
    }
  },

  /**
   * Query history events from Firestore with flexible hierarchical filters.
   */
  async getHistoryEvents(filters = {}) {
    await ensureAuthReady();
    try {
      const historyRef = collection(db, 'history');
      const qSnap = await getDocs(historyRef);
      const list = [];

      qSnap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          ...d,
          year: d.year || (d.createdAt ? new Date(d.createdAt).getFullYear() : 2026),
          month: d.month || (d.createdAt ? new Date(d.createdAt).toLocaleString('en-US', { month: 'long' }) : 'August'),
        });
      });

      // Apply client-side filtering to ensure accurate results across all index combinations
      let filtered = list;

      if (filters.year && filters.year !== 'all') {
        filtered = filtered.filter((item) => String(item.year) === String(filters.year));
      }
      if (filters.month && filters.month !== 'all') {
        filtered = filtered.filter((item) => String(item.month).toLowerCase() === String(filters.month).toLowerCase());
      }
      if (filters.category && filters.category !== 'all') {
        filtered = filtered.filter((item) => String(item.category).toLowerCase() === String(filters.category).toLowerCase());
      }
      if (filters.chitValue && filters.chitValue !== 'all') {
        filtered = filtered.filter((item) => Number(item.chitValue) === Number(filters.chitValue));
      }
      if (filters.groupId && filters.groupId !== 'all') {
        filtered = filtered.filter((item) => String(item.groupId).toLowerCase() === String(filters.groupId).toLowerCase());
      }
      if (filters.memberId && filters.memberId !== 'all') {
        filtered = filtered.filter((item) => String(item.memberId) === String(filters.memberId) || (item.title && item.title.toLowerCase().includes(String(filters.memberId).toLowerCase())));
      }
      if (filters.searchQuery) {
        const sq = filters.searchQuery.toLowerCase();
        filtered = filtered.filter((item) =>
          (item.title && item.title.toLowerCase().includes(sq)) ||
          (item.details && item.details.toLowerCase().includes(sq)) ||
          (item.action && item.action.toLowerCase().includes(sq)) ||
          (item.category && item.category.toLowerCase().includes(sq))
        );
      }

      // Sort newest first
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      return filtered;
    } catch (err) {
      console.error('Firestore getHistoryEvents error:', err.message);
      return [];
    }
  },
};
