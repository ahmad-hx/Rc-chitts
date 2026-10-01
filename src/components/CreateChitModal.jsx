import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Layers, Calendar } from 'lucide-react';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getChitMonth, parseMonthYear, FORMATTED_MONTH_NAMES, toYearMonthString } from '../utils/chitMonthUtils';

export default function CreateChitModal({ isOpen, onClose, onCreate }) {
  const { selectedMonth } = useBillingMonth();
  const [groupId, setGroupId] = useState('');
  const [name, setName] = useState('');
  const [totalChitValue, setTotalChitValue] = useState('100000');
  const [startingMonthName, setStartingMonthName] = useState('March');
  const [startingYear, setStartingYear] = useState('2026');
  const duration = '20 Months';
  const [monthlyPremium, setMonthlyPremium] = useState('5000');
  const [capacity, setCapacity] = useState('20');
  const [nextAuctionDate, setNextAuctionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedMonth) {
      const parsed = parseMonthYear(selectedMonth);
      if (parsed) {
        setStartingMonthName(FORMATTED_MONTH_NAMES[parsed.month] || 'March');
        setStartingYear(String(parsed.year || 2026));
      }
    }
  }, [selectedMonth, isOpen]);

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
    const cleanYear = parseInt(startingYear, 10);

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
    if (isNaN(cleanYear) || cleanYear < 2000 || cleanYear > 2100) {
      setError('Please enter a valid 4-digit starting year (e.g. 2026).');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const isoStartingMonth = toYearMonthString(startingMonthName, cleanYear);

    const newChitGroup = {
      id: cleanGroupId,
      groupId: cleanGroupId,
      name: name.trim() || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${cleanGroupId})`,
      totalChitValue: val,
      monthlyPremium: prem,
      duration,
      capacity: cap,
      startingMonth: isoStartingMonth,
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

  const combinedDateStr = `${startingMonthName} ${startingYear}`;
  const calculatedChitMonth = getChitMonth(combinedDateStr, selectedMonth);

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
          <div className="p-3 bg-[#FEF3F2] border border-[#FECACA] text-[#B42318] text-xs rounded-xl font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
              Group ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. I, II, XVIII"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52] font-mono font-bold uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
              Chit Group Name
            </label>
            <input
              type="text"
              placeholder="Auto-generated if blank"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            />
          </div>
        </div>

        {/* STARTING MONTH & YEAR INPUTS WITH LIVE PREVIEW */}
        <div className="p-3.5 bg-[#EEF6F3] border border-[#BFD8D0] rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-extrabold text-[#285F52] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Starting Month & Year (Chit Month 1) *
            </label>
            <span className="text-[10px] font-bold text-[#285F52] bg-white px-2 py-0.5 rounded-md border border-[#BFD8D0]">
              Month 1 / 20
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                Starting Month
              </label>
              <select
                value={startingMonthName}
                onChange={(e) => setStartingMonthName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52] cursor-pointer"
              >
                {FORMATTED_MONTH_NAMES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                Starting Year
              </label>
              <input
                type="number"
                required
                min="2020"
                max="2040"
                value={startingYear}
                onChange={(e) => setStartingYear(e.target.value)}
                placeholder="2026"
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#BFD8D0] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#667085] font-semibold">Selected Starting Date:</span>
              <span className="font-bold text-[#111111]">{startingMonthName} {startingYear}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#667085] font-semibold">Active Billing Month:</span>
              <span className="font-bold text-[#111111]">{selectedMonth}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#BFD8D0]/60">
              <span className="text-[#285F52] font-extrabold uppercase tracking-wider">Chit Month Preview:</span>
              <span className="font-black text-[#285F52] bg-white px-2.5 py-0.5 rounded-lg border border-[#BFD8D0] text-sm">
                {calculatedChitMonth.display}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-[#285F52] font-medium leading-relaxed">
            ℹ The selected starting month is Chit Month 1. The chit month will automatically increase every month up to 20/20 based on the active billing month.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
              Total Chit Value (₹) *
            </label>
            <select
              value={totalChitValue}
              onChange={(e) => handleTotalChitValueChange(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52] cursor-pointer"
            >
              <option value="100000">₹1,00,000 (1 Lakh)</option>
              <option value="200000">₹2,00,000 (2 Lakh)</option>
              <option value="500000">₹5,00,000 (5 Lakh)</option>
              <option value="1000000">₹10,00,000 (10 Lakh)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
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
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
              Duration *
            </label>
            <input
              type="text"
              readOnly
              value={duration}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#667085] cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
              Capacity (Members) *
            </label>
            <input
              type="number"
              required
              min="1"
              max="50"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
            First Auction Date
          </label>
          <input
            type="date"
            required
            value={nextAuctionDate}
            onChange={(e) => setNextAuctionDate(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="gap-1.5 bg-[#285F52] hover:bg-[#214D43] text-white font-bold"
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

