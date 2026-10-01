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
  Gavel,
  CheckCircle2,
  Trash2,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import { historyService } from '../services/historyService';
import { memberService, paymentService, auctionService } from '../services/dbService';

export default function History() {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'auctions' | 'archived'
  const [historyEvents, setHistoryEvents] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [archivedMembers, setArchivedMembers] = useState([]);
  const [auctionsList, setAuctionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Auction history specific filter
  const [auctionStatusFilter, setAuctionStatusFilter] = useState('all'); // 'all' | 'completed' | 'deleted'
  const [selectedAuctionModal, setSelectedAuctionModal] = useState(null);
  const [deletingAuctionTarget, setDeletingAuctionTarget] = useState(null);
  const [isDeletingAuction, setIsDeletingAuction] = useState(false);

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
        const [events, payments, members, auctionsRes] = await Promise.all([
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
          auctionService.getAuctions().catch(() => ({ auctionsList: [] })),
        ]);

        if (mounted) {
          setHistoryEvents(Array.isArray(events) ? events : []);
          setPaymentsList(Array.isArray(payments) ? payments : []);
          setArchivedMembers(Array.isArray(members) ? members.filter((m) => m.status === 'archived') : []);
          setAuctionsList(Array.isArray(auctionsRes?.auctionsList) ? auctionsRes.auctionsList : []);
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
    setAuctionStatusFilter('all');
    showToast('History filters reset to default.');
  };

  const handleConfirmDeleteAuction = async () => {
    if (!deletingAuctionTarget) return;
    setIsDeletingAuction(true);
    try {
      await auctionService.deleteAuction(deletingAuctionTarget);
      const updated = await auctionService.getAuctions();
      setAuctionsList(Array.isArray(updated?.auctionsList) ? updated.auctionsList : []);
      if (selectedAuctionModal?.id === deletingAuctionTarget.id) {
        setSelectedAuctionModal(null);
      }
      showToast(`✓ Auction marked as DELETED and preserved in Auction History.`);
      setDeletingAuctionTarget(null);
    } catch (err) {
      showToast(`Failed to delete auction: ${err.message}`, 'error');
    } finally {
      setIsDeletingAuction(false);
    }
  };

  const getActionBadgeVariant = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('DELETED') || act.includes('ARCHIVED')) return 'danger';
    if (act.includes('CREATED') || act.includes('ADDED') || act.includes('CLEARED')) return 'success';
    if (act.includes('UPDATED') || act.includes('ADJUSTMENT')) return 'warning';
    return 'info';
  };

  // Filtered auctions for Auction History tab
  const filteredAuctions = auctionsList.filter((a) => {
    // Status filter
    if (auctionStatusFilter === 'completed' && (a.isDeleted || a.status === 'DELETED')) return false;
    if (auctionStatusFilter === 'deleted' && !a.isDeleted && a.status !== 'DELETED') return false;

    // Group filter
    if (selectedGroupId !== 'all' && String(a.groupId).trim().toUpperCase() !== String(selectedGroupId).trim().toUpperCase()) {
      return false;
    }

    // Chit Value filter
    if (selectedChitValue !== 'all' && Number(a.totalChitValue || 100000) !== Number(selectedChitValue)) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = String(a.memberName || a.winnerName || '').toLowerCase().includes(q);
      const matchGroup = String(a.groupId || '').toLowerCase().includes(q) || String(a.groupName || '').toLowerCase().includes(q);
      const matchMonth = String(a.billingMonth || '').toLowerCase().includes(q);
      if (!matchName && !matchGroup && !matchMonth) return false;
    }

    return true;
  });

  const completedAuctionsCount = auctionsList.filter((a) => !a.isDeleted && a.status !== 'DELETED').length;
  const deletedAuctionsCount = auctionsList.filter((a) => a.isDeleted || a.status === 'DELETED').length;

  return (
    <div className="space-y-6 md:space-y-8 font-sans">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-[#285F52] animate-pulse"></span>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#285F52]">Historical Audit & Archive</p>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#111111]">Audit & History Logs</h1>
          <p className="text-xs font-semibold text-[#667085] mt-1">
            Immutably preserved historical records, group archives, auction history, and administrative logs.
          </p>
        </div>

        <Button variant="secondary" onClick={handleResetFilters} className="gap-2 rounded-2xl shrink-0 cursor-pointer text-xs bg-white text-[#111111] border-[#E5E7EB] hover:bg-[#F7F8F7]">
          <RotateCcw className="w-3.5 h-3.5 text-[#285F52]" />
          Reset Filters
        </Button>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#F7F8F7] border border-[#E5E7EB] rounded-2xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-[#285F52] text-white shadow-xs'
              : 'text-[#667085] hover:text-[#111111] hover:bg-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>System Audit Logs ({historyEvents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('auctions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'auctions'
              ? 'bg-[#285F52] text-white shadow-xs'
              : 'text-[#667085] hover:text-[#111111] hover:bg-white'
          }`}
        >
          <Gavel className="w-4 h-4" />
          <span>Auction History ({auctionsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'archived'
              ? 'bg-[#285F52] text-white shadow-xs'
              : 'text-[#667085] hover:text-[#111111] hover:bg-white'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Archived Members ({archivedMembers.length})</span>
        </button>
      </div>

      {/* HIERARCHICAL FILTER BAR */}
      <div className="p-5 bg-white border border-[#E5E7EB] rounded-3xl shadow-xs space-y-4">
        <div className="flex items-center justify-between font-bold text-xs text-[#111111]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#285F52]" />
            <span>Search & Historical Filter Engine</span>
          </div>

          {activeTab === 'auctions' && (
            <div className="flex items-center gap-1.5 bg-[#F7F8F7] p-1 rounded-xl border border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setAuctionStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  auctionStatusFilter === 'all' ? 'bg-[#285F52] text-white' : 'text-[#667085] hover:text-[#111111]'
                }`}
              >
                All ({auctionsList.length})
              </button>
              <button
                type="button"
                onClick={() => setAuctionStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  auctionStatusFilter === 'completed' ? 'bg-[#EEF6F3] text-[#285F52] border border-[#BFD8D0]' : 'text-[#667085] hover:text-[#285F52]'
                }`}
              >
                ✓ Completed ({completedAuctionsCount})
              </button>
              <button
                type="button"
                onClick={() => setAuctionStatusFilter('deleted')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  auctionStatusFilter === 'deleted' ? 'bg-[#FEF3F2] text-[#B42318] border border-[#FECACA]' : 'text-[#667085] hover:text-[#B42318]'
                }`}
              >
                🗑 Deleted ({deletedAuctionsCount})
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* YEAR SELECTOR */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">Chit Value</label>
            <select
              value={selectedChitValue}
              onChange={(e) => setSelectedChitValue(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            >
              <option value="all">All Values</option>
              <option value="100000">₹1 Lakh</option>
              <option value="200000">₹2 Lakh</option>
              <option value="500000">₹5 Lakh</option>
            </select>
          </div>

          {/* CATEGORY SELECTOR */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            >
              <option value="all">All Categories</option>
              <option value="Auction">Auction Records</option>
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">Group ID</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#98A2B3]" />
              <input
                type="text"
                placeholder={activeTab === 'auctions' ? 'Search winner or group...' : 'Search history...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] pl-9 pr-3 py-2 text-xs font-semibold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: AUCTION HISTORY SECTION */}
      {activeTab === 'auctions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-[#111111] flex items-center gap-2">
              <Gavel className="w-5 h-5 text-[#285F52]" />
              <span>Auction History & Audit Records ({filteredAuctions.length})</span>
            </h2>
            <span className="text-xs text-[#667085] font-semibold">Includes completed & soft-deleted auctions</span>
          </div>

          {loading ? (
            <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white border border-[#E5E7EB] rounded-3xl">
              Loading auction history records...
            </Card>
          ) : filteredAuctions.length === 0 ? (
            <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white border border-[#E5E7EB] rounded-3xl space-y-2">
              <Clock className="w-8 h-8 text-[#98A2B3] mx-auto" />
              <p>No auction history records found matching your filters.</p>
              <p className="text-xs text-[#667085] font-normal">Try clearing search filters or changing the status tab.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAuctions.map((auction) => {
                const isDel = auction.isDeleted || auction.status === 'DELETED';
                const formattedCategory = auction.totalChitValue >= 100000 ? `₹${(auction.totalChitValue / 100000).toFixed(0)} Lakh` : `₹${auction.totalChitValue?.toLocaleString('en-IN')}`;
                const fullGroupTitle = `${formattedCategory} — Group ${auction.groupId}`;

                return (
                  <Card
                    key={auction.id}
                    className={`p-5 rounded-3xl border transition-all space-y-3 ${
                      isDel
                        ? 'border-[#FECACA] bg-[#FEF3F2] text-[#B42318]'
                        : 'border-[#E5E7EB] bg-white text-[#111111] hover:border-[#BFD8D0]'
                    }`}
                  >
                    {/* TOP BADGE ROW */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E7EB]">
                      {isDel ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF3F2] border border-[#FECACA] text-[#B42318] text-[10px] font-black tracking-wide">
                          <Trash2 className="w-3 h-3 text-[#B42318]" />
                          DELETED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EEF6F3] border border-[#BFD8D0] text-[#285F52] text-[10px] font-black tracking-wide">
                          <CheckCircle2 className="w-3 h-3 text-[#285F52]" />
                          COMPLETED
                        </span>
                      )}

                      <span className="text-[10px] font-mono font-bold text-[#667085] bg-[#F7F8F7] px-2 py-0.5 rounded-md border border-[#E5E7EB]">
                        Round {auction.roundNumber || 1} • {auction.billingMonth}
                      </span>
                    </div>

                    {/* WINNER & GROUP */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085]">
                        Winner Member
                      </p>
                      <p className="text-base font-black text-[#111111] truncate">
                        {auction.memberName || auction.winnerName || 'Member'}
                      </p>
                      <p className="text-xs font-bold text-[#285F52]">
                        {fullGroupTitle}
                      </p>
                    </div>

                    {/* FINANCIAL METRICS */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#F7F8F7] rounded-xl border border-[#E5E7EB] text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-[#667085] uppercase block">Auction Bid</span>
                        <span className="font-black text-[#111111]">₹{auction.bidAmount?.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-[#667085] uppercase block">Dividend / Member</span>
                        <span className="font-black text-[#285F52]">₹{auction.dividend?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* DATES & ACTION */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] text-[11px]">
                      <span className="text-[#667085]">
                        Conducted: {auction.auctionDate || 'Recent'}
                      </span>

                      <div className="flex items-center gap-2">
                        {!isDel && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeletingAuctionTarget({
                                ...auction,
                                groupTitle: fullGroupTitle,
                              })
                            }
                            title="Delete Auction"
                            className="p-1 text-[#98A2B3] hover:text-[#B42318] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAuctionModal({
                              ...auction,
                              groupTitle: fullGroupTitle,
                            })
                          }
                          className="flex items-center gap-1 font-bold text-[#285F52] hover:text-[#214D43] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SYSTEM AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-[#111111]">Historical Audit Records ({historyEvents.length})</h2>
            <span className="text-xs text-[#667085] font-semibold">Ordered by Date & Time</span>
          </div>

          {loading ? (
            <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white border border-[#E5E7EB] rounded-3xl">
              Loading historical audit data...
            </Card>
          ) : historyEvents.length === 0 ? (
            <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white border border-[#E5E7EB] rounded-3xl space-y-2">
              <Clock className="w-8 h-8 text-[#98A2B3] mx-auto" />
              <p>No historical audit records found for the selected filters.</p>
              <p className="text-xs text-[#667085] font-normal">Try adjusting the Year, Month, or Category selection above.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {historyEvents.map((evt) => (
                <Card key={evt.id} className="p-4 sm:p-5 border border-[#E5E7EB] bg-white rounded-3xl shadow-xs hover:border-[#BFD8D0] transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-[#EEF6F3] text-[#285F52] font-bold flex items-center justify-center shrink-0 border border-[#BFD8D0]">
                        <FileText className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#111111]">{evt.title || evt.action}</h3>
                        <p className="text-xs text-[#667085] mt-0.5">{evt.details || 'No detailed note provided.'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <Badge variant={getActionBadgeVariant(evt.action)} className="text-[10px] uppercase font-extrabold">
                        {evt.action}
                      </Badge>
                      <span className="text-[11px] font-semibold text-[#667085]">{evt.year} - {evt.month}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs text-[#667085] gap-2 pt-1">
                    <div className="flex items-center gap-3">
                      {evt.category && (
                        <span className="font-semibold text-[#111111] bg-[#F7F8F7] border border-[#E5E7EB] px-2.5 py-0.5 rounded-full">
                          Category: {evt.category}
                        </span>
                      )}
                      {evt.groupId && (
                        <span className="font-semibold text-[#111111] bg-[#F7F8F7] border border-[#E5E7EB] px-2.5 py-0.5 rounded-full">
                          Group {evt.groupId}
                        </span>
                      )}
                      {evt.chitValue && (
                        <span className="font-semibold text-[#285F52] bg-[#EEF6F3] border border-[#BFD8D0] px-2.5 py-0.5 rounded-full">
                          ₹{(evt.chitValue / 100000).toFixed(0)} Lakh Chit
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[#667085] text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#285F52]" />
                      <span>Performed by: {evt.performedBy || 'Admin'}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ARCHIVED MEMBERS SECTION */}
      {activeTab === 'archived' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-[#111111] flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#B7791F]" />
              <span>Archived Members ({archivedMembers.length})</span>
            </h2>
            <Badge variant="warning">{archivedMembers.length} Saved in History</Badge>
          </div>

          {archivedMembers.length === 0 ? (
            <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white border border-[#E5E7EB] rounded-3xl">
              No archived members recorded in history.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {archivedMembers.map((m) => (
                <div key={m.id} className="p-4 bg-white border border-[#E5E7EB] rounded-2xl text-xs space-y-2 shadow-xs">
                  <p className="font-bold text-[#111111] text-sm">{m.name}</p>
                  <p className="text-[#667085]">Phone: {m.phone || 'N/A'}</p>
                  <p className="text-[11px] text-[#B7791F] font-semibold">Holdings Preserved: {m.chits?.length || 0}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW AUCTION MODAL IN HISTORY */}
      {selectedAuctionModal && (
        <Modal
          isOpen={Boolean(selectedAuctionModal)}
          onClose={() => setSelectedAuctionModal(null)}
          title="Auction Historical Audit Record"
          subtitle={`Detailed audit log for ${selectedAuctionModal.groupTitle || 'Chit Group'}.`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className={`p-4 rounded-2xl space-y-2 border ${
              selectedAuctionModal.isDeleted || selectedAuctionModal.status === 'DELETED'
                ? 'bg-[#FEF3F2] border-[#FECACA] text-[#B42318]'
                : 'bg-[#EEF6F3] border-[#BFD8D0] text-[#285F52]'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  {selectedAuctionModal.isDeleted || selectedAuctionModal.status === 'DELETED' ? (
                    <>
                      <Trash2 className="w-4 h-4 text-[#B42318]" />
                      DELETED AUCTION RECORD
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#285F52]" />
                      COMPLETED AUCTION RECORD
                    </>
                  )}
                </span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#E5E7EB] text-[#111111]">
                  Round {selectedAuctionModal.roundNumber || 1}
                </span>
              </div>
              <p className="text-base font-black text-[#111111]">
                {selectedAuctionModal.memberName || selectedAuctionModal.winnerName || 'Member'}
              </p>
              <p className="text-xs font-bold text-[#285F52]">
                {selectedAuctionModal.groupTitle}
              </p>
            </div>

            <div className="space-y-2.5 bg-[#F7F8F7] border border-[#E5E7EB] p-4 rounded-xl text-[#111111]">
              <div className="flex justify-between">
                <span className="text-[#667085] font-semibold">Total Chit Value:</span>
                <span className="font-bold text-[#111111]">₹{selectedAuctionModal.totalChitValue?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085] font-semibold">Bid Discount Amount:</span>
                <span className="font-bold text-[#111111]">₹{selectedAuctionModal.bidAmount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085] font-semibold">Dividend / Member:</span>
                <span className="font-bold text-[#285F52]">₹{selectedAuctionModal.dividend?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
                <span className="text-[#111111] font-bold">Net Prize Payout:</span>
                <span className="font-black text-[#285F52] text-sm">
                  ₹{selectedAuctionModal.netPayout?.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#E5E7EB] text-[11px]">
                <span className="text-[#667085]">Conducted Date:</span>
                <span className="font-medium text-[#111111]">{selectedAuctionModal.auctionDate || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#667085]">Billing Cycle:</span>
                <span className="font-medium text-[#111111]">{selectedAuctionModal.billingMonth}</span>
              </div>

              {(selectedAuctionModal.isDeleted || selectedAuctionModal.status === 'DELETED') && (
                <div className="p-2.5 bg-[#FEF3F2] border border-[#FECACA] rounded-lg text-[#B42318] text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B42318]" />
                    Deletion Audit Trail
                  </div>
                  <div>Deleted By: {selectedAuctionModal.deletedBy || 'Admin'}</div>
                  <div>Deleted At: {selectedAuctionModal.deletedAt ? new Date(selectedAuctionModal.deletedAt).toLocaleString() : 'Recorded'}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedAuctionModal(null)}
                className="bg-white text-[#111111] border-[#E5E7EB]"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRMATION DIALOG FOR AUCTION DELETION IN HISTORY */}
      {deletingAuctionTarget && (
        <Modal
          isOpen={Boolean(deletingAuctionTarget)}
          onClose={() => !isDeletingAuction && setDeletingAuctionTarget(null)}
          title="Delete this auction?"
          subtitle="Confirm removing auction from active view."
          maxWidth="max-w-md"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 bg-[#FEF3F2] border border-[#FECACA] rounded-xl space-y-1 text-[#B42318]">
              <p className="font-bold text-[#111111]">
                Winner: {deletingAuctionTarget.memberName || 'Member'}
              </p>
              <p className="text-[11px] text-[#667085]">
                Group: {deletingAuctionTarget.groupTitle || `Group ${deletingAuctionTarget.groupId}`} • Round {deletingAuctionTarget.roundNumber || 1}
              </p>
            </div>

            <p className="text-[#667085] leading-relaxed">
              The auction will be removed from the active auction view, but its complete record will remain in Auction History.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="secondary"
                size="sm"
                disabled={isDeletingAuction}
                onClick={() => setDeletingAuctionTarget(null)}
                className="bg-white text-[#111111] border-[#E5E7EB]"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeletingAuction}
                onClick={handleConfirmDeleteAuction}
                className="bg-[#B42318] hover:bg-[#911c13] text-white font-bold cursor-pointer"
              >
                {isDeletingAuction ? 'Deleting...' : 'Delete Auction'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
