import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { IndianRupee } from 'lucide-react';
import { memberService } from '../services/dbService';

export default function RecordPaymentModal({ isOpen, onClose, onRecord, members: passedMembers }) {
  const [members, setMembers] = useState(passedMembers || []);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('RC-01');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (passedMembers && passedMembers.length > 0) {
      setMembers(passedMembers);
      setSelectedMemberId(passedMembers[0].id);
    } else {
      memberService.getMembers().then((list) => {
        if (list && list.length > 0) {
          setMembers(list);
          setSelectedMemberId(list[0].id);
        }
      }).catch(() => {});
    }
  }, [passedMembers]);

  const member = members.find(m => m.id === selectedMemberId) || members[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }

    const newTxn = {
      id: `TXN-${Math.floor(100 + Math.random() * 900)}`,
      member: member?.name || 'Member',
      phone: member?.phone || '',
      group: selectedGroupId,
      amount: parsedAmount,
      date: new Date().toISOString().split('T')[0],
      type: paymentMethod,
      status: 'cleared',
      note: note || 'Quick payment record'
    };

    onRecord?.(newTxn);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      subtitle="Log a new payment transaction into the system ledger."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Member *</label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.phone})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Chit Group *</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="RC-01">Group RC-01 (₹1L)</option>
              <option value="RC-02">Group RC-02 (₹2L)</option>
              <option value="RC-03">Group RC-03 (₹3L)</option>
              <option value="RC-05">Group RC-05 (₹5L)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Amount (₹) *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">₹</span>
              <input
                type="number"
                required
                placeholder="5000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans font-bold"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="online">Online / UPI</option>
              <option value="cash">Cash Counter</option>
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Date</label>
            <input
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reference / Note</label>
          <input
            type="text"
            placeholder="e.g. UPI Ref #902184 or Cash receipt #104"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" size="sm" className="gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" />
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
