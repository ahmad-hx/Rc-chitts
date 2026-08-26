import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import { IndianRupee, Layers } from 'lucide-react';
import { memberService, paymentService, chitService, groupPaymentSettingsService } from '../services/dbService';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils';

export default function RecordPaymentModal({ isOpen, onClose, onRecord, members: passedMembers, groupPaymentSettings: passedSettings }) {
  const { selectedMonth } = useBillingMonth();
  const [members, setMembers] = useState(passedMembers || []);
  const [allChits, setAllChits] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState(passedSettings || {});
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('I');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI / GPay');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (passedMembers && passedMembers.length > 0) {
      setMembers(passedMembers);
      if (!selectedMemberId) setSelectedMemberId(passedMembers[0].id);
    } else {
      memberService.getMembers().then((list) => {
        if (list && list.length > 0) {
          setMembers(list);
          if (!selectedMemberId) setSelectedMemberId(list[0].id);
        }
      }).catch(() => {});
    }

    chitService.getChits().then((cList) => {
      setAllChits(Array.isArray(cList) ? cList : []);
    }).catch(() => {});

    if (!passedSettings || Object.keys(passedSettings).length === 0) {
      groupPaymentSettingsService.getGroupPaymentSettings().then((res) => {
        if (res && res.settingsMap) setGroupPaymentSettings(res.settingsMap);
      }).catch(() => {});
    }
  }, [passedMembers, passedSettings]);

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

  useEffect(() => {
    if (memberChits.length > 0) {
      const firstChit = memberChits[0];
      setSelectedGroupId(firstChit.groupId || 'I');
      const eff = getEffectiveMonthlyAmount(selectedMember, firstChit, groupPaymentSettings);
      setAmount(String(eff));
    } else if (allChits.length > 0) {
      setSelectedGroupId(allChits[0].groupId || 'I');
      setAmount(String(allChits[0].monthlyPremium || 5000));
    }
  }, [selectedMemberId, memberChits, selectedMember, groupPaymentSettings, allChits]);

  const handleGroupChange = (grpId) => {
    setSelectedGroupId(grpId);
    const target = memberChits.find((c) => c.groupId === grpId);
    if (target) {
      const eff = getEffectiveMonthlyAmount(selectedMember, target, groupPaymentSettings);
      setAmount(String(eff));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }

    if (!selectedMember) {
      setError('Please select a member.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const targetChit = memberChits.find((c) => c.groupId === selectedGroupId) || memberChits[0] || {};
    const newTxn = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      memberId: selectedMember.id,
      member: selectedMember.name || 'Member',
      memberName: selectedMember.name || 'Member',
      phone: selectedMember.phone || selectedMember.whatsapp || '',
      group: selectedGroupId,
      groupId: selectedGroupId,
      chitId: targetChit.id || `chit_${selectedMember.id}_${selectedGroupId}`,
      totalChitValue: Number(targetChit.totalChitValue || 100000),
      amount: parsedAmount,
      billingMonth: selectedMonth || 'August 2026',
      date: txnDate,
      type: paymentMethod,
      status: 'cleared',
      note: note.trim() || 'Manual receipt entry',
    };

    try {
      await paymentService.addPayment(newTxn);
      if (onRecord) {
        onRecord(newTxn);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record payment in Firebase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Member Payment"
      subtitle={`Log payment for ${selectedMonth} into the financial ledger.`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">Member *</label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.phone}) {m.classification === 'MULTIPLE' ? '• Multi-Chit' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">Chit Subscription *</label>
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
            >
              {memberChits.length > 0 ? (
                memberChits.map((c) => (
                  <option key={c.id || c.groupId} value={c.groupId}>
                    {c.name || `₹${((c.totalChitValue || 100000) / 100000).toFixed(0)} Lakh (Group ${c.groupId})`}
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

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">Amount Paid (₹) *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#6B6B67] font-bold text-xs">₹</span>
              <input
                type="number"
                required
                min="1"
                step="1"
                placeholder="5000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                className="w-full pl-7 pr-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50] font-sans"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
            >
              <option value="UPI / GPay">UPI / GPay / PhonePe</option>
              <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
              <option value="Cash Receipt">Cash Counter</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">Payment Date</label>
            <input
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">Reference / Note</label>
          <input
            type="text"
            placeholder="e.g. UPI Ref #902184 or Cash receipt #104"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E1]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="gap-1.5 bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold"
            disabled={isSubmitting}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Recording...' : 'Record Payment'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

