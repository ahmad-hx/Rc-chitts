import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Layers, Loader2, Calendar } from 'lucide-react';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getStandardMonthOptions } from '../utils/chitMonthUtils';

export default function CreateChitModal({ isOpen, onClose, onCreate }) {
  const { selectedMonth } = useBillingMonth();
  const [groupId, setGroupId] = useState('');
  const [name, setName] = useState('');
  const [totalChitValue, setTotalChitValue] = useState('100000');
  const [startingMonth, setStartingMonth] = useState(selectedMonth || 'March 2026');
  const duration = '20 Months';
  const [monthlyPremium, setMonthlyPremium] = useState('5000');
  const [capacity, setCapacity] = useState('20');
  const [nextAuctionDate, setNextAuctionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedMonth) {
      setStartingMonth(selectedMonth);
    }
  }, [selectedMonth, isOpen]);

  const monthOptions = getStandardMonthOptions();

  const handleTotalChitValueChange = (valStr) => {
    setTotalChitValue(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num > 0) {
      setMonthlyPremium(String(Math.floor(num / 20)));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(totalChitValue);
    const prem = parseFloat(monthlyPremium);
    const cap = parseInt(capacity, 10);
    const cleanGroupId = groupId.trim().toUpperCase();

    if (!cleanGroupId) {
      setError('Please provide a Chit Group ID (e.g. I, II, RC-01).');
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

    setIsSubmitting(true);
    setError('');

    const newChitGroup = {
      id: cleanGroupId,
      groupId: cleanGroupId,
      name: name.trim() || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${cleanGroupId})`,
      totalChitValue: val,
      monthlyPremium: prem,
      duration,
      capacity: cap,
      startingMonth: startingMonth || selectedMonth || 'March 2026',
      currentMembers: 0,
      nextAuctionDate,
      status: 'ACTIVE',
      auctionHistory: [],
    };

    try {
      if (onCreate) {
        await onCreate(newChitGroup);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create chit group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Chit Group"
      subtitle="Establish a new chit group scheme with starting month and terms."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
              Group ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. I, II, XVIII"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50] font-mono font-bold uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
              Chit Group Name
            </label>
            <input
              type="text"
              placeholder="Auto-generated if blank"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
          </div>
        </div>

        {/* STARTING MONTH SELECTOR WITH EXPLANATION */}
        <div className="p-3 bg-[#EDF7F0] border border-[#2F5D50]/20 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-extrabold text-[#2F5D50] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Starting Month (Chit Month 1) *
            </label>
            <span className="text-[10px] font-bold text-[#2F5D50] bg-white px-2 py-0.5 rounded-md border border-[#2F5D50]/20">
              Chit Month 1
            </span>
          </div>

          <select
            value={startingMonth}
            onChange={(e) => setStartingMonth(e.target.value)}
            className="w-full px-3 py-2 text-xs font-bold bg-white border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
          >
            {monthOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-[#2F5D50] font-medium leading-relaxed">
            ℹ The selected starting month is Chit Month 1. The chit month will automatically increase every month up to 20/20 based on the active billing month.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
              Total Chit Value (₹) *
            </label>
            <select
              value={totalChitValue}
              onChange={(e) => handleTotalChitValueChange(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
            >
              <option value="100000">₹1,00,000 (1 Lakh)</option>
              <option value="200000">₹2,00,000 (2 Lakh)</option>
              <option value="500000">₹5,00,000 (5 Lakh)</option>
              <option value="1000000">₹10,00,000 (10 Lakh)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
              Monthly Premium (₹) *
            </label>
            <input
              type="number"
              required
              min="1"
              step="1"
              placeholder="5000"
              value={monthlyPremium}
              onChange={(e) => setMonthlyPremium(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
              Duration *
            </label>
            <input
              type="text"
              readOnly
              value={duration}
              className="w-full px-3 py-2 text-xs font-bold bg-[#EFEFEA] border border-[#E5E5E1] rounded-xl text-[#6B6B67] cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
              Capacity (Members) *
            </label>
            <input
              type="number"
              required
              min="1"
              max="50"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
            First Auction Date
          </label>
          <input
            type="date"
            required
            value={nextAuctionDate}
            onChange={(e) => setNextAuctionDate(e.target.value)}
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
            <Layers className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Creating...' : 'Create Group'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

