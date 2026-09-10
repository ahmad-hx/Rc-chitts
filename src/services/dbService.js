import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { historyService } from './historyService.js';

// Helper to normalize phone numbers for deduplication
function normalizePhone(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.startsWith('91')) return digits;
  return `91${digits}`;
}

// Helper to ensure Firebase auth state has loaded before querying Firestore
async function ensureAuthReady() {
  if (auth.authStateReady) {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.warn('[FIREBASE AUTH STATE NOTICE]', e?.message);
    }
  }
}

// Helper to recursively strip undefined properties so Firestore SDK does not fail
export function sanitizeForFirestore(data) {
  if (data === null || data === undefined) {
    return null;
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (data.constructor && data.constructor.name !== 'Object' && !Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item));
  }
  const sanitized = {};
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (value !== undefined) {
      sanitized[key] = sanitizeForFirestore(value);
    }
  }
  return sanitized;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER SERVICE (Firestore-only, NO mock fallbacks)
// ─────────────────────────────────────────────────────────────────────────────
export const memberService = {
  async getMembers() {
    await ensureAuthReady();

    const authUid = auth.currentUser?.uid ?? null;
    const authEmail = auth.currentUser?.email ?? null;
    const emailVerified = auth.currentUser?.emailVerified ?? null;
    const projectId = db.app?.options?.projectId ?? 'raghavendra-chitts-c0822';

    console.log('[FIREBASE DIAGNOSTIC READ]\n' +
      `projectId: ${projectId}\n` +
      `databaseId: (default)\n` +
      `collection: members\n` +
      `authUid: ${authUid}\n` +
      `authEmail: ${authEmail}\n` +
      `emailVerified: ${emailVerified}`
    );

    try {
      const querySnapshot = await getDocs(collection(db, 'members'));
      const members = [];
      querySnapshot.forEach((docSnap) => {
        const rawData = docSnap.data() || {};
        let rawChits = rawData.chits || rawData.holdings || rawData.assignedChits || rawData.assignedChit;

        if (rawChits && !Array.isArray(rawChits)) {
          rawChits = [rawChits];
        }

        let chits = Array.isArray(rawChits)
          ? rawChits.map((c) => {
              const val = Number(c?.totalChitValue || c?.totalValue || c?.chitValue || rawData.totalChitValue || rawData.chitValue || 100000);
              const qty = Number(c?.quantity || 1);
              const gId = String(c?.groupId || c?.group || c?.chitGroup || rawData.groupId || rawData.group || rawData.chitGroup || 'I');
              const explicitMonthly = Number(c?.monthlyAmount ?? c?.amountToPay ?? c?.chitAmount ?? c?.monthlyBase ?? rawData.monthlyAmount ?? rawData.amountToPay ?? 0);
              const resolvedMonthly = explicitMonthly > 0 ? explicitMonthly : Math.floor(val / 20);
              return {
                id: c?.id || `chit_${docSnap.id}_${gId}`,
                name: c?.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${gId})`,
                groupId: gId,
                totalChitValue: val,
                monthlyAmount: resolvedMonthly,
                amountToPay: resolvedMonthly,
                pending: Number(c?.pending || 0),
                balance: Number(c?.balance || 0),
                balanceAmount: Number(c?.balanceAmount || val),
                hasCustomMonthlyAmount: Boolean(c?.hasCustomMonthlyAmount),
                customMonthlyAmount: typeof c?.customMonthlyAmount === 'number' ? c.customMonthlyAmount : undefined,
                quantity: qty,
                status: c?.status || 'ACTIVE',
              };
            })
          : [];

        // If no embedded chits array, but group fields exist on root member doc:
        if (chits.length === 0 && (rawData.group || rawData.groupId || rawData.chitGroup || rawData.chitId)) {
          const gId = String(rawData.group || rawData.groupId || rawData.chitGroup || 'I');
          const val = Number(rawData.chitValue || rawData.totalChitValue || rawData.totalValue || 100000);
          const explicitMonthly = Number(rawData.monthlyAmount ?? rawData.amountToPay ?? rawData.chitAmount ?? 0);
          const resolvedMonthly = explicitMonthly > 0 ? explicitMonthly : Math.floor(val / 20);
          chits = [{
            id: `chit_${docSnap.id}_${gId}`,
            name: `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${gId})`,
            groupId: gId,
            totalChitValue: val,
            monthlyAmount: resolvedMonthly,
            amountToPay: resolvedMonthly,
            pending: Number(rawData.pending || rawData.pendingAmount || 0),
            balance: Number(rawData.balance || rawData.balanceAmount || 0),
            balanceAmount: Number(rawData.balanceAmount || val),
            quantity: Number(rawData.quantity || 1),
            status: rawData.status || 'ACTIVE',
          }];
        }

        const calculatedTotalChitValue = chits.reduce((sum, c) => sum + (c.totalChitValue * c.quantity), 0);

        const memberObj = {
          id: docSnap.id,
          memberKey: rawData.memberKey || docSnap.id,
          name: rawData.name || rawData.memberName || rawData.fullName || 'Unnamed Member',
          phone: rawData.phone || rawData.phoneNumber || rawData.mobile || rawData.whatsappNumber || rawData.whatsapp || '',
          whatsapp: rawData.whatsapp || rawData.whatsappNumber || rawData.phone || rawData.phoneNumber || rawData.mobile || '',
          group: rawData.group || rawData.groupId || rawData.chitGroup || (chits[0]?.groupId) || '',
          groupId: rawData.groupId || rawData.group || rawData.chitGroup || (chits[0]?.groupId) || '',
          sharedPhone: Boolean(rawData.sharedPhone),
          sharedPhoneWith: rawData.sharedPhoneWith || [],
          phoneNumbers: rawData.phoneNumbers || (rawData.phone ? [rawData.phone] : []),
          sourceNames: rawData.sourceNames || [rawData.name || 'Unnamed Member'],
          status: rawData.status || 'active',
          chits,
          holdings: chits,
          totalHoldings: rawData.totalHoldings || chits.reduce((sum, c) => sum + c.quantity, 0),
          classification: rawData.classification || rawData.memberType || (chits.reduce((sum, c) => sum + c.quantity, 0) > 1 ? 'MULTIPLE' : 'SINGLE'),
          calculatedTotalChitValue,
        };

        members.push(memberObj);
      });

      console.log('[FIREBASE READ DIAGNOSTIC SUCCESS]\n' +
        `collection: members\n` +
        `returnedDocumentCount: ${members.length}\n` +
        `authEmail: ${authEmail}`
      );

      return members;
    } catch (err) {
      console.error('[FIREBASE READ ERROR DIAGNOSTIC]\n' +
        `name: ${err?.name ?? 'Error'}\n` +
        `code: ${err?.code ?? 'unknown'}\n` +
        `message: ${err?.message ?? String(err)}\n` +
        `stack: ${err?.stack ?? 'N/A'}`
      );
      console.error('FULL FIREBASE ERROR:', err);
      throw err;
    }
  },

  async getMemberById(memberId) {
    await ensureAuthReady();
    try {
      const docRef = doc(db, 'members', memberId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const rawData = docSnap.data() || {};
        const rawChits = rawData.chits || rawData.holdings || [];
        const chits = Array.isArray(rawChits)
          ? rawChits.map((c) => {
              const val = Number(c?.totalChitValue || 100000);
              const explicitMonthly = Number(c?.monthlyAmount ?? c?.amountToPay ?? c?.chitAmount ?? c?.monthlyBase ?? rawData?.monthlyAmount ?? rawData?.amountToPay ?? 0);
              const resolvedMonthly = explicitMonthly > 0 ? explicitMonthly : Math.floor(val / 20);
              return {
                id: c?.id || `chit_${docSnap.id}_${c?.groupId || 'I'}`,
                name: c?.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${c?.groupId || 'I'})`,
                groupId: c?.groupId || 'I',
                totalChitValue: val,
                monthlyAmount: resolvedMonthly,
                amountToPay: resolvedMonthly,
                pending: Number(c?.pending || 0),
                balance: Number(c?.balance || 0),
                balanceAmount: Number(c?.balanceAmount || val),
                hasCustomMonthlyAmount: Boolean(c?.hasCustomMonthlyAmount),
                customMonthlyAmount: typeof c?.customMonthlyAmount === 'number' ? c.customMonthlyAmount : undefined,
                quantity: Number(c?.quantity || 1),
                status: c?.status || 'ACTIVE',
              };
            })
          : [];

        return {
          id: docSnap.id,
          ...rawData,
          chits,
          holdings: chits,
          totalHoldings: rawData.totalHoldings || chits.reduce((sum, c) => sum + c.quantity, 0),
          classification: rawData.classification || (chits.reduce((sum, c) => sum + c.quantity, 0) > 1 ? 'MULTIPLE' : 'SINGLE'),
        };
      }
      return null;
    } catch (err) {
      console.error('Firestore getMemberById error:', err.message);
      throw new Error('Unable to load data from Firebase.');
    }
  },

  async checkDuplicateMember({ phone, whatsapp, name }) {
    await ensureAuthReady();
    const cleanPhone = normalizePhone(phone);
    const cleanWhatsApp = normalizePhone(whatsapp);

    try {
      const membersRef = collection(db, 'members');
      const qSnap = await getDocs(membersRef);
      let duplicate = null;

      qSnap.forEach((docSnap) => {
        const m = docSnap.data();
        const mPhone = normalizePhone(m.phone);
        const mWa = normalizePhone(m.whatsapp);

        if (cleanPhone && (mPhone === cleanPhone || mWa === cleanPhone)) {
          duplicate = { id: docSnap.id, ...m, matchReason: 'phone' };
        } else if (cleanWhatsApp && (mPhone === cleanWhatsApp || mWa === cleanWhatsApp)) {
          duplicate = { id: docSnap.id, ...m, matchReason: 'whatsapp' };
        } else if (name && m.name && m.name.trim().toLowerCase() === name.trim().toLowerCase()) {
          duplicate = { id: docSnap.id, ...m, matchReason: 'name' };
        }
      });

      return duplicate;
    } catch (err) {
      console.error('Firestore checkDuplicateMember error:', err.message);
      return null;
    }
  },

  async addMember(memberData) {
    await ensureAuthReady();
    const existing = await this.checkDuplicateMember({
      phone: memberData.phone,
      whatsapp: memberData.whatsapp,
      name: memberData.name,
    });

    if (existing) {
      throw new Error(`Member already exists with matching ${existing.matchReason}: "${existing.name}" (${existing.phone}).`);
    }

    try {
      const docRef = await addDoc(collection(db, 'members'), {
        ...memberData,
        phone: normalizePhone(memberData.phone),
        whatsapp: normalizePhone(memberData.whatsapp || memberData.phone),
        status: memberData.status || 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { id: docRef.id, ...memberData };
    } catch (err) {
      console.error('Firestore addMember error:', err.message);
      throw new Error('Unable to add member to Firebase.');
    }
  },

  async updateMember(memberId, updateData) {
    await ensureAuthReady();
    try {
      const docRef = doc(db, 'members', memberId);
      const sanitizedData = sanitizeForFirestore(updateData);
      await updateDoc(docRef, {
        ...sanitizedData,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.error("Firebase member update failed", {
        code: err?.code,
        message: err?.message,
        memberId,
        updateData
      });
      throw err;
    }
  },

  async updateMemberAdjustment(memberId, chitId, pendingAmount, balanceAmount) {
    await ensureAuthReady();
    try {
      const docRef = doc(db, 'members', memberId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Member not found in Firestore.');
      }

      const data = docSnap.data() || {};
      const currentChits = data.chits || data.holdings || [];
      const updatedChits = currentChits.map((c) => {
        const cId = c?.id || `chit_${docSnap.id}_${c?.groupId || 'I'}`;
        if (cId === chitId || c.groupId === chitId) {
          return {
            ...c,
            pending: Math.max(Number(pendingAmount) || 0, 0),
            balance: Math.max(Number(balanceAmount) || 0, 0),
          };
        }
        return c;
      });

      await updateDoc(docRef, {
        chits: updatedChits,
        holdings: updatedChits,
        updatedAt: serverTimestamp(),
      });

      return updatedChits;
    } catch (err) {
      console.error('Firestore updateMemberAdjustment error:', err.message);
      throw new Error('Unable to update member pending/balance adjustment in Firebase.');
    }
  },

  async updateMemberSubscriptionMonthlyAmount(memberId, subscriptionId, newMonthlyAmount) {
    await ensureAuthReady();
    const parsedAmount = Number(newMonthlyAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Please enter a valid positive monthly amount.');
    }

    try {
      const docRef = doc(db, 'members', memberId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Member not found in Firestore.');
      }

      const data = docSnap.data() || {};
      const currentChits = data.chits || data.holdings || [];
      const updatedChits = currentChits.map((c, idx) => {
        const cId = c?.id || `chit_${docSnap.id}_${c?.groupId || 'I'}`;
        const matches = String(cId) === String(subscriptionId) ||
          String(c?.id) === String(subscriptionId) ||
          String(c?.groupId) === String(subscriptionId) ||
          idx === subscriptionId;

        if (matches) {
          return {
            ...c,
            monthlyAmount: parsedAmount,
            amountToPay: parsedAmount,
            customMonthlyAmount: parsedAmount,
            hasCustomMonthlyAmount: true,
          };
        }
        return c;
      });

      await updateDoc(docRef, {
        chits: updatedChits,
        holdings: updatedChits,
        updatedAt: serverTimestamp(),
      });

      return updatedChits;
    } catch (err) {
      console.error('Firestore updateMemberSubscriptionMonthlyAmount error:', err.message);
      throw new Error(`Unable to update subscription monthly amount: ${err.message}`);
    }
  },

  async archiveMember(memberId, memberData = null) {
    await ensureAuthReady();
    try {
      const docRef = doc(db, 'members', memberId);
      await updateDoc(docRef, {
        status: 'archived',
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Log event into History collection asynchronously
      try {
        await historyService.logHistoryEvent({
          category: 'Member',
          action: 'MEMBER_ARCHIVED',
          title: `Member Archived: ${memberData?.name || memberId}`,
          details: `Member ${memberData?.name || memberId} (${memberData?.phone || 'No phone'}) was archived and moved to History.`,
          entityId: memberId,
          entityType: 'MEMBER',
          previousData: memberData,
          memberId: memberId,
        });
      } catch (logErr) {
        console.warn('History logging notice:', logErr?.message);
      }

      return true;
    } catch (err) {
      console.error('Firestore archiveMember error:', err.message);
      throw new Error('Unable to archive member in Firebase.');
    }
  },

  async deleteMember(memberId, memberData = null) {
    await ensureAuthReady();
    try {
      const docRef = doc(db, 'members', memberId);
      await deleteDoc(docRef);

      // Log event into History collection asynchronously
      try {
        await historyService.logHistoryEvent({
          category: 'Member',
          action: 'MEMBER_DELETED',
          title: `Member Permanently Deleted: ${memberData?.name || memberId}`,
          details: `Member ${memberData?.name || memberId} (${memberData?.phone || 'No phone'}) was permanently deleted. Financial transaction records remain intact for accounting consistency.`,
          entityId: memberId,
          entityType: 'MEMBER',
          previousData: memberData,
          memberId: memberId,
        });
      } catch (logErr) {
        console.warn('History logging notice:', logErr?.message);
      }

      return true;
    } catch (err) {
      console.error('Firestore deleteMember error:', err.message);
      throw new Error('Unable to permanently delete member from Firebase.');
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHIT & HOLDINGS SERVICE (Firestore-only)
// ─────────────────────────────────────────────────────────────────────────────
export const chitService = {
  async getChits() {
    await ensureAuthReady();
    const authEmail = auth.currentUser?.email ?? null;
    const projectId = db.app?.options?.projectId ?? 'raghavendra-chitts-c0822';

    console.log('[FIREBASE DIAGNOSTIC READ]\n' +
      `projectId: ${projectId}\n` +
      `databaseId: (default)\n` +
      `collection: chits\n` +
      `authEmail: ${authEmail}`
    );

    try {
      // 1. Fetch explicit group documents from Firestore 'chits' collection
      let explicitChits = [];
      try {
        const qSnap = await getDocs(collection(db, 'chits'));
        qSnap.forEach((d) => explicitChits.push({ id: d.id, ...d.data() }));
      } catch (chitErr) {
        console.warn('Firestore chits collection fetch notice:', chitErr?.message);
      }

      // 2. Fetch member holdings to ensure all existing groups are preserved even if unseeded in 'chits' collection
      let members = [];
      try {
        members = await memberService.getMembers();
      } catch (memErr) {
        console.warn('Member fetch in getChits notice:', memErr?.message);
      }

      // Unified Map to hold all groups keyed by `${cleanGroupId}_${totalChitValue}`
      const groupMap = new Map();

      // First pass: Discover and populate all groups referenced across member holdings
      if (Array.isArray(members)) {
        members.forEach((m) => {
          (m.chits || []).forEach((c) => {
            const rawGId = String(c?.groupId || c?.group || 'I').trim();
            const cleanGId = rawGId.toUpperCase();
            const val = Number(c?.totalChitValue || c?.totalValue || c?.chitValue || 100000);
            const key = `${cleanGId}_${val}`;

            if (!groupMap.has(key)) {
              groupMap.set(key, {
                id: `group_${cleanGId}_${val}`,
                groupId: cleanGId,
                name: c?.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${cleanGId})`,
                totalChitValue: val,
                monthlyPremium: Number(c?.monthlyAmount || Math.floor(val / 20)),
                duration: '20 Months',
                capacity: 20,
                startingMonth: c?.startingMonth || c?.startMonth || 'March 2026',
                nextAuctionDate: '15th of Month',
                status: 'ACTIVE',
                enrolledMembers: 0,
              });
            }
            groupMap.get(key).enrolledMembers += Number(c?.quantity || 1);
          });
        });
      }

      // Second pass: Merge explicit 'chits' documents from Firestore (takes priority for metadata like startingMonth, custom name, etc.)
      explicitChits.forEach((docData) => {
        const rawGId = String(docData.groupId || docData.id || 'I').replace(/^group_/, '').split('_')[0] || 'I';
        const cleanGId = rawGId.trim().toUpperCase();
        const val = Number(docData.totalChitValue || docData.totalValue || docData.chitValue || 100000);
        const key = `${cleanGId}_${val}`;

        const existing = groupMap.get(key) || {};

        groupMap.set(key, {
          id: docData.id || existing.id || `group_${cleanGId}_${val}`,
          groupId: docData.groupId ? String(docData.groupId).trim().toUpperCase() : cleanGId,
          name: docData.name || existing.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${cleanGId})`,
          totalChitValue: val,
          monthlyPremium: Number(docData.monthlyPremium || existing.monthlyPremium || Math.floor(val / 20)),
          capacity: Number(docData.capacity || existing.capacity || 20),
          duration: docData.duration || existing.duration || '20 Months',
          startingMonth: docData.startingMonth || docData.startMonth || existing.startingMonth || 'March 2026',
          nextAuctionDate: docData.nextAuctionDate || existing.nextAuctionDate || '15th of Month',
          status: docData.status || existing.status || 'ACTIVE',
          enrolledMembers: existing.enrolledMembers || 0,
          createdAt: docData.createdAt || existing.createdAt || null,
          updatedAt: docData.updatedAt || existing.updatedAt || null,
        });
      });

      return Array.from(groupMap.values());
    } catch (err) {
      console.error('[FIREBASE READ ERROR DIAGNOSTIC in getChits]\n', err);
      throw err;
    }
  },

  async getHoldings(memberId) {
    await ensureAuthReady();
    try {
      const holdingsRef = collection(db, 'holdings');
      const q = query(holdingsRef, where('memberId', '==', memberId));
      const qSnap = await getDocs(q);
      const holdings = [];
      qSnap.forEach((d) => holdings.push({ id: d.id, ...d.data() }));
      return holdings;
    } catch (err) {
      console.error('Firestore getHoldings error:', err.message);
      throw new Error('Unable to load data from Firebase.');
    }
  },

  async associateHolding(holdingData) {
    await ensureAuthReady();
    try {
      const docRef = await addDoc(collection(db, 'holdings'), {
        ...holdingData,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...holdingData };
    } catch (err) {
      console.error('Firestore associateHolding error:', err.message);
      throw new Error('Unable to save holding to Firebase.');
    }
  },

  async createChit(chitData) {
    await ensureAuthReady();
    const gId = String(chitData.groupId || chitData.id || '').trim().toUpperCase();
    const val = Number(chitData.totalChitValue || chitData.totalValue || chitData.chitValue || 100000);
    const prem = Number(chitData.monthlyPremium || Math.floor(val / 20));
    const cap = Number(chitData.capacity || 20);
    const dur = chitData.duration || '20 Months';
    const startM = chitData.startingMonth || chitData.startMonth || 'March 2026';
    const nextAuc = chitData.nextAuctionDate || '15th of Month';
    const name = chitData.name?.trim() || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${gId})`;

    if (!gId) {
      throw new Error('Chit Group ID is required.');
    }

    const docId = `group_${gId}_${val}`;
    const docRef = doc(db, 'chits', docId);

    const fullChitData = {
      id: docId,
      groupId: gId,
      name,
      totalChitValue: val,
      monthlyPremium: prem,
      capacity: cap,
      duration: dur,
      startingMonth: startM,
      nextAuctionDate: nextAuc,
      status: 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, fullChitData, { merge: true });

      // Automatically register group payment setting for the monthly base amount
      try {
        await groupPaymentSettingsService.saveGroupPaymentSetting({
          chitValue: val,
          groupId: gId,
          monthlyAmount: prem,
        });
      } catch (_) {}

      // Log history event
      try {
        await historyService.logHistoryEvent({
          category: 'Group',
          action: 'GROUP_CREATED',
          title: `New Chit Group Created: ${name}`,
          details: `Chit Group ${name} (Value: ₹${val.toLocaleString('en-IN')}, Premium: ₹${prem.toLocaleString('en-IN')}, Starting Month: ${startM}) established and saved to Firebase.`,
          entityId: docId,
          entityType: 'GROUP',
          groupId: gId,
          chitValue: val,
        });
      } catch (_) {}

      return fullChitData;
    } catch (err) {
      console.error('Firestore createChit error:', err.message);
      throw new Error(`Failed to create chit group in Firebase: ${err.message}`);
    }
  },

  async updateChitGroupStartingMonth(groupId, chitValue = 100000, startingMonth = 'March 2026', groupDocId = null) {
    await ensureAuthReady();
    try {
      const gId = String(groupId).trim().toUpperCase();
      const val = Number(chitValue || 100000);
      const docId = groupDocId || `group_${gId}_${val}`;
      const docRef = doc(db, 'chits', docId);

      await setDoc(docRef, {
        id: docId,
        groupId: gId,
        totalChitValue: val,
        startingMonth,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      try {
        await historyService.logHistoryEvent({
          category: 'Group',
          action: 'GROUP_STARTING_MONTH_UPDATED',
          title: `Chit Group ${gId} Starting Month Updated: ${startingMonth}`,
          details: `Chit Group ${gId} (₹${(val / 100000).toFixed(0)}L) starting month configured to ${startingMonth} (Chit Month 1).`,
          entityId: docId,
          entityType: 'GROUP',
          groupId: gId,
          chitValue: val,
        });
      } catch (_) {}

      return true;
    } catch (err) {
      console.error('Firestore updateChitGroupStartingMonth error:', err.message);
      throw new Error(`Failed to update starting month: ${err.message}`);
    }
  },

  async deleteChitGroup(groupId, chitValue = 100000, chitId = null) {
    await ensureAuthReady();
    try {
      const gId = String(groupId).trim().toUpperCase();
      const val = Number(chitValue || 100000);
      const docId = chitId || `group_${gId}_${val}`;
      const docRef = doc(db, 'chits', docId);

      await deleteDoc(docRef);

      // Clean up group payment settings document if present
      try {
        const settingsDocRef = doc(db, 'groupPaymentSettings', `${val}_${gId}`);
        await deleteDoc(settingsDocRef);
      } catch (_) {}

      // Log event into History collection
      try {
        await historyService.logHistoryEvent({
          category: 'Group',
          action: 'GROUP_DELETED',
          title: `Chit Group Deleted: ₹${(val / 100000).toFixed(0)} Lakh Group ${gId}`,
          details: `Chit group ₹${(val / 100000).toFixed(0)} Lakh Group ${gId} was deleted. Historical financial transaction records remain preserved.`,
          entityId: docId,
          entityType: 'GROUP',
          groupId: gId,
          chitValue: val,
        });
      } catch (logErr) {
        console.warn('History logging notice:', logErr?.message);
      }

      return true;
    } catch (err) {
      console.error('Firestore deleteChitGroup error:', err.message);
      throw new Error(`Unable to delete chit group in Firebase: ${err.message}`);
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT SERVICE (Firestore-only)
// ─────────────────────────────────────────────────────────────────────────────
export const paymentService = {
  async getPayments() {
    await ensureAuthReady();
    try {
      const qSnap = await getDocs(collection(db, 'payments'));
      const list = [];
      qSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      return list;
    } catch (err) {
      console.error('Firestore getPayments error:', err.message);
      throw new Error('Unable to load payments from Firebase.');
    }
  },

  async addPayment(paymentData) {
    await ensureAuthReady();
    try {
      const docRef = await addDoc(collection(db, 'payments'), {
        ...paymentData,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...paymentData };
    } catch (err) {
      console.error('Firestore addPayment error:', err.message);
      throw new Error('Unable to record payment in Firebase.');
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GROUP PAYMENT SETTINGS SERVICE (Separate collection: groupPaymentSettings)
// ─────────────────────────────────────────────────────────────────────────────
export const groupPaymentSettingsService = {
  async getGroupPaymentSettings() {
    await ensureAuthReady();
    try {
      const qSnap = await getDocs(collection(db, 'groupPaymentSettings'));
      const settingsMap = {};
      const settingsList = [];

      qSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const key = `${data.chitValue}_${data.groupId}`;
        if (typeof data.monthlyAmount === 'number' || !isNaN(Number(data.monthlyAmount))) {
          settingsMap[key] = Number(data.monthlyAmount);
          settingsList.push({
            id: docSnap.id,
            chitValue: Number(data.chitValue),
            groupId: String(data.groupId),
            monthlyAmount: Number(data.monthlyAmount),
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          });
        }
      });

      return { settingsMap, settingsList };
    } catch (err) {
      console.error('Firestore getGroupPaymentSettings error:', err.message);
      return { settingsMap: {}, settingsList: [] };
    }
  },

  async saveGroupPaymentSetting({ chitValue, groupId, monthlyAmount }) {
    await ensureAuthReady();
    const val = Number(chitValue);
    const grp = String(groupId);
    const amt = Number(monthlyAmount);

    if (isNaN(val) || !grp || isNaN(amt) || amt <= 0) {
      throw new Error('Invalid chit value, group ID, or monthly amount.');
    }

    const docId = `${val}_${grp}`;
    const docRef = doc(db, 'groupPaymentSettings', docId);

    try {
      await setDoc(docRef, {
        chitValue: val,
        groupId: grp,
        monthlyAmount: amt,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'Admin',
      }, { merge: true });

      return { docId, chitValue: val, groupId: grp, monthlyAmount: amt };
    } catch (err) {
      console.error('Firestore saveGroupPaymentSetting error:', err.message);
      throw new Error(`Failed to save group payment setting: ${err.message}`);
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY RECORD SERVICE (Separate collection: monthlyAdjustments)
// Preserves historical month-by-month pending payments, paid amounts & balances
// ─────────────────────────────────────────────────────────────────────────────
export const monthlyRecordService = {
  async getMonthlyAdjustments(billingMonth = null) {
    await ensureAuthReady();
    try {
      const qSnap = await getDocs(collection(db, 'monthlyAdjustments'));
      const adjustmentsMap = {};
      const adjustmentsList = [];

      qSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const monthMatch = !billingMonth || data.billingMonth === billingMonth;
        if (monthMatch) {
          const key = `${data.memberId}_${data.groupId}_${data.billingMonth}`;
          adjustmentsMap[key] = {
            id: docSnap.id,
            memberId: data.memberId,
            memberName: data.memberName,
            groupId: data.groupId,
            billingMonth: data.billingMonth,
            chitAmount: Number(data.chitAmount || 0),
            paidAmount: Number(data.paidAmount || 0),
            pendingAmount: Number(data.pendingAmount || 0),
            balanceAmount: Number(data.balanceAmount || 0),
            status: data.status || 'PENDING',
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
          };
          adjustmentsList.push(adjustmentsMap[key]);
        }
      });

      return { adjustmentsMap, adjustmentsList };
    } catch (err) {
      console.error('Firestore getMonthlyAdjustments error:', err.message);
      return { adjustmentsMap: {}, adjustmentsList: [] };
    }
  },

  async saveMonthlyAdjustment({ memberId, memberName, groupId, billingMonth, chitAmount, paidAmount, pendingAmount, balanceAmount, status }) {
    await ensureAuthReady();
    const cleanMonthKey = String(billingMonth || 'August 2026').replace(/\s+/g, '_');
    const docId = `${memberId}_${groupId}_${cleanMonthKey}`;
    const docRef = doc(db, 'monthlyAdjustments', docId);

    const docData = {
      memberId,
      memberName: memberName || 'Member',
      groupId: String(groupId),
      billingMonth,
      chitAmount: Number(chitAmount || 0),
      paidAmount: Number(paidAmount || 0),
      pendingAmount: Number(pendingAmount || 0),
      balanceAmount: Number(balanceAmount || 0),
      status: status || (Number(pendingAmount) === 0 ? 'PAID' : (Number(paidAmount) > 0 ? 'PARTIAL' : 'PENDING')),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.email || 'Admin',
    };

    try {
      await setDoc(docRef, docData, { merge: true });
      return { id: docId, ...docData };
    } catch (err) {
      console.error('Firestore saveMonthlyAdjustment error:', err.message);
      throw new Error(`Failed to save monthly adjustment: ${err.message}`);
    }
  },

  async bulkSaveMonthlyAdjustments(recordsList) {
    await ensureAuthReady();
    if (!Array.isArray(recordsList) || recordsList.length === 0) return [];
    
    const results = [];
    for (const rec of recordsList) {
      try {
        const saved = await this.saveMonthlyAdjustment(rec);
        results.push(saved);
      } catch (err) {
        console.warn('Bulk save record warning:', err.message);
      }
    }
    return results;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AUCTION SERVICE (Separate collection: auctions)
// Preserves historical month-by-month auction winner marks per member & group
// ─────────────────────────────────────────────────────────────────────────────
export const auctionService = {
  async getAuctions(billingMonth = null) {
    await ensureAuthReady();
    try {
      const qSnap = await getDocs(collection(db, 'auctions'));
      const auctionsMap = {};
      const auctionsList = [];

      qSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const isDeleted = Boolean(data.isDeleted || data.status === 'DELETED');
        const isCompleted = (data.isAuctioned === true || data.status === 'COMPLETED') && !isDeleted;

        const formattedAuction = {
          id: docSnap.id,
          memberId: data.memberId,
          memberName: data.memberName || data.winner || 'Member',
          winnerName: data.memberName || data.winner || 'Member',
          groupId: String(data.groupId || 'I'),
          groupName: data.groupName || `Group ${data.groupId || 'I'}`,
          totalChitValue: Number(data.totalChitValue || data.chitValue || data.chitAmount || 100000),
          billingMonth: data.billingMonth || 'August 2026',
          isAuctioned: Boolean(data.isAuctioned),
          isDeleted,
          status: isDeleted ? 'DELETED' : data.status || (data.isAuctioned ? 'COMPLETED' : 'CANCELLED'),
          bidAmount: Number(data.bidAmount || 0),
          dividend: Number(data.dividend || 0),
          netPayout: Number(data.netPayout || data.payout || 0),
          roundNumber: Number(data.roundNumber || data.month || 1),
          auctionDate: data.auctionDate || (data.completedAt?.toDate ? data.completedAt.toDate().toISOString().split('T')[0] : null) || (data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString().split('T')[0] : null) || (typeof data.updatedAt === 'string' ? data.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0]),
          completedAt: data.completedAt?.toDate ? data.completedAt.toDate().toISOString() : data.completedAt || null,
          deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate().toISOString() : data.deletedAt || null,
          deletedBy: data.deletedBy || null,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || new Date().toISOString(),
        };

        const key = `${data.memberId}_${data.groupId}_${data.billingMonth}`;
        const monthMatch = !billingMonth || data.billingMonth === billingMonth;

        if (monthMatch && isCompleted) {
          auctionsMap[key] = formattedAuction;
        }

        // Keep all auctions in the list for history and audit views
        auctionsList.push(formattedAuction);
      });

      return { auctionsMap, auctionsList };
    } catch (err) {
      console.error('Firestore getAuctions error:', err.message);
      return { auctionsMap: {}, auctionsList: [] };
    }
  },

  async setAuctionStatus({
    memberId,
    memberName,
    groupId,
    groupName = '',
    totalChitValue = 100000,
    billingMonth = 'August 2026',
    isAuctioned,
    bidAmount = 0,
    dividend = 0,
    netPayout = 0,
    roundNumber = 1,
    auctionDate = null,
  }) {
    await ensureAuthReady();
    const cleanMonthKey = String(billingMonth || 'August 2026').replace(/\s+/g, '_');
    const docId = `${memberId}_${groupId}_${cleanMonthKey}`;
    const docRef = doc(db, 'auctions', docId);

    const actualDate = auctionDate || new Date().toISOString().split('T')[0];

    try {
      if (isAuctioned) {
        const docData = {
          memberId,
          memberName: memberName || 'Member',
          groupId: String(groupId),
          groupName: groupName || `Group ${groupId}`,
          totalChitValue: Number(totalChitValue || 100000),
          billingMonth: billingMonth || 'August 2026',
          isAuctioned: true,
          isDeleted: false,
          status: 'COMPLETED',
          bidAmount: Number(bidAmount || 0),
          dividend: Number(dividend || 0),
          netPayout: Number(netPayout || 0),
          roundNumber: Number(roundNumber || 1),
          auctionDate: actualDate,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || 'Admin',
        };
        await setDoc(docRef, docData, { merge: true });
        return { id: docId, ...docData };
      } else {
        await setDoc(docRef, { isAuctioned: false, status: 'CANCELLED', updatedAt: serverTimestamp() }, { merge: true });
        return { id: docId, isAuctioned: false };
      }
    } catch (err) {
      console.error('Firestore setAuctionStatus error:', err.message);
      throw new Error(`Failed to update auction status: ${err.message}`);
    }
  },

  async deleteAuction(auctionDocIdOrObj) {
    await ensureAuthReady();
    const docId = typeof auctionDocIdOrObj === 'string' ? auctionDocIdOrObj : auctionDocIdOrObj?.id;
    if (!docId) throw new Error('Auction document ID is required to delete.');

    const docRef = doc(db, 'auctions', docId);
    try {
      const deletePayload = {
        isAuctioned: false,
        isDeleted: true,
        status: 'DELETED',
        deletedAt: serverTimestamp(),
        deletedBy: auth.currentUser?.email || 'Admin',
        updatedAt: serverTimestamp(),
      };
      await setDoc(docRef, deletePayload, { merge: true });

      // Log immutable audit trail to history
      try {
        const targetObj = typeof auctionDocIdOrObj === 'object' ? auctionDocIdOrObj : {};
        await historyService.logHistoryEvent({
          action: 'AUCTION_DELETED',
          category: 'Auction',
          title: `Auction Deleted for Group ${targetObj?.groupId || ''}`,
          details: `Auction for ${targetObj?.memberName || 'Member'} (${targetObj?.billingMonth || 'Billing Month'}) was deleted from active view and preserved in Auction History.`,
          groupId: targetObj?.groupId,
          chitValue: targetObj?.totalChitValue,
          performedBy: auth.currentUser?.email || 'Admin',
        });
      } catch (_) {}

      return { id: docId, ...deletePayload };
    } catch (err) {
      console.error('Firestore deleteAuction error:', err.message);
      throw new Error(`Failed to delete auction: ${err.message}`);
    }
  },
};

