import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Gavel } from 'lucide-react';
import { memberService, chitService } from '../services/dbService';

export default function StartAuctionModal({ isOpen, onClose, onAuctionComplete, members: passedMembers, chits: passedChits }) {
  const [chits, setChits] = useState(passedChits || []);
  const [members, setMembers] = useState(passedMembers || []);
  const [selectedGroupId, setSelectedGroupId] = useState('RC-01');
  const [winnerName, setWinnerName] = useState('');
  const [bidAmount, setBidAmount] = useState('18000');
  const [auctionMonth, setAuctionMonth] = useState('3');
  const [error, setError] = useState('');

  React.useEffect(() => {
    async function loadOptions() {
      try {
        const [cList, mList] = await Promise.all([
          passedChits && passedChits.length > 0 ? Promise.resolve(passedChits) : chitService.getChits(),
          passedMembers && passedMembers.length > 0 ? Promise.resolve(passedMembers) : memberService.getMembers(),
        ]);
        setChits(cList || []);
        setMembers(mList || []);
        if (cList && cList.length > 0) setSelectedGroupId(cList[0].groupId || cList[0].id);
        if (mList && mList.length > 0) setWinnerName(mList[0].name);
      } catch (e) {}
    }
    loadOptions();
  }, [passedMembers, passedChits]);

  const chitGroup = chits.find(c => c.groupId === selectedGroupId || c.id === selectedGroupId) || chits[0];
  const parsedBid = parseFloat(bidAmount) || 0;
  const capacity = chitGroup?.capacity || 20;
  const dividendPerMember = capacity > 0 ? Math.floor(parsedBid / capacity) : 0;
  const netWinningPayout = (chitGroup?.totalChitValue || 100000) - parsedBid;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!winnerName.trim()) {
      setError('Please select or specify the winning member name.');
      return;
    }
    if (parsedBid <= 0) {
      setError('Please enter a valid discount bid amount.');
      return;
    }

    const result = {
      groupId: selectedGroupId,
      groupName: chitGroup?.name || selectedGroupId,
      month: parseInt(auctionMonth, 10),
      winner: winnerName.trim(),
      bidAmount: parsedBid,
      dividend: dividendPerMember,
      payout: netWinningPayout,
      date: new Date().toISOString().split('T')[0]
    };

    onAuctionComplete?.(result);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start Chit Fund Auction"
      subtitle="Conduct auction bidding and calculate dividend distribution."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Chit Group *</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
          >
            {chits.map((chit) => (
              <option key={chit.groupId || chit.id} value={chit.groupId || chit.id}>
                {chit.name} (Value: ₹{Number(chit.totalChitValue || 100000).toLocaleString('en-IN')})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Auction Month / Round *</label>
            <input
              type="number"
              required
              placeholder="3"
              value={auctionMonth}
              onChange={(e) => setAuctionMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Winner Member *</label>
            <select
              value={winnerName}
              onChange={(e) => setWinnerName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({m.phone})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bid Discount Amount (₹) *</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">₹</span>
            <input
              type="number"
              required
              placeholder="18000"
              value={bidAmount}
              onChange={(e) => {
                setBidAmount(e.target.value);
                setError('');
              }}
              className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans font-bold"
            />
          </div>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Total Chit Value:</span>
            <span className="font-bold text-slate-900">₹{(chitGroup?.totalChitValue || 100000).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Net Prize Amount to Winner:</span>
            <span className="font-bold text-emerald-700">₹{netWinningPayout.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-slate-600 pt-2 border-t border-sky-200 font-semibold">
            <span>Dividend Benefit per Member:</span>
            <span className="font-bold text-sky-800">₹{dividendPerMember.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" size="sm" className="gap-1.5">
            <Gavel className="w-3.5 h-3.5" />
            Complete Auction
          </Button>
        </div>
      </form>
    </Modal>
  );
}
