import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { historyService } from './historyService';

async function ensureAuthReady() {
  if (auth.authStateReady) {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.warn('[FIREBASE AUTH STATE NOTICE]', e?.message);
    }
  }
}

function normalizePhone(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.startsWith('91')) return digits;
  return `91${digits}`;
}

export const whatsappDbService = {
  /**
   * Record a sent/attempted WhatsApp message in the `whatsappMessages` Firestore collection.
   */
  async logWhatsAppMessage({
    memberId = null,
    memberName = 'Member',
    phoneNumber = '',
    chitGroupId = 'I',
    chitGroupName = 'Chit Group',
    billingMonth = 'August 2026',
    chitAmount = 100000,
    pendingAmount = 0,
    messageType = 'PAYMENT_REMINDER',
    language = 'bilingual',
    messageBody = '',
    status = 'Sent',
    provider = 'Meta Official Cloud API',
    providerMessageId = null,
    errorMessage = null,
  }) {
    await ensureAuthReady();
    const cleanPhone = normalizePhone(phoneNumber);
    const adminEmail = auth.currentUser?.email || 'Admin';

    try {
      const messagesRef = collection(db, 'whatsappMessages');
      const payload = {
        memberId: memberId ? String(memberId) : null,
        memberName: String(memberName),
        phoneNumber: cleanPhone,
        chitGroupId: String(chitGroupId),
        chitGroupName: String(chitGroupName),
        billingMonth: String(billingMonth),
        chitAmount: Number(chitAmount || 0),
        pendingAmount: Number(pendingAmount || 0),
        messageType: String(messageType),
        language: String(language),
        messageBody: String(messageBody),
        status: String(status),
        provider: String(provider),
        providerMessageId: providerMessageId ? String(providerMessageId) : null,
        errorMessage: errorMessage ? String(errorMessage) : null,
        sentBy: adminEmail,
        createdAt: new Date().toISOString(),
        sentAt: status === 'Sent' ? new Date().toISOString() : null,
        timestamp: serverTimestamp(),
      };

      const docRef = await addDoc(messagesRef, payload);

      // Write to new dedicated 'messageHistory' collection (Step 3)
      try {
        await addDoc(collection(db, 'messageHistory'), {
          recipientId: memberId ? String(memberId) : 'unknown',
          recipientName: String(memberName),
          phone: cleanPhone,
          channel: 'WHATSAPP',
          message: String(messageBody),
          status: String(status || 'SENT').toUpperCase(),
          source: 'ADMIN',
          groupId: String(chitGroupId),
          chitValue: Number(chitAmount || 100000),
          billingMonth: String(billingMonth),
          pendingAmount: Number(pendingAmount || 0),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (_) {}

      // Also register in general history audit log for completeness
      try {
        await historyService.logHistoryEvent({
          category: 'WhatsApp',
          action: status === 'Sent' ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
          title: `WhatsApp Message to ${memberName}`,
          details: `Sent ${messageType} for ${chitGroupName} (${billingMonth}). Status: ${status}`,
          entityId: docRef.id,
          entityType: 'WHATSAPP_MESSAGE',
          groupId: chitGroupId,
          chitValue: chitAmount,
          memberId: memberId,
        });
      } catch (_) {}

      return { id: docRef.id, ...payload };
    } catch (err) {
      console.error('Firestore logWhatsAppMessage error:', err.message);
      return null;
    }
  },

  /**
   * Check if a member has already received a reminder for the specified group, billing month, and message type.
   */
  async checkDuplicateWhatsAppMessage({ memberId, chitGroupId, billingMonth, messageType = 'PAYMENT_REMINDER' }) {
    await ensureAuthReady();
    if (!memberId || !chitGroupId || !billingMonth) return null;

    try {
      const messagesRef = collection(db, 'whatsappMessages');
      const qSnap = await getDocs(messagesRef);
      let duplicate = null;

      qSnap.forEach((docSnap) => {
        const d = docSnap.data() || {};
        if (
          String(d.memberId) === String(memberId) &&
          String(d.chitGroupId).toLowerCase() === String(chitGroupId).toLowerCase() &&
          String(d.billingMonth).toLowerCase() === String(billingMonth).toLowerCase() &&
          String(d.messageType || 'PAYMENT_REMINDER').toLowerCase() === String(messageType).toLowerCase() &&
          (d.status === 'Sent' || d.status === 'SENT')
        ) {
          duplicate = { id: docSnap.id, ...d };
        }
      });

      return duplicate;
    } catch (err) {
      console.error('Firestore checkDuplicateWhatsAppMessage error:', err.message);
      return null;
    }
  },

  /**
   * Retrieve message history logs with optional filtering.
   */
  async getWhatsAppHistory(filters = {}) {
    await ensureAuthReady();
    try {
      const messagesRef = collection(db, 'whatsappMessages');
      const qSnap = await getDocs(messagesRef);
      const list = [];

      qSnap.forEach((docSnap) => {
        const d = docSnap.data() || {};
        list.push({
          id: docSnap.id,
          ...d,
          sentAtDisplay: d.sentAt || d.createdAt || 'N/A',
        });
      });

      let filtered = list;

      if (filters.group && filters.group !== 'all') {
        filtered = filtered.filter(
          (m) =>
            String(m.chitGroupId).toLowerCase() === String(filters.group).toLowerCase() ||
            String(m.chitGroupName).toLowerCase().includes(String(filters.group).toLowerCase())
        );
      }

      if (filters.month && filters.month !== 'all') {
        filtered = filtered.filter(
          (m) => String(m.billingMonth).toLowerCase() === String(filters.month).toLowerCase()
        );
      }

      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(
          (m) => String(m.status).toLowerCase() === String(filters.status).toLowerCase()
        );
      }

      if (filters.searchQuery) {
        const sq = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            (m.memberName && m.memberName.toLowerCase().includes(sq)) ||
            (m.phoneNumber && m.phoneNumber.includes(sq)) ||
            (m.chitGroupName && m.chitGroupName.toLowerCase().includes(sq)) ||
            (m.billingMonth && m.billingMonth.toLowerCase().includes(sq))
        );
      }

      // Sort newest first
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      return filtered;
    } catch (err) {
      console.error('Firestore getWhatsAppHistory error:', err.message);
      return [];
    }
  },

  /**
   * Clear WhatsApp message history records without affecting members, chits, or payments.
   */
  async clearWhatsAppHistory() {
    await ensureAuthReady();
    try {
      const messagesRef = collection(db, 'whatsappMessages');
      const qSnap = await getDocs(messagesRef);
      const deletePromises = [];
      qSnap.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'whatsappMessages', docSnap.id)));
      });
      await Promise.all(deletePromises);
      return true;
    } catch (err) {
      console.error('Firestore clearWhatsAppHistory error:', err.message);
      throw new Error(`Failed to clear WhatsApp history: ${err.message}`);
    }
  },
};
