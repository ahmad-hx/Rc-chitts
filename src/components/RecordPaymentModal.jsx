import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import { IndianRupee } from 'lucide-react';
import { memberService, paymentService, chitService, groupPaymentSettingsService } from '../services/dbService';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils';

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onRecord,
  members: passedMembers,
  groupPaymentSettings: passedSettings,
  initialMemberId = '',
  initialGroupId = '',
  payments: passedPayments = null,
}) {
  const { selectedMonth } = useBillingMonth();
  const [members, setMembers] = useState(passedMembers || []);
  const [allChits, setAllChits] = useState([]);
  const [payments, setPayments] = useState(passedPayments || []);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState(passedSettings || {});
  
  const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId || '');
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || 'I');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI / GPay');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (passedMembers && passedMembers.length > 0) {
      setMembers(passedMembers);
      if (!selectedMemberId && !initialMemberId) {
        setSelectedMemberId(passedMembers[0].id);
      }
    } else {
      memberService.getMembers().then((list) => {
        if (list && list.length > 0) {
          setMembers(list);
          if (!selectedMemberId && !initialMemberId) {
            setSelectedMemberId(list[0].id);
          }
        }
      }).catch(() => {});
    }

    if (initialMemberId) setSelectedMemberId(initialMemberId);
    if (initialGroupId) setSelectedGroupId(initialGroupId);

    chitService.getChits().then((cList) => {
      setAllChits(Array.isArray(cList) ? cList : []);
    }).catch(() => {});

    if (!passedSettings || Object.keys(passedSettings).length === 0) {
      groupPaymentSettingsService.getGroupPaymentSettings().then((res) => {
        if (res && res.settingsMap) setGroupPaymentSettings(res.settingsMap);
      }).catch(() => {});
    }

    if (!passedPayments) {
      paymentService.getPayments().then((pList) => {
        setPayments(Array.isArray(pList) ? pList : []);
      }).catch(() => {});
    } else {
      setPayments(passedPayments);
    }
  }, [passedMembers, passedSettings, passedPayments, initialMemberId, initialGroupId]);

  const selectedMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId) || members[0] || null;
  }, [members, selectedMemberId]);

  const memberChits = useMemo(() => {
    if (!selectedMember) return [];
    const active = (selectedMember.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
    if (active.length > 0) return active;
    if (selectedMember.groupId || selectedMember.group) {
      return [{
        id: `chit_${selectedMember.id}_${selectedMember.groupId || selectedMember.group}`,
        groupId: selectedMember.groupId || selectedMember.group,
        name: `Group ${selectedMember.groupId || selectedMember.group}`,
        totalChitValue: selectedMember.calculatedTotalChitValue || 100000,
        amountToPay: selectedMember.amountToPay || 5000,
      }];
    }
    return [];
  }, [selectedMember]);

  const targetChit = useMemo(() => {
    return memberChits.find((c) => String(c.groupId).trim() === String(selectedGroupId).trim()) || memberChits[0] || null;
  }, [memberChits, selectedGroupId]);

  // Financial Breakdown Calculations for the selected Member & Chit Group for selectedMonth
  const financialSummary = useMemo(() => {
    if (!selectedMember || !targetChit) {
      return { dueAmount: 5000, alreadyPaid: 0, remainingAmount: 5000 };
    }

    const dueAmount = getEffectiveMonthlyAmount(selectedMember, targetChit, groupPaymentSettings);

    const mPhoneClean = (selectedMember.phone || selectedMember.whatsapp || '').replace(/\D/g, '');
    const mNameClean = (selectedMember.name || '').trim().toLowerCase();
    const gIdClean = String(targetChit.groupId || selectedGroupId || 'I').trim().toUpperCase().replace(/^GROUP\s+/, '');
    const isMultiChit = memberChits.length > 1;

    let alreadyPaid = 0;
    (payments || []).forEach((p) => {
      const pStatus = String(p.status || 'cleared').toLowerCase();
      if (pStatus === 'failed' || pStatus === 'cancelled') return;

      // Billing Month Check
      let pMonth = p.billingMonth;
      if (!pMonth && p.date) {
        try {
          const d = new Date(p.date);
          if (!isNaN(d.getTime())) pMonth = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        } catch (_) {}
      }
      if (pMonth && String(pMonth).trim().toLowerCase() !== String(selectedMonth).trim().toLowerCase()) {
        return;
      }

      // Member Check
      const isMemMatch =
        (p.memberId && p.memberId === selectedMember.id) ||
        (mPhoneClean && p.phone && p.phone.replace(/\D/g, '').endsWith(mPhoneClean)) ||
        (mNameClean && p.member && p.member.trim().toLowerCase() === mNameClean);

      if (!isMemMatch) return;

      // Group Check
      const pGrp = String(p.group || p.groupId || p.chitGroup || '').trim().toUpperCase().replace(/^GROUP\s+/, '');
      let isGrpMatch = false;
      if (!isMultiChit) {
        isGrpMatch = true;
      } else {
        if (p.chitId && (p.chitId === targetChit.id || p.chitId === targetChit.groupId)) {
          isGrpMatch = true;
        } else if (pGrp && pGrp !== 'ALL') {
          isGrpMatch = (gIdClean === pGrp || gIdClean.includes(pGrp) || pGrp.includes(gIdClean));
        } else {
          isGrpMatch = (gIdClean === String(selectedMember.groupId || selectedMember.group || 'I').replace(/^GROUP\s+/i, '').toUpperCase());
        }
      }

      if (isGrpMatch) {
        alreadyPaid += Number(p.amount || 0);
      }
    });

    const remainingAmount = Math.max(dueAmount - alreadyPaid, 0);

    return { dueAmount, alreadyPaid, remainingAmount };
  }, [selectedMember, targetChit, selectedGroupId, groupPaymentSettings, payments, selectedMonth, memberChits.length]);

  // Set default amount input to current remaining balance when member/chit selection changes
  useEffect(() => {
    if (financialSummary.remainingAmount > 0) {
      setAmount(String(financialSummary.remainingAmount));
    } else {
      setAmount('');
    }
    setError('');
  }, [selectedMemberId, selectedGroupId, financialSummary.remainingAmount]);

  const handleGroupChange = (grpId) => {
    setSelectedGroupId(grpId);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }

    if (parsedAmount > financialSummary.remainingAmount) {
      setError(`Maximum remaining amount is ₹${financialSummary.remainingAmount.toLocaleString('en-IN')}.`);
      return;
    }

    if (!selectedMember) {
      setError('Please select a member.');
      return;
    }

    setIsSubmitting(true);

    const activeTargetChit = targetChit || memberChits[0] || {};
    const newTxn = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      memberId: selectedMember.id,
      member: selectedMember.name || 'Member',
      memberName: selectedMember.name || 'Member',
      phone: selectedMember.phone || selectedMember.whatsapp || '',
      group: selectedGroupId,
      groupId: selectedGroupId,
      chitId: activeTargetChit.id || `chit_${selectedMember.id}_${selectedGroupId}`,
      totalChitValue: Number(activeTargetChit.totalChitValue || 100000),
      amount: parsedAmount,
      billingMonth: selectedMonth || 'August 2026',
      date: txnDate,
      type: paymentMethod,
      status: 'cleared',
      note: note.trim() || 'Manual receipt entry',
    };

    try {
      const saved = await paymentService.addPayment(newTxn);
      const newRemaining = Math.max(financialSummary.remainingAmount - parsedAmount, 0);
      const isFullyPaid = newRemaining <= 0;

      if (onRecord) {
        onRecord(saved || newTxn, { isFullyPaid, remaining: newRemaining });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record payment in Firebase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const enteredNum = parseFloat(amount) || 0;
  const isValidEntered = enteredNum > 0 && enteredNum <= financialSummary.remainingAmount;
  const previewTotalPaid = financialSummary.alreadyPaid + (isValidEntered ? enteredNum : 0);
  const previewRemaining = Math.max(financialSummary.dueAmount - previewTotalPaid, 0);
  const previewStatus = previewRemaining <= 0 ? 'PAID' : (previewTotalPaid > 0 ? 'PARTIAL' : 'PENDING');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      subtitle={`Record payment for ${selectedMember?.name || 'Member'} (${selectedMonth})`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {error && (
          <div className="p-3 bg-[#FEF3F2] border border-[#FECACA] text-[#B42318] text-xs rounded-xl font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* MEMBER SELECTOR */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Member *</label>
          <select
            value={selectedMemberId}
            onChange={(e) => {
              setSelectedMemberId(e.target.value);
              setError('');
            }}
            className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] font-bold focus:outline-none focus:ring-1 focus:ring-[#285F52] cursor-pointer"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.phone}) {m.classification === 'MULTIPLE' ? '• Multi-Chit' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* CHIT SUBSCRIPTION */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Chit Group *</label>
          <select
            value={selectedGroupId}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] font-bold focus:outline-none focus:ring-1 focus:ring-[#285F52] cursor-pointer"
          >
            {memberChits.length > 0 ? (
              memberChits.map((c) => (
                <option key={c.id || c.groupId} value={c.groupId}>
                  {c.name || `Group ${c.groupId} (₹${((c.totalChitValue || 100000) / 100000).toFixed(0)} Lakh)`}
                </option>
              ))
            ) : allChits.length > 0 ? (
              allChits.map((g) => (
                <option key={g.id || g.groupId} value={g.groupId}>
                  Group {g.groupId} (₹{((g.totalChitValue || 100000) / 100000).toFixed(0)}L)
                </option>
              ))
            ) : (
              <option value="I">Group I</option>
            )}
          </select>
        </div>

        {/* FINANCIAL SUMMARY BREAKDOWN BOX */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-center">
          <div className="space-y-0.5">
            <span className="text-[9px] font-extrabold text-[#667085] uppercase tracking-wider block">Monthly Amount</span>
            <span className="text-xs font-black text-[#111111]">₹{financialSummary.dueAmount.toLocaleString('en-IN')}</span>
          </div>

          <div className="space-y-0.5 border-x border-[#E5E7EB] px-1">
            <span className="text-[9px] font-extrabold text-[#667085] uppercase tracking-wider block">Already Paid</span>
            <span className="text-xs font-black text-[#285F52]">₹{financialSummary.alreadyPaid.toLocaleString('en-IN')}</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[9px] font-extrabold text-[#667085] uppercase tracking-wider block">Remaining</span>
            <span className="text-xs font-black text-[#B7791F]">₹{financialSummary.remainingAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* AMOUNT RECEIVED INPUT */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Payment Amount (₹) *</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#667085] font-bold text-xs">₹</span>
            <input
              type="number"
              required
              min="1"
              max={financialSummary.remainingAmount}
              step="1"
              placeholder="e.g. 2000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111111] font-bold focus:outline-none focus:ring-1 focus:ring-[#285F52] font-sans"
            />
          </div>
          <span className="text-[10px] text-[#667085] font-semibold block">
            Enter payment amount (max ₹{financialSummary.remainingAmount.toLocaleString('en-IN')}).
          </span>
        </div>

        {/* AFTER PAYMENT DYNAMIC PREVIEW */}
        {isValidEntered && (
          <div className="p-3 bg-[#EEF6F3] border border-[#BFD8D0] rounded-xl text-xs space-y-1 font-sans">
            <div className="flex items-center justify-between font-bold">
              <span className="text-[#285F52]">After this payment:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                previewStatus === 'PAID' ? 'bg-[#285F52] text-white' : 'bg-[#FFF8E7] text-[#B7791F]'
              }`}>
                {previewStatus === 'PAID' ? 'STATUS: PAID ✓ (Auto-completes & Removes from Pending)' : 'STATUS: PARTIAL (Stays in Pending)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#111111] font-semibold pt-0.5">
              <span>Total Paid: <strong>₹{previewTotalPaid.toLocaleString('en-IN')}</strong></span>
              <span>Remaining: <strong>₹{previewRemaining.toLocaleString('en-IN')}</strong></span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] font-bold focus:outline-none focus:ring-1 focus:ring-[#285F52] cursor-pointer"
            >
              <option value="UPI / GPay">UPI / GPay / PhonePe</option>
              <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
              <option value="Cash Receipt">Cash Counter</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Payment Date</label>
            <input
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] font-bold focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Reference / Note</label>
          <input
            type="text"
            placeholder="e.g. Partial payment / UPI Ref #902184"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting} className="rounded-xl text-xs font-bold border-[#E5E7EB]">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="gap-1.5 bg-[#285F52] hover:bg-[#214D43] text-white font-bold rounded-xl"
            disabled={isSubmitting}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Saving Payment...' : 'Save Payment'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
