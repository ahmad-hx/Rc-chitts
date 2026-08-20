import React, { useState, useEffect } from 'react';
import {
  History as HistoryIcon,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  Layers,
  Users,
  IndianRupee,
  FileText,
  Clock,
  ShieldCheck,
  Archive,
  ChevronRight,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Toast from '../components/Toast';
import { historyService } from '../services/historyService';
import { memberService, paymentService } from '../services/dbService';

export default function History() {
  const [historyEvents, setHistoryEvents] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [archivedMembers, setArchivedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Hierarchical Filter States
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedChitValue, setSelectedChitValue] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    let mounted = true;
    async function loadHistoryData() {
      setLoading(true);
      try {
        const [events, payments, members] = await Promise.all([
          historyService.getHistoryEvents({
            year: selectedYear,
            month: selectedMonth,
            category: selectedCategory,
            chitValue: selectedChitValue,
            groupId: selectedGroupId,
            searchQuery,
          }),
          paymentService.getPayments().catch(() => []),
          memberService.getMembers().catch(() => []),
        ]);

        if (mounted) {
          setHistoryEvents(Array.isArray(events) ? events : []);
          setPaymentsList(Array.isArray(payments) ? payments : []);
          setArchivedMembers(Array.isArray(members) ? members.filter((m) => m.status === 'archived') : []);
        }
      } catch (e) {
        console.error('History load error:', e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadHistoryData();
    return () => {
      mounted = false;
    };
  }, [selectedYear, selectedMonth, selectedCategory, selectedChitValue, selectedGroupId, searchQuery]);

  const handleResetFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
    setSelectedChitValue('all');
    setSelectedCategory('all');
    setSelectedGroupId('all');
    setSearchQuery('');
    showToast('History filters reset to default.');
  };

  const getActionBadgeVariant = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('DELETED') || act.includes('ARCHIVED')) return 'danger';
    if (act.includes('CREATED') || act.includes('ADDED') || act.includes('CLEARED')) return 'success';
    if (act.includes('UPDATED') || act.includes('ADJUSTMENT')) return 'warning';
    return 'info';
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-pulse"></span>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-400">Historical Audit & Archive</p>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Audit & Archive History</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Immutably preserved historical records, group archives, payment audits, and administrative logs.
          </p>
        </div>

        <Button variant="secondary" onClick={handleResetFilters} className="gap-2 rounded-2xl shrink-0 cursor-pointer text-xs bg-slate-900 text-slate-300 border-slate-800 hover:text-white">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Filters
        </Button>
      </div>

      {/* HIERARCHICAL FILTER BAR */}
      <div className="p-5 bg-[#111625]/90 border border-slate-800/80 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center gap-2 font-bold text-xs text-slate-300">
          <Filter className="w-4 h-4 text-sky-400" />
          <span>Hierarchical Filter Engine (Year → Month → Category → Group)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* YEAR SELECTOR */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Years</option>
              {['2026', '2025', '2024', '2023', '2022', '2021', '2020'].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* MONTH SELECTOR */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Months</option>
              {[
                'January',
                'February',
                'March',
                'April',
                'May',
                'June',
                'July',
                'August',
                'September',
                'October',
                'November',
                'December',
              ].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* CHIT VALUE SELECTOR */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Chit Value</label>
            <select
              value={selectedChitValue}
              onChange={(e) => setSelectedChitValue(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Values</option>
              <option value="100000">₹1 Lakh</option>
              <option value="200000">₹2 Lakh</option>
              <option value="500000">₹5 Lakh</option>
            </select>
          </div>

          {/* CATEGORY SELECTOR */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Categories</option>
              <option value="Member">Member Actions</option>
              <option value="Group">Group Actions</option>
              <option value="Payment">Payment Records</option>
              <option value="WhatsApp">WhatsApp Broadcasts</option>
              <option value="Adjustment">Adjustments</option>
              <option value="Archived">Archived Records</option>
            </select>
          </div>

          {/* GROUP ID SELECTOR */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Group ID</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Groups</option>
              {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'A', 'B', 'C', 'D', 'E', 'F'].map((g) => (
                <option key={g} value={g}>
                  Group {g}
                </option>
              ))}
            </select>
          </div>

          {/* SEARCH INPUT */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ARCHIVED MEMBERS BANNER IF ANY */}
      {archivedMembers.length > 0 && (
        <Card className="p-5 border border-amber-200 bg-amber-50/50 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-bold text-amber-900">Archived Members ({archivedMembers.length})</h3>
            </div>
            <Badge variant="warning">{archivedMembers.length} Saved in History</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {archivedMembers.map((m) => (
              <div key={m.id} className="p-3 bg-white border border-amber-200 rounded-2xl text-xs space-y-1">
                <p className="font-bold text-slate-900">{m.name}</p>
                <p className="text-slate-500">Phone: {m.phone || 'N/A'}</p>
                <p className="text-[10px] text-amber-800 font-semibold">Holdings Preserved: {m.chits?.length || 0}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AUDIT LOG TIMELINE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-slate-900">Historical Audit Records ({historyEvents.length})</h2>
          <span className="text-xs text-slate-500 font-semibold">Ordered by Date & Time</span>
        </div>

        {loading ? (
          <Card className="p-12 text-center text-slate-500 font-bold text-sm bg-white border border-slate-200 rounded-3xl">
            Loading historical audit data...
          </Card>
        ) : historyEvents.length === 0 ? (
          <Card className="p-12 text-center text-slate-500 font-bold text-sm bg-white border border-slate-200 rounded-3xl space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <p>No historical audit records found for the selected filters.</p>
            <p className="text-xs text-slate-400 font-normal">Try adjusting the Year, Month, or Category selection above.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {historyEvents.map((evt) => (
              <Card key={evt.id} className="p-4 sm:p-5 border border-slate-200 bg-white rounded-3xl shadow-xs hover:border-sky-300 transition-all space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center shrink-0">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{evt.title || evt.action}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{evt.details || 'No detailed note provided.'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <Badge variant={getActionBadgeVariant(evt.action)} className="text-[10px] uppercase font-extrabold">
                      {evt.action}
                    </Badge>
                    <span className="text-[11px] font-semibold text-slate-400">{evt.year} - {evt.month}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2 pt-1">
                  <div className="flex items-center gap-4">
                    {evt.category && (
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        Category: {evt.category}
                      </span>
                    )}
                    {evt.groupId && (
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        Group {evt.groupId}
                      </span>
                    )}
                    {evt.chitValue && (
                      <span className="font-semibold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full">
                        ₹{(evt.chitValue / 100000).toFixed(0)} Lakh Chit
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Performed by: {evt.performedBy || 'Admin'}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
