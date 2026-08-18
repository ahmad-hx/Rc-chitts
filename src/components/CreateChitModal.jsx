import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Layers } from 'lucide-react';

export default function CreateChitModal({ isOpen, onClose, onCreate }) {
  const [groupId, setGroupId] = useState(`RC-0${Math.floor(6 + Math.random() * 4)}`);
  const [name, setName] = useState('');
  const [totalChitValue, setTotalChitValue] = useState('200000');
  const [duration, setDuration] = useState('20 Months');
  const [monthlyPremium, setMonthlyPremium] = useState('10000');
  const [capacity, setCapacity] = useState('20');
  const [nextAuctionDate, setNextAuctionDate] = useState('2026-09-01');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(totalChitValue);
    const prem = parseFloat(monthlyPremium);
    const cap = parseInt(capacity, 10);

    if (!groupId.trim()) {
      setError('Please provide a Chit Group ID.');
      return;
    }
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid total chit value.');
      return;
    }
    if (isNaN(prem) || prem <= 0) {
      setError('Please enter a valid monthly premium.');
      return;
    }
    if (isNaN(cap) || cap <= 0) {
      setError('Please enter a valid member capacity.');
      return;
    }

    const newChitGroup = {
      id: groupId.trim(),
      groupId: groupId.trim(),
      name: name.trim() || `₹${val.toLocaleString('en-IN')} Chit (${groupId.trim()})`,
      totalChitValue: val,
      monthlyPremium: prem,
      duration,
      capacity: cap,
      currentMembers: 1,
      nextAuctionDate,
      status: 'ACTIVE',
      auctionHistory: []
    };

    onCreate?.(newChitGroup);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Chit Group"
      subtitle="Establish a new chit group scheme and configure auction terms."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Group ID *</label>
            <input
              type="text"
              required
              placeholder="e.g. RC-06"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Chit Group Name</label>
            <input
              type="text"
              placeholder="Auto-generated if blank"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Value (₹) *</label>
            <input
              type="number"
              required
              placeholder="200000"
              value={totalChitValue}
              onChange={(e) => setTotalChitValue(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Premium (₹) *</label>
            <input
              type="number"
              required
              placeholder="10000"
              value={monthlyPremium}
              onChange={(e) => setMonthlyPremium(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Duration *</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="20 Months">20 Months</option>
              <option value="30 Months">30 Months</option>
              <option value="40 Months">40 Months</option>
              <option value="50 Months">50 Months</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Capacity (Members) *</label>
            <input
              type="number"
              required
              placeholder="20"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">First Auction Date *</label>
          <input
            type="date"
            required
            value={nextAuctionDate}
            onChange={(e) => setNextAuctionDate(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" size="sm" className="gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Create Group
          </Button>
        </div>
      </form>
    </Modal>
  );
}
