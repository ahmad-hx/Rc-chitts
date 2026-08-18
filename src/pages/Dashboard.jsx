import React, { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';

import StatCard from '../components/StatCard';
import Button from '../components/Button';
import Toast from '../components/Toast';
import RecordPaymentModal from '../components/RecordPaymentModal';
import CreateChitModal from '../components/CreateChitModal';
import StartAuctionModal from '../components/StartAuctionModal';
import { memberService, chitService } from '../services/dbService';

export default function Dashboard() {
  const navigate = useNavigate();

  // Data states
  const [members, setMembers] = React.useState([]);
  const [chits, setChits] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Modals state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isCreateChitOpen, setIsCreateChitOpen] = useState(false);
  const [isStartAuctionOpen, setIsStartAuctionOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  React.useEffect(() => {
    let mounted = true;
    async function loadDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const [fetchedMembers, fetchedChits] = await Promise.all([
          memberService.getMembers(),
          chitService.getChits(),
        ]);
        if (mounted) {
          setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
          setChits(Array.isArray(fetchedChits) ? fetchedChits : []);
        }
      } catch (e) {
        if (mounted) {
          setError('Unable to load data from Firebase.');
          setMembers([]);
          setChits([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDashboardData();
    return () => { mounted = false; };
  }, []);

  const totalMembersCount = members.length;
  const totalMembers = totalMembersCount;
  const dueMembersCount = members.filter((member) =>
    (member.chits || []).some((chit) => (chit.amountToPay || 0) > 0)
  ).length;

  const totalChitsCount = chits.reduce((acc, c) => acc + (c.capacity || 1), 0);
  const activeGroupsCount = chits.length;

  const stats = [
    {
      title: 'Total Active Chitts',
      value: String(totalChitsCount),
      icon: Layers,
      badgeText: loading ? 'Loading...' : `${totalChitsCount} active`,
      badgeColor: 'info',
      description: 'Across active groups',
      onClick: () => navigate('/chits'),
    },
    {
      title: 'Chitt Groups',
      value: String(activeGroupsCount),
      icon: CircleDollarSign,
      badgeText: loading ? 'Loading...' : `${activeGroupsCount} groups`,
      badgeColor: 'success',
      description: 'Stable portfolio',
      onClick: () => navigate('/chits'),
    },
    {
      title: 'Total Members',
      value: String(totalMembersCount),
      icon: Users,
      badgeText: loading ? 'Loading...' : `${totalMembersCount} enrolled`,
      badgeColor: 'info',
      description: 'Across all plans',
      onClick: () => navigate('/members'),
    },
    {
      title: 'Due Members',
      value: String(dueMembersCount),
      icon: IndianRupee,
      badgeText: 'Needs review',
      badgeColor: 'warning',
      description: 'Payment follow-ups',
      onClick: () => navigate('/members?filter=due'),
    },
  ];

  const handlePaymentRecorded = (txn) => {
    showToast(`Payment of ₹${txn.amount.toLocaleString('en-IN')} recorded for ${txn.member}!`);
  };

  const handleChitCreated = (group) => {
    showToast(`Chit Group ${group.groupId} (${group.name}) created successfully!`);
  };

  const handleAuctionCompleted = (result) => {
    showToast(`Auction completed for Group ${result.groupId}! Winner: ${result.winner} (Dividend: ₹${result.dividend.toLocaleString('en-IN')}/mem)`);
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <span className="text-[11px] font-normal text-amber-700">Check browser console for Firebase error diagnostic logs.</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200/60 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">Raghavendra Chitts Admin</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            Good day, Admin.
          </h1>
          <p className="text-xs text-slate-500 mt-1">Here is your daily chit fund business summary and operational shortcut panel.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            className="gap-2 text-xs font-bold rounded-2xl cursor-pointer"
            onClick={() => setIsCreateChitOpen(true)}
          >
            <Plus className="h-4 w-4 text-sky-600" />
            Create Chitt
          </Button>

          <Button
            variant="primary"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 px-5 py-3 text-xs font-bold text-white shadow-md shadow-sky-600/20 transition hover:-translate-y-0.5 cursor-pointer"
            onClick={() => setIsRecordPaymentOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* SUMMARY STAT CARDS */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            onClick={stat.onClick}
            className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-sky-300 active:scale-[0.99]"
          >
            <StatCard
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              badgeText={stat.badgeText}
              badgeColor={stat.badgeColor}
              className="border-none bg-transparent p-0 shadow-none"
            />
            <div className="mt-3 flex items-center justify-end text-[11px] font-bold text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>View section</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        ))}
      </section>

      {/* OPERATIONS & QUEUE SECTION */}
      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        {/* TODAY'S OPERATIONS */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Operations Overview</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Today’s Operations</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Healthy Status
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div
              onClick={() => navigate('/members')}
              className="group cursor-pointer rounded-2xl border border-sky-100 bg-sky-50/70 p-4.5 transition-all hover:bg-sky-100/80 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Members</p>
                <Users className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform" />
              </div>
              <p className="mt-3 text-2xl font-black text-slate-900">{totalMembers}</p>
              <p className="mt-1 text-xs font-medium text-slate-600 flex items-center gap-1">
                Active member roster <ArrowRight className="w-3 h-3 text-sky-600" />
              </p>
            </div>

            <div
              onClick={() => navigate('/members?filter=due')}
              className="group cursor-pointer rounded-2xl border border-amber-100 bg-amber-50/70 p-4.5 transition-all hover:bg-amber-100/80 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Pending</p>
                <IndianRupee className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
              </div>
              <p className="mt-3 text-2xl font-black text-slate-900">{dueMembersCount}</p>
              <p className="mt-1 text-xs font-medium text-slate-600 flex items-center gap-1">
                Payment follow-ups <ArrowRight className="w-3 h-3 text-amber-600" />
              </p>
            </div>

            <div
              onClick={() => navigate('/payments')}
              className="group cursor-pointer rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4.5 transition-all hover:bg-emerald-100/80 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Collections</p>
                <CircleDollarSign className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              </div>
              <p className="mt-3 text-2xl font-black text-slate-900">₹8.4L</p>
              <p className="mt-1 text-xs font-medium text-slate-600 flex items-center gap-1">
                This month ledger <ArrowRight className="w-3 h-3 text-emerald-600" />
              </p>
            </div>
          </div>
        </div>

        {/* WHATSAPP & SMS QUEUE */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Communication</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">WhatsApp / SMS Queue</h2>
              </div>
              <MessageSquare className="h-5 w-5 text-sky-600" />
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Messages in Queue</p>
                <span className="text-2xl font-black text-slate-900">{dueMembersCount}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <button
                  onClick={() => navigate('/whatsapp')}
                  className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Ready</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">84</p>
                </button>
                <button
                  onClick={() => navigate('/whatsapp')}
                  className="rounded-xl bg-amber-50 border border-amber-100 p-3 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Pending</p>
                  <p className="mt-1 text-lg font-black text-amber-700">12</p>
                </button>
                <button
                  onClick={() => navigate('/whatsapp')}
                  className="rounded-xl bg-red-50 border border-red-100 p-3 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Failed</p>
                  <p className="mt-1 text-lg font-black text-red-700">2</p>
                </button>
              </div>
            </div>
          </div>

          <Button
            variant="gold"
            className="mt-4 w-full justify-center gap-2 rounded-2xl py-3 text-xs font-bold cursor-pointer"
            onClick={() => navigate('/whatsapp')}
          >
            <Send className="h-4 w-4" />
            Review Messages Center
          </Button>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Quick Actions</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 font-sans">Common Tasks</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => navigate('/members?action=add')}
            className="group flex min-h-[58px] items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 cursor-pointer shadow-xs"
          >
            <UserPlus className="h-4 w-4 text-sky-600 transition-transform group-hover:scale-110" />
            <span>+ Add Member</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateChitOpen(true)}
            className="group flex min-h-[58px] items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 cursor-pointer shadow-xs"
          >
            <Layers className="h-4 w-4 text-sky-600 transition-transform group-hover:scale-110" />
            <span>+ Create Chitt</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRecordPaymentOpen(true)}
            className="group flex min-h-[58px] items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 cursor-pointer shadow-xs"
          >
            <IndianRupee className="h-4 w-4 text-sky-600 transition-transform group-hover:scale-110" />
            <span>+ Record Payment</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStartAuctionOpen(true)}
            className="group flex min-h-[58px] items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 cursor-pointer shadow-xs"
          >
            <Gavel className="h-4 w-4 text-amber-600 transition-transform group-hover:scale-110" />
            <span>+ Start Auction</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/whatsapp')}
            className="group flex min-h-[58px] items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer shadow-xs"
          >
            <Send className="h-4 w-4 text-emerald-600 transition-transform group-hover:scale-110" />
            <span>+ Send WhatsApp</span>
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
    </div>
  );
}