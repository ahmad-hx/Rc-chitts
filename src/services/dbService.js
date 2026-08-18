import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';

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
        const rawChits = rawData.chits || rawData.holdings || [];

        const chits = Array.isArray(rawChits)
          ? rawChits.map((c) => {
              const val = Number(c?.totalChitValue || c?.totalValue || c?.chitValue || 100000);
              const qty = Number(c?.quantity || 1);
              return {
                id: c?.id || `chit_${docSnap.id}_${c?.groupId || 'I'}`,
                name: c?.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${c?.groupId || 'I'})`,
                groupId: c?.groupId || 'I',
                totalChitValue: val,
                amountToPay: Number(c?.amountToPay || Math.floor(val / 20)),
                pending: Number(c?.pending || 0),
                balance: Number(c?.balance || 0),
                balanceAmount: Number(c?.balanceAmount || val),
                quantity: qty,
                status: c?.status || 'ACTIVE',
              };
            })
          : [];

        const calculatedTotalChitValue = chits.reduce((sum, c) => sum + (c.totalChitValue * c.quantity), 0);

        const memberObj = {
          id: docSnap.id,
          memberKey: rawData.memberKey || docSnap.id,
          name: rawData.name || 'Unnamed Member',
          phone: rawData.phone || '',
          whatsapp: rawData.whatsapp || rawData.phone || '',
          sharedPhone: Boolean(rawData.sharedPhone),
          sharedPhoneWith: rawData.sharedPhoneWith || [],
          phoneNumbers: rawData.phoneNumbers || (rawData.phone ? [rawData.phone] : []),
          sourceNames: rawData.sourceNames || [rawData.name || 'Unnamed Member'],
          status: rawData.status || 'active',
          chits,
          holdings: chits,
          totalHoldings: rawData.totalHoldings || chits.reduce((sum, c) => sum + c.quantity, 0),
          classification: rawData.classification || (chits.reduce((sum, c) => sum + c.quantity, 0) > 1 ? 'MULTIPLE' : 'SINGLE'),
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
          ? rawChits.map((c) => ({
              id: c?.id || `chit_${docSnap.id}_${c?.groupId || 'I'}`,
              name: c?.name || `₹${(Number(c?.totalChitValue || 100000) / 100000).toFixed(0)} Lakh Chit (Group ${c?.groupId || 'I'})`,
              groupId: c?.groupId || 'I',
              totalChitValue: Number(c?.totalChitValue || 100000),
              amountToPay: Number(c?.amountToPay || 5000),
              pending: Number(c?.pending || 0),
              balance: Number(c?.balance || 0),
              balanceAmount: Number(c?.balanceAmount || 100000),
              quantity: Number(c?.quantity || 1),
              status: c?.status || 'ACTIVE',
            }))
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
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.error('Firestore updateMember error:', err.message);
      throw new Error('Unable to update member in Firebase.');
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
      const qSnap = await getDocs(collection(db, 'chits'));
      const list = [];
      qSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));

      if (list.length > 0) {
        return list.map((g) => ({
          ...g,
          totalChitValue: Number(g.totalChitValue || g.totalValue || g.chitValue || 100000),
          monthlyPremium: Number(g.monthlyPremium || Math.floor((g.totalChitValue || 100000) / 20)),
          capacity: Number(g.capacity || 20),
          duration: g.duration || '20 Months',
          nextAuctionDate: g.nextAuctionDate || '15th of Month',
        }));
      }

      // If chits collection has 0 documents, derive chit groups from Firestore members holdings!
      const members = await memberService.getMembers();
      const groupMap = new Map();

      members.forEach((m) => {
        (m.chits || []).forEach((c) => {
          const val = Number(c.totalChitValue || 100000);
          const key = `${c.groupId}_${val}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              id: `group_${key}`,
              groupId: c.groupId,
              name: `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${c.groupId})`,
              totalChitValue: val,
              monthlyPremium: Math.floor(val / 20),
              duration: '20 Months',
              capacity: 20,
              nextAuctionDate: '15th of Month',
              status: 'ACTIVE',
              enrolledMembers: 0,
            });
          }
          groupMap.get(key).enrolledMembers += c.quantity;
        });
      });

      return Array.from(groupMap.values());
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
