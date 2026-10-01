import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  History as HistoryIcon,
  Filter,
  Download,
  Search,
  Calendar,
  Layers,
  IndianRupee,
  RotateCcw,
} from 'lucide-react';

import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import { useBillingMonth } from '../context/BillingMonthContext';
import { memberService, chitService, monthlyRecordService } from '../services/dbService';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils';

function compareGroupIds(groupIdA = '', groupIdB = '') {
  const cleanA = String(groupIdA).trim().toUpperCase();
  const cleanB = String(groupIdB).trim().toUpperCase();
  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

export default function PendingHistory() {
  const { selectedMonth, availableMonths } = useBillingMonth();

  // Core Data
  const [historyRecords, setHistoryRecords] = useState([]);
  const [members, setMembers] = useState([]);
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters State
  const [monthFilter, setMonthFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Load Historical Payment Adjustments & Members from Firestore
  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      setLoading(true);
      try {
        const [adjRes, mList, cList] = await Promise.all([
          monthlyRecordService.getMonthlyAdjustments(null),
          memberService.getMembers().catch(() => []),
          chitService.getChits().catch(() => []),
        ]);

        if (mounted) {
          setHistoryRecords(adjRes.adjustmentsList || []);
          setMembers(Array.isArray(mList) ? mList : []);
          setChits(Array.isArray(cList) ? cList : []);
        }
      } catch (err) {
        if (mounted) {
          showToast('Failed to load pending history records from Firebase.', 'error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      mounted = false;
    };
  }, []);

  // Extract all unique Chit Groups dynamically
  const availableGroups = useMemo(() => {
    const groupsSet = new Set();
    (chits || []).forEach((c) => {
      if (c.groupId) groupsSet.add(String(c.groupId).trim());
    });
    (members || []).forEach((m) => {
      if (m.groupId) groupsSet.add(String(m.groupId).trim());
      if (m.group) groupsSet.add(String(m.group).trim());
      (m.chits || []).forEach((c) => {
        if (c.groupId) groupsSet.add(String(c.groupId).trim());
      });
    });
    return Array.from(groupsSet).filter(Boolean).sort(compareGroupIds);
  }, [chits, members]);

  // Combine Firestore member data with monthly historical adjustments for complete record auditing
  const combinedHistoryRows = useMemo(() => {
    const rows = [];
    const recordedKeysSet = new Set();

    // 1. First add all saved Firestore monthly adjustments
    (historyRecords || []).forEach((rec) => {
      const key = `${rec.memberId}_${rec.groupId}_${rec.billingMonth}`;
      recordedKeysSet.add(key);

      rows.push({
        id: rec.id || key,
        memberName: rec.memberName || 'Member',
        groupId: rec.groupId || 'I',
        groupName: `Group ${rec.groupId || 'I'}`,
        billingMonth: rec.billingMonth || 'August 2026',
        chitAmount: Number(rec.chitAmount || 5000),
        paidAmount: Number(rec.paidAmount || 0),
        pendingAmount: Number(rec.pendingAmount || 0),
        balanceAmount: Number(rec.balanceAmount || 0),
        status: rec.status || (rec.pendingAmount === 0 ? 'PAID' : (rec.paidAmount > 0 ? 'PARTIAL' : 'PENDING')),
        updatedAt: rec.updatedAt ? new Date(rec.updatedAt).toLocaleDateString('en-IN') : 'Saved',
      });
    });

    // 2. Synthesize base historical rows for loaded members across available months if not yet explicitly saved
    (members || []).forEach((m) => {
      if (m.status === 'archived') return;

      const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
      const chitSubscriptions = activeChits.length > 0 ? activeChits : [
        {
          groupId: m.groupId || m.group || 'I',
          totalChitValue: m.calculatedTotalChitValue || 100000,
          amountToPay: m.amountToPay || 5000,
          pending: m.pending || 0,
          balance: m.balance || 0,
        }
      ];

      chitSubscriptions.forEach((c) => {
        const gId = String(c.groupId || m.groupId || 'I').trim();
        const reqChitAmount = getEffectiveMonthlyAmount(m, c);

        (availableMonths || ['August 2026']).forEach((bMonth) => {
          const key = `${m.id}_${gId}_${bMonth}`;
          if (!recordedKeysSet.has(key)) {
            const pAmt = Number(c.pending || reqChitAmount);
            const pdAmt = Math.max(reqChitAmount - pAmt, 0);
            
            let status = 'PENDING';
            if (pAmt <= 0) status = 'PAID';
            else if (pdAmt > 0) status = 'PARTIAL';

            rows.push({
              id: key,
              memberName: m.name,
              groupId: gId,
              groupName: `Group ${gId}`,
              billingMonth: bMonth,
              chitAmount: reqChitAmount,
              paidAmount: pdAmt,
              pendingAmount: pAmt,
              balanceAmount: Number(c.balance || 0),
              status,
              updatedAt: 'Base Record',
            });
          }
        });
      });
    });

    return rows;
  }, [historyRecords, members, availableMonths]);

  // Apply Multi-filter Logic to Pending History Table
  const filteredHistoryRows = useMemo(() => {
    return combinedHistoryRows.filter((row) => {
      // 1. Month Filter
      if (monthFilter !== 'all' && row.billingMonth !== monthFilter) return false;

      // 2. Category Filter (1L, 2L, 5L, etc.)
      if (categoryFilter === '100000' && row.chitAmount * 20 !== 100000) return false;
      if (categoryFilter === '200000' && row.chitAmount * 20 !== 200000) return false;
      if (categoryFilter === '500000' && row.chitAmount * 20 !== 500000) return false;

      // 3. Specific Group Filter
      if (groupFilter !== 'all' && String(row.groupId).toLowerCase() !== String(groupFilter).toLowerCase()) return false;

      // 4. Payment Status Filter
      if (statusFilter !== 'all' && String(row.status).toUpperCase() !== String(statusFilter).toUpperCase()) return false;

      // 5. Search Query
      const sq = searchQuery.toLowerCase().trim();
      if (sq) {
        const matchesName = row.memberName.toLowerCase().includes(sq);
        const matchesGroup = row.groupName.toLowerCase().includes(sq);
        const matchesMonth = row.billingMonth.toLowerCase().includes(sq);
        if (!matchesName && !matchesGroup && !matchesMonth) return false;
      }

      return true;
    });
  }, [combinedHistoryRows, monthFilter, categoryFilter, groupFilter, statusFilter, searchQuery]);

  const handleResetFilters = () => {
    setMonthFilter('all');
    setCategoryFilter('all');
    setGroupFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    showToast('Pending History filters reset.', 'info');
  };

  const handleExportHistoryExcel = () => {
    if (filteredHistoryRows.length === 0) {
      showToast('No history records to export.', 'warning');
      return;
    }

    const exportData = filteredHistoryRows.map((r) => ({
      'Member Name': r.memberName,
      'Chit Group': r.groupName,
      'Billing Month': r.billingMonth,
      'Monthly Chit Amount (INR)': r.chitAmount,
      'Paid Amount (INR)': r.paidAmount,
      'Pending Amount (INR)': r.pendingAmount,
      'Balance Credit (INR)': r.balanceAmount,
      'Status': r.status,
      'Updated Date': r.updatedAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending_History');
    
    XLSX.writeFile(
      workbook,
      `Raghavendra_Chitts_Pending_History_${new Date().toISOString().split('T')[0]}.xlsx`
    );

    showToast(`Exported ${filteredHistoryRows.length} history records to Excel spreadsheet!`, 'success');
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'PAID') return <Badge variant="success">PAID</Badge>;
    if (s === 'PARTIAL') return <Badge variant="warning">PARTIAL</Badge>;
    if (s === 'AUCTIONED') return <Badge variant="info">AUCTIONED</Badge>;
    return <Badge variant="danger">PENDING</Badge>;
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans max-w-7xl mx-auto pb-16">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#285F52]">Historical Archive</span>
            <span className="text-[#98A2B3]">•</span>
            <span className="text-xs font-bold text-[#111111]">Month-by-Month Audit</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight">Pending Payment History</h1>
          <p className="text-xs text-[#667085] mt-1">
            Preserves historical monthly pending payment snapshots without deleting or overwriting past billing cycles.
          </p>
        </div>

        <Button variant="outline" className="gap-2 rounded-xl text-xs font-bold cursor-pointer border-[#E5E7EB] bg-white text-[#111111]" onClick={handleExportHistoryExcel}>
          <Download className="w-4 h-4 text-[#285F52]" />
          Export History Excel
        </Button>
      </div>

      {/* FEATURE 1 — FILTERS TOOLBAR */}
      <Card className="p-5 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#285F52]" />
            <span className="text-xs font-black uppercase text-[#111111]">Pending History Multi-Filters</span>
          </div>
          <button onClick={handleResetFilters} className="text-xs text-[#285F52] hover:text-[#214D43] font-bold flex items-center gap-1 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#98A2B3]" />
            <input
              type="text"
              placeholder="Search member, group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] pl-9 pr-3 py-2 text-xs font-semibold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            />
          </div>

          {/* 1. BILLING MONTH FILTER */}
          <div>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            >
              <option value="all">All Billing Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 2. CHIT AMOUNT CATEGORY FILTER */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            >
              <option value="all">All Chit Categories</option>
              <option value="100000">1 Lakh Chits</option>
              <option value="200000">2 Lakh Chits</option>
              <option value="500000">5 Lakh Chits</option>
            </select>
          </div>

          {/* 3. SPECIFIC GROUP FILTER */}
          <div>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            >
              <option value="all">All Groups</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  Group {g}
                </option>
              ))}
            </select>
          </div>

          {/* 4. PAYMENT STATUS FILTER */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2 text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="AUCTIONED">Auctioned</option>
            </select>
          </div>
        </div>
      </Card>

      {/* FEATURE 1 — PENDING HISTORY TABLE */}
      <Card className="border border-[#E5E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#667085] font-bold text-sm">Loading historical pending records...</div>
        ) : filteredHistoryRows.length === 0 ? (
          <div className="p-12 text-center text-[#667085] font-bold text-sm">No historical records found matching your selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F7F8F7] border-b border-[#E5E7EB] text-[10px] font-black uppercase tracking-wider text-[#667085]">
                <tr>
                  <th className="p-3.5">Member Name</th>
                  <th className="p-3.5">Chit Group</th>
                  <th className="p-3.5 text-center">Billing Month</th>
                  <th className="p-3.5 text-right">Chit Amount</th>
                  <th className="p-3.5 text-right">Paid Amount</th>
                  <th className="p-3.5 text-right">Pending Amount</th>
                  <th className="p-3.5 text-right">Balance Credit</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Updated Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredHistoryRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F7F8F7] transition-colors">
                    <td className="p-3.5 font-bold text-[#111111]">{row.memberName}</td>
                    <td className="p-3.5 font-semibold text-[#667085]">{row.groupName}</td>
                    <td className="p-3.5 text-center font-bold text-[#285F52] bg-[#EEF6F3] rounded-lg">{row.billingMonth}</td>
                    <td className="p-3.5 text-right font-bold text-[#111111]">₹{row.chitAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-right font-bold text-[#285F52]">₹{row.paidAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-right font-black text-[#B7791F]">₹{row.pendingAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-right font-semibold text-[#667085]">₹{row.balanceAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3.5 text-center">{getStatusBadge(row.status)}</td>
                    <td className="p-3.5 text-right font-mono text-[11px] text-[#98A2B3]">{row.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
