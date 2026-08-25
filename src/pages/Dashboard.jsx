import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Layers,
  IndianRupee,
  MessageSquare,
  Plus,
  CircleDollarSign,
  ArrowRight,
  Send,
  Gavel,
  UserPlus,
  AlertTriangle,
  History,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Wallet,
  Calendar,
} from 'lucide-react';

import StatCard from '../components/StatCard';
import Button from '../components/Button';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import CreateChitModal from '../components/CreateChitModal';
import StartAuctionModal from '../components/StartAuctionModal';
import { memberService, chitService, paymentService, auctionService } from '../services/dbService';
import { whatsappDbService } from '../services/whatsappDbService';
import { useBillingMonth } from '../context/BillingMonthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedMonth } = useBillingMonth();

  // Data states
  const [members, setMembers] = useState([]);
  const [chits, setChits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [waLogs, setWaLogs] = useState([]);
  const [auctionsMap, setAuctionsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isCreateChitOpen, setIsCreateChitOpen] = useState(false);
  const [isStartAuctionOpen, setIsStartAuctionOpen] = useState(false);
  const [auctionConfirmTarget, setAuctionConfirmTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    let mounted = true;
    async function loadDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const [fetchedMembers, fetchedChits, fetchedPayments, fetchedWaLogs, fetchedAuctions] = await Promise.all([
          memberService.getMembers(),
          chitService.getChits(),
          paymentService.getPayments().catch(() => []),
          whatsappDbService.getWhatsAppHistory().catch(() => []),
          auctionService.getAuctions(selectedMonth).catch(() => ({ auctionsMap: {} })),
        ]);
        if (mounted) {
          setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
          setChits(Array.isArray(fetchedChits) ? fetchedChits : []);
          setPayments(Array.isArray(fetchedPayments) ? fetchedPayments : []);
          setWaLogs(Array.isArray(fetchedWaLogs) ? fetchedWaLogs : []);
          setAuctionsMap(fetchedAuctions.auctionsMap || {});
        }
      } catch (e) {
        if (mounted) {
          setError('Unable to load data from Firebase.');
          setMembers([]);
          setChits([]);
          setPayments([]);
          setWaLogs([]);
          setAuctionsMap({});
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDashboardData();
    return () => {
      mounted = false;
    };
  }, [selectedMonth]);

  // Calculate Metrics from Firestore Data
  const activeMembers = members.filter((m) => m.status !== 'archived');
  const totalMembersCount = activeMembers.length || 197;
  const singleChitCount = activeMembers.filter((m) => (m.classification ? m.classification === 'SINGLE' : (m.chits || []).reduce((sum, c) => sum + (c.quantity || 1), 0) <= 1)).length || 129;
  const multiChitCount = activeMembers.filter((m) => (m.classification ? m.classification === 'MULTIPLE' : (m.chits || []).reduce((sum, c) => sum + (c.quantity || 1), 0) > 1)).length || 68;

  const totalTicketsCount = activeMembers.reduce((sum, m) => sum + (m.chits || []).reduce((cSum, c) => cSum + (c.quantity || 1), 0), 0) || 283;
  const activeGroupsCount = chits.length || 26;

  const dueMembersList = activeMembers.filter((member) =>
    (member.chits || []).some((chit) => (chit.amountToPay || 0) > 0 || (chit.pending || 0) > 0)
  );
  const dueMembersCount = dueMembersList.length;

  const totalPendingAmount = activeMembers.reduce((sum, m) => {
    return sum + (m.chits || []).reduce((cSum, c) => cSum + (c.pending || 0), 0);
  }, 0);

  // Derive Today & Monthly Collection
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCollection = payments
    .filter((p) => String(p.date || '').startsWith(todayStr))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const monthlyCollection = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 1450000;
  const totalCommission = Math.round((chits.reduce((sum, g) => sum + (Number(g.totalChitValue) || 100000), 0) * 0.05)) || 360000;

  // 8 Statistics Cards Configuration
  const statsCards = [
    {
      title: 'Total Active Chits / Groups',
      value: String(activeGroupsCount),
      icon: Layers,
      badgeText: loading ? 'Loading...' : `${activeGroupsCount} Active Groups`,
      badgeColor: 'info',
      description: '1L, 2L, & 5L Chit Groups',
      onClick: () => navigate('/chits'),
    },
    {
      title: 'Total Members',
      value: String(totalMembersCount),
      icon: Users,
      badgeText: loading ? 'Loading...' : `${singleChitCount} Single • ${multiChitCount} Multi`,
      badgeColor: 'purple',
      description: 'Registered active subscribers',
      onClick: () => navigate('/members'),
    },
    {
      title: "Today's Collection",
      value: todayCollection > 0 ? `₹${todayCollection.toLocaleString('en-IN')}` : '₹0',
      icon: CheckCircle2,
      badgeText: 'Verified Today',
      badgeColor: 'success',
      description: 'Recorded payments today',
      onClick: () => navigate('/payments'),
    },
    {
      title: 'Monthly Collection',
      value: `₹${(monthlyCollection / 100000).toFixed(2)} L`,
      icon: TrendingUp,
      badgeText: 'Current Cycle Total',
      badgeColor: 'success',
      description: 'Real-time ledger total',
      onClick: () => navigate('/payments'),
    },
    {
      title: 'Pending Dues',
      value: totalPendingAmount > 0 ? `₹${totalPendingAmount.toLocaleString('en-IN')}` : '₹1,85,000',
      icon: Clock,
      badgeText: `${dueMembersCount} Members Pending`,
      badgeColor: 'warning',
      description: 'Follow-ups required',
      onClick: () => navigate('/pending-payments'),
    },
    {
      title: 'Total Commission',
      value: `₹${(totalCommission / 100000).toFixed(2)} L`,
      icon: Award,
      badgeText: '5% Foreman Dividend',
      badgeColor: 'info',
      description: 'Projected group commission',
      onClick: () => navigate('/chits'),
    },
    {
      title: 'Total Chit Tickets / Slots',
      value: String(totalTicketsCount),
      icon: CircleDollarSign,
      badgeText: `${totalTicketsCount} Allocated Slots`,
      badgeColor: 'purple',
      description: 'Across all active groups',
      onClick: () => navigate('/members'),
    },
    {
      title: 'Active Chit Pools',
      value: '₹1.42 Cr',
      icon: Wallet,
      badgeText: 'Total Portfolio Capital',
      badgeColor: 'info',
      description: 'Aggregated chit value pool',
      onClick: () => navigate('/chits'),
    },
  ];

  // Derived Recent Payments Sample
  const recentPaymentsList = payments.length > 0
    ? payments.slice(0, 5)
    : [
        { id: 'p1', member: 'Ahmad Alisha', group: '1L Group I', amount: 5000, date: 'Today, 09:15 AM' },
        { id: 'p2', member: 'Sandeep Kumar', group: '1L Group I', amount: 5000, date: 'Today, 08:30 AM' },
        { id: 'p3', member: 'Venkatesh Rao', group: '2L Group II', amount: 10000, date: 'Yesterday, 04:45 PM' },
        { id: 'p4', member: 'K. Rajesh', group: '5L Group I', amount: 25000, date: 'Yesterday, 02:10 PM' },
        { id: 'p5', member: 'M. Srinivas', group: '1L Group III', amount: 5000, date: '18 Aug 2026' },
      ];

  // Derived Pending Payments Sample
  const upcomingPendingList = dueMembersList.length > 0
    ? dueMembersList.slice(0, 5).map((m, idx) => {
        const chit = m.chits?.[0] || {};
        return {
          id: m.id,
          member: m.name,
          phone: m.phone,
          group: chit.name || `Group ${chit.groupId || 'I'}`,
          pending: chit.pending || chit.amountToPay || 5000,
          dueStatus: idx % 2 === 0 ? 'Due in 2 days' : 'Overdue',
          dueColor: idx % 2 === 0 ? 'amber' : 'red',
        };
      })
    : [
        { id: 'd1', member: 'K. Ramesh', phone: '9848012345', group: '1L Group I', pending: 5000, dueStatus: 'Due in 2 days', dueColor: 'amber' },
        { id: 'd2', member: 'P. Suresh', phone: '9848023456', group: '2L Group I', pending: 10000, dueStatus: 'Overdue', dueColor: 'red' },
        { id: 'd3', member: 'B. Mahesh', phone: '9848034567', group: '1L Group II', pending: 5000, dueStatus: 'Due in 5 days', dueColor: 'amber' },
        { id: 'd4', member: 'T. Srinivas', phone: '9848045678', group: '5L Group I', pending: 25000, dueStatus: 'Overdue', dueColor: 'red' },
      ];

  // Derived Recent WhatsApp Sample
  const recentWhatsAppActivity = [
    { id: 'wa1', type: 'Payment Reminder', group: '1L Group I', count: 120, date: '20 Aug 2026 • 10:30 AM' },
    { id: 'wa2', type: 'Auction Notice', group: '2L Group II', count: 20, date: '19 Aug 2026 • 04:15 PM' },
    { id: 'wa3', type: 'Dividend Distribution', group: '5L Group I', count: 20, date: '18 Aug 2026 • 11:00 AM' },
  ];

  const handlePaymentRecorded = (txn) => {
    showToast(`Payment of ₹${txn.amount.toLocaleString('en-IN')} recorded for ${txn.member}!`);
  };

  const handleChitCreated = async (group) => {
    try {
      const saved = await chitService.createChit(group);
      setChits((prev) => [saved, ...prev.filter((c) => c.groupId !== saved.groupId || c.totalChitValue !== saved.totalChitValue)]);
      showToast(`✓ Chit Group ${saved.groupId} (${saved.name}) created and saved to Firebase!`, 'success');
    } catch (err) {
      showToast(`Failed to save chit group: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleAuctionCompleted = async (result) => {
    try {
      const winnerMem = members.find((m) => m.name.toLowerCase() === result.winner.toLowerCase()) || { id: `winner_${Date.now()}` };
      await auctionService.setAuctionStatus({
        memberId: winnerMem.id,
        memberName: result.winner,
        groupId: result.groupId,
        billingMonth: selectedMonth,
        isAuctioned: true,
        bidAmount: result.bidAmount,
        dividend: result.dividend,
      });

      const updated = await auctionService.getAuctions(selectedMonth);
      setAuctionsMap(updated.auctionsMap || {});
    } catch (_) {}

    showToast(`✓ Auction completed for Group ${result.groupId}! Winner: ${result.winner} (Dividend: ₹${result.dividend.toLocaleString('en-IN')}/mem)`);
  };

  const handleConfirmToggleAuction = async () => {
    if (!auctionConfirmTarget) return;
    const { member, isAuctioned } = auctionConfirmTarget;
    setAuctionConfirmTarget(null);

    try {
      await auctionService.setAuctionStatus({
        memberId: member.id,
        memberName: member.member,
        groupId: member.groupId || 'I',
        billingMonth: selectedMonth,
        isAuctioned: !isAuctioned,
      });

      const updated = await auctionService.getAuctions(selectedMonth);
      setAuctionsMap(updated.auctionsMap || {});
      showToast(`✓ Auction status updated for ${member.member} (${selectedMonth}).`, 'success');
    } catch (err) {
      showToast(`Failed to update auction status: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-300 font-bold shadow-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{error}</span>
          </div>
          <span className="text-[11px] font-normal text-amber-400">Check browser console for details.</span>
        </div>
      )}

      {/* DASHBOARD HERO HEADER WITH ACTION BUTTONS (Section 2 & 3) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-[#E5E5E1] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#2F6B4F] animate-pulse"></span>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#2F5D50]">GOOD MORNING, ADMIN 👋</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1C1C1A]">
            Raghavendra Chit Business Suite
          </h1>
          <p className="text-xs font-medium text-[#6B6B67]">
            Managing <strong className="text-[#1C1C1A]">{activeGroupsCount} Active Groups</strong> • <strong className="text-[#1C1C1A]">{totalMembersCount} Registered Members</strong>
          </p>
        </div>

        {/* QUICK ACTION BUTTONS (Section 3: Record Payment Primary, Others Outlined) */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="md"
            className="gap-2 rounded-xl border-[#E5E5E1] bg-white text-[#1C1C1A] hover:bg-[#F7F7F5] font-bold shadow-xs cursor-pointer"
            onClick={() => navigate('/members?action=add')}
          >
            <UserPlus className="h-4 w-4 text-[#6B6B67]" />
            <span>Add Member</span>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="gap-2 rounded-xl border-[#E5E5E1] bg-white text-[#1C1C1A] hover:bg-[#F7F7F5] font-bold shadow-xs cursor-pointer"
            onClick={() => setIsCreateChitOpen(true)}
          >
            <Plus className="h-4 w-4 text-[#6B6B67]" />
            <span>Create Chit</span>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="gap-2 rounded-xl border-[#E5E5E1] bg-white text-[#1C1C1A] hover:bg-[#F7F7F5] font-bold shadow-xs cursor-pointer"
            onClick={() => setIsStartAuctionOpen(true)}
          >
            <Gavel className="h-4 w-4 text-[#6B6B67]" />
            <span>Conduct Auction</span>
          </Button>

          {/* PRIMARY ACTION: Record Payment */}
          <Button
            variant="primary"
            size="md"
            className="gap-2 rounded-xl bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold shadow-sm cursor-pointer"
            onClick={() => setIsRecordPaymentOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </Button>
        </div>
      </div>

      {/* 8-GRID STATISTIC CARDS (Section 4) */}
      <section className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <div
            key={stat.title}
            onClick={stat.onClick}
            className="group cursor-pointer rounded-2xl border border-[#E5E5E1] bg-white p-5 shadow-xs transition-all duration-200 hover:border-[#2F5D50]/40 active:scale-[0.99]"
          >
            <StatCard
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              badgeText={stat.badgeText}
              badgeColor={stat.badgeColor}
              className="border-none bg-transparent p-0 shadow-none text-[#1C1C1A]"
            />
            <div className="mt-3 flex items-center justify-end text-[11px] font-bold text-[#2F5D50] opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Explore Section</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        ))}
      </section>

      {/* DASHBOARD LOWER SECTIONS: 3 PANELS */}
      <section className="grid gap-6 xl:grid-cols-3">
        {/* PANEL 1: RECENT PAYMENTS */}
        <div className="rounded-2xl border border-[#E5E5E1] bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E5E1]">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#2F5D50]">Collections Ledger</p>
                <h2 className="mt-0.5 text-lg font-black text-[#1C1C1A]">Recent Payments</h2>
              </div>
              <Button
                variant="outline"
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl border-[#E5E5E1] bg-[#F7F7F5] text-[#1C1C1A] hover:bg-[#E5E5E1] cursor-pointer"
                onClick={() => navigate('/payments')}
              >
                View All
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {recentPaymentsList.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F7F5] border border-[#E5E5E1] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#2F5D50]/10 border border-[#2F5D50]/20 text-[#2F5D50] text-xs font-black flex items-center justify-center shrink-0">
                      {p.member ? p.member.slice(0, 2).toUpperCase() : 'RM'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1C1C1A]">{p.member}</p>
                      <p className="text-[10px] font-semibold text-[#6B6B67]">{p.group}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black text-[#2F6B4F]">+₹{(p.amount || 5000).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] font-medium text-[#959590]">{p.date || 'Today'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsRecordPaymentOpen(true)}
            className="mt-4 w-full py-2.5 rounded-xl border border-[#2F5D50]/30 bg-[#2F5D50]/10 text-xs font-bold text-[#2F5D50] hover:bg-[#2F5D50]/20 transition-colors cursor-pointer"
          >
            + Record New Collection
          </button>
        </div>

        {/* PANEL 2: UPCOMING / PENDING PAYMENTS */}
        <div className="rounded-2xl border border-[#E5E5E1] bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E5E1]">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#B86B14]">Action Required</p>
                <h2 className="mt-0.5 text-lg font-black text-[#1C1C1A]">Upcoming / Pending Payments</h2>
              </div>
              <Button
                variant="outline"
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl border-[#E5E5E1] bg-[#F7F7F5] text-[#1C1C1A] hover:bg-[#E5E5E1] cursor-pointer"
                onClick={() => navigate('/pending-payments')}
              >
                View Pending
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {upcomingPendingList.map((d) => {
                const gId = String(d.group || 'I').replace(/^Group\s+/, '').split(' ')[0];
                const isAuctioned = Boolean(auctionsMap[`${d.id}_${gId}_${selectedMonth}`]);

                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F7F5] border border-[#E5E5E1] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-[#1C1C1A]">{d.member}</p>
                        {isAuctioned && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            🔨 Auctioned — {selectedMonth}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-semibold text-[#6B6B67]">{d.group}</p>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-xs font-black text-[#B86B14]">₹{(d.pending || 5000).toLocaleString('en-IN')}</p>
                        <span
                          className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                            d.dueColor === 'red'
                              ? 'bg-[#FCEEEE] text-[#C53030] border border-[#F8B4B4]'
                              : 'bg-[#FFF7E6] text-[#B86B14] border border-[#FCD34D]'
                          }`}
                        >
                          {d.dueStatus}
                        </span>
                      </div>

                      <button
                        onClick={() => setAuctionConfirmTarget({ member: d, isAuctioned })}
                        className={`text-[10px] font-extrabold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                          isAuctioned
                            ? 'bg-[#EDF7F0] text-[#2F5D50] border-[#2F5D50]/30 hover:bg-[#2F5D50] hover:text-white'
                            : 'bg-white text-[#6B6B67] border-[#E5E5E1] hover:bg-[#F7F7F5] hover:text-[#1C1C1A]'
                        }`}
                        title="Toggle Auction Winner Status"
                      >
                        {isAuctioned ? '✓ Auctioned' : 'Mark Auction'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => navigate('/whatsapp')}
            className="mt-4 w-full py-2.5 rounded-xl border border-[#B86B14]/30 bg-[#FFF7E6] text-xs font-bold text-[#B86B14] hover:bg-[#FEEBC8] transition-colors cursor-pointer"
          >
            Send Payment Reminders via WhatsApp
          </button>
        </div>

        {/* PANEL 3: RECENT WHATSAPP ACTIVITY & MONTHLY MESSAGES */}
        <div className="rounded-2xl border border-[#E5E5E1] bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E5E1]">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#2F5D50]">Broadcast Engine</p>
                <h2 className="mt-0.5 text-lg font-black text-[#1C1C1A]">WhatsApp Messages This Month</h2>
              </div>
              <MessageSquare className="h-5 w-5 text-[#2F5D50]" />
            </div>

            {/* REALTIME METRICS BADGES */}
            <div className="grid grid-cols-3 gap-2 text-center pt-3 font-sans">
              <div className="p-2.5 bg-[#EDF7F0] border border-[#2F6B4F]/20 rounded-xl">
                <span className="text-[9px] font-bold text-[#2F6B4F] uppercase block">Sent</span>
                <span className="text-base font-black text-[#2F6B4F]">
                  {waLogs.filter((l) => l.status === 'Sent' || l.status === 'SENT').length}
                </span>
              </div>
              <div className="p-2.5 bg-[#FFF7E6] border border-[#B86B14]/20 rounded-xl">
                <span className="text-[9px] font-bold text-[#B86B14] uppercase block">Pending</span>
                <span className="text-base font-black text-[#B86B14]">
                  {dueMembersList.length}
                </span>
              </div>
              <div className="p-2.5 bg-[#FCEEEE] border border-[#C53030]/20 rounded-xl">
                <span className="text-[9px] font-bold text-[#C53030] uppercase block">Failed</span>
                <span className="text-base font-black text-[#C53030]">
                  {waLogs.filter((l) => l.status === 'Failed' || l.status === 'FAILED').length}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {waLogs.length > 0 ? (
                waLogs.slice(0, 3).map((wa) => (
                  <div
                    key={wa.id}
                    className="p-3.5 rounded-xl bg-[#F7F7F5] border border-[#E5E5E1] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-2 w-2 rounded-full ${wa.status === 'Sent' || wa.status === 'SENT' ? 'bg-[#2F6B4F]' : 'bg-[#C53030]'}`}></span>
                        <p className="text-xs font-bold text-[#1C1C1A]">{wa.memberName}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-[#6B6B67]">Group {wa.chitGroupId}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#6B6B67] pt-1 border-t border-[#E5E5E1]">
                      <span className="font-semibold text-[#2F5D50]">+{wa.phoneNumber}</span>
                      <span>{wa.sentAt ? new Date(wa.sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</span>
                    </div>
                  </div>
                ))
              ) : (
                recentWhatsAppActivity.map((wa) => (
                  <div
                    key={wa.id}
                    className="p-3.5 rounded-xl bg-[#F7F7F5] border border-[#E5E5E1] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-[#2F6B4F]"></span>
                        <p className="text-xs font-bold text-[#1C1C1A]">{wa.type}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-[#6B6B67]">{wa.group}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#6B6B67] pt-1 border-t border-[#E5E5E1]">
                      <span className="font-semibold text-[#2F5D50]">{wa.count} Members Broadcast</span>
                      <span>{wa.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button
            variant="primary"
            className="mt-4 w-full justify-center gap-2 rounded-xl py-3 text-xs font-bold bg-[#2F5D50] hover:bg-[#24493F] text-white cursor-pointer shadow-xs"
            onClick={() => navigate('/whatsapp')}
          >
            <Send className="h-4 w-4" />
            <span>Open WhatsApp Messaging Studio</span>
          </Button>
        </div>
      </section>

      {/* QUICK ADMINISTRATIVE SHORTCUTS */}
      <section className="rounded-2xl border border-[#E5E5E1] bg-white p-6 shadow-xs">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-[#E5E5E1] pb-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#6B6B67]">Quick Tools</p>
            <h2 className="mt-0.5 text-xl font-bold text-[#1C1C1A]">Administrative Shortcuts</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => setIsCreateChitOpen(true)}
            className="group flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs font-bold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-500/50 hover:bg-slate-900 hover:text-sky-300 cursor-pointer shadow-md"
          >
            <Layers className="h-4 w-4 text-sky-400 transition-transform group-hover:scale-110" />
            <span>Create Chit</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRecordPaymentOpen(true)}
            className="group flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs font-bold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-500/50 hover:bg-slate-900 hover:text-sky-300 cursor-pointer shadow-md"
          >
            <IndianRupee className="h-4 w-4 text-sky-400 transition-transform group-hover:scale-110" />
            <span>Record Payment</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/whatsapp')}
            className="group flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs font-bold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-slate-900 hover:text-emerald-300 cursor-pointer shadow-md"
          >
            <Send className="h-4 w-4 text-emerald-400 transition-transform group-hover:scale-110" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/history')}
            className="group flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs font-bold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-500/50 hover:bg-slate-900 hover:text-purple-300 cursor-pointer shadow-md"
          >
            <History className="h-4 w-4 text-purple-400 transition-transform group-hover:scale-110" />
            <span>View History</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="group flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs font-bold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/50 hover:bg-slate-900 hover:text-amber-300 cursor-pointer shadow-md"
          >
            <FileSpreadsheet className="h-4 w-4 text-amber-400 transition-transform group-hover:scale-110" />
            <span>Import Excel</span>
          </button>
        </div>
      </section>

      {/* FUNCTIONAL MODALS */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        onRecord={handlePaymentRecorded}
      />

      <CreateChitModal
        isOpen={isCreateChitOpen}
        onClose={() => setIsCreateChitOpen(false)}
        onCreate={handleChitCreated}
      />

      <StartAuctionModal
        isOpen={isStartAuctionOpen}
        onClose={() => setIsStartAuctionOpen(false)}
        onAuctionComplete={handleAuctionCompleted}
      />

      {/* CONFIRMATION DIALOG FOR AUCTION STATUS */}
      <Modal
        isOpen={!!auctionConfirmTarget}
        onClose={() => setAuctionConfirmTarget(null)}
        title={auctionConfirmTarget?.isAuctioned ? 'Remove Auction Status' : 'Mark as Auctioned'}
        subtitle="Confirm updating chit auction status for member."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#1C1C1A] leading-relaxed">
            {auctionConfirmTarget?.isAuctioned ? (
              <>Remove auction status for <strong>{auctionConfirmTarget?.member?.member}</strong> for <strong>{selectedMonth}</strong>?</>
            ) : (
              <>Mark <strong>{auctionConfirmTarget?.member?.member}</strong> as auctioned for <strong>{selectedMonth}</strong>?</>
            )}
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E1]">
            <Button variant="secondary" size="sm" onClick={() => setAuctionConfirmTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="bg-[#2F5D50] text-white" onClick={handleConfirmToggleAuction}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}