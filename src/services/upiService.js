/**
 * Raghavendra Chitts — UPI Intent & Payment Deep Link Service
 *
 * Provides dynamic UPI intent link generation (upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...)
 * calculating amounts dynamically based on Group Base Monthly + Member Pending - Member Balance.
 */

export function getAdminUpiConfig() {
  const savedUpiId = typeof window !== 'undefined' ? localStorage.getItem('admin_upi_id') : null;
  const savedPayeeName = typeof window !== 'undefined' ? localStorage.getItem('admin_payee_name') : null;

  return {
    upiId: savedUpiId || import.meta.env?.VITE_ADMIN_UPI_ID || 'raghavendrachitts@upi',
    payeeName: savedPayeeName || 'Raghavendra Chitts',
  };
}

export function saveAdminUpiConfig({ upiId, payeeName }) {
  if (typeof window !== 'undefined') {
    if (upiId && upiId.trim()) localStorage.setItem('admin_upi_id', upiId.trim());
    if (payeeName && payeeName.trim()) localStorage.setItem('admin_payee_name', payeeName.trim());
  }
}

export function calculateMemberPayableAmount(member, groupPaymentSettings = {}) {
  if (!member || !member.chits || !member.chits.length) return 0;

  return member.chits.reduce((total, chit) => {
    if (chit.status && chit.status !== 'ACTIVE') return total;

    const val = chit.totalChitValue || 100000;
    const grp = chit.groupId || 'I';
    const settingKey = `${val}_${grp}`;

    const baseGroupMonthly = typeof groupPaymentSettings[settingKey] === 'number' && groupPaymentSettings[settingKey] > 0
      ? groupPaymentSettings[settingKey]
      : (chit.amountToPay || Math.floor(val / 20));

    const quantity = Number(chit.quantity || 1);
    const pending = Number(chit.pending || 0);
    const balance = Number(chit.balance || 0);

    const chitPayable = Math.max((baseGroupMonthly * quantity) + pending - balance, 0);
    return total + chitPayable;
  }, 0);
}

export function generateUpiPayLink({ member, groupPaymentSettings = {}, customAmount = null }) {
  const config = getAdminUpiConfig();
  const amount = customAmount !== null ? customAmount : calculateMemberPayableAmount(member, groupPaymentSettings);

  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      amount: 0,
      upiUrl: null,
      formattedAmount: '₹0',
      message: 'No payment required (Payable Amount is ₹0).',
    };
  }

  const memberName = member?.name || 'Member';
  const memberId = member?.id || 'MEM';
  const firstChit = member?.chits?.[0];
  const grp = firstChit?.groupId || 'I';

  const note = `Raghavendra Chitts - Payment for ${memberName} (${memberId}) - Group ${grp}`;

  const queryParams = new URLSearchParams({
    pa: config.upiId,
    pn: config.payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });

  const upiUrl = `upi://pay?${queryParams.toString()}`;

  return {
    success: true,
    amount,
    formattedAmount: `₹${amount.toLocaleString('en-IN')}`,
    upiUrl,
    upiId: config.upiId,
    payeeName: config.payeeName,
    note,
  };
}
