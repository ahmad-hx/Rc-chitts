import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Clock,
  Filter,
  RefreshCw,
  Download,
  Send,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  IndianRupee,
  User,
  Phone,
  RotateCcw,
  Edit3,
} from 'lucide-react';

import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import { useBillingMonth } from '../context/BillingMonthContext';
import {
  memberService,
  chitService,
  paymentService,
  monthlyRecordService,
  groupPaymentSettingsService,
} from '../services/dbService';
import {
  sendSingleWhatsAppMessage,
  normalizeWhatsAppNumber,
} from '../services/whatsappService';
import {
  generatePersonalizedMessage,
  createMessageHistoryDoc,
} from '../services/messagingService';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils';

function compareGroupIds(groupIdA = '', groupIdB = '') {
  const cleanA = String(groupIdA).trim().toUpperCase();
  const cleanB = String(groupIdB).trim().toUpperCase();
  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

export default function PendingPayments() {
  const { selectedMonth, setSelectedMonth, availableMonths } = useBillingMonth();

  // Core Data States
  const [members, setMembers] = useState([]);
  const [chits, setChits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters State
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editable Form Inputs State per member (key: `${memberId}_${groupId}`)
  const [editedAmounts, setEditedAmounts] = useState({});
  const [groupMonthlyChitAmount, setGroupMonthlyChitAmount] = useState(5000);

  // Checkbox Selection State (Array of `${memberId}_${groupId}`)
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Modals & Progress
  const [isApplyAllModalOpen, setIsApplyAllModalOpen] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  
  // Record Payment Modal target state
  const [selectedRecordPaymentTarget, setSelectedRecordPaymentTarget] = useState(null);
  // Completed Follow-ups state
  const [completedFollowUps, setCompletedFollowUps] = useState([]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Load Data on Mount or Month Change
  const loadData = async () => {
    setLoading(true);
    try {
      const [mList, cList, pList, settingsRes] = await Promise.all([
        memberService.getMembers().catch(() => []),
        chitService.getChits().catch(() => []),
        paymentService.getPayments().catch(() => []),
        groupPaymentSettingsService.getGroupPaymentSettings().catch(() => ({ settingsMap: {} })),
      ]);

      setMembers(Array.isArray(mList) ? mList : []);
      setChits(Array.isArray(cList) ? cList : []);
      setPayments(Array.isArray(pList) ? pList : []);
      setGroupPaymentSettings(settingsRes.settingsMap || {});
    } catch (err) {
      showToast('Error loading payment data from Firebase.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  // Mark Follow-up as Done (Does NOT alter actual payment amounts or mark full payment)
  const handleMarkDone = (row) => {
    setCompletedFollowUps((prev) =>
      prev.includes(row.rowKey) ? prev.filter((k) => k !== row.rowKey) : [...prev, row.rowKey]
    );
    showToast(`✓ Follow-up updated for ${row.memberName}. Actual payment balance remains preserved.`, 'info');
  };

  // Extract all unique Chit Groups dynamically from loaded chits & members
  const availableGroups = useMemo(() => {
    const groupsSet = new Set();
    (chits || []).forEach((c) => {
      if (c.groupId) groupsSet.add(String(c.groupId).trim());
      if (c.group) groupsSet.add(String(c.group).trim());
    });
    (members || []).forEach((m) => {
      if (m.groupId) groupsSet.add(String(m.groupId).trim());
      if (m.group) groupsSet.add(String(m.group).trim());
      (m.chits || []).forEach((c) => {
        if (c.groupId) groupsSet.add(String(c.groupId).trim());
        if (c.group) groupsSet.add(String(c.group).trim());
      });
    });
    return Array.from(groupsSet).filter(Boolean).sort(compareGroupIds);
  }, [chits, members]);

  // Organize groups hierarchically by Chit Amount (1L -> 2L -> 5L -> 10L)
  const groupedAvailableGroups = useMemo(() => {
    const groupValueMap = new Map();
    (chits || []).forEach((c) => {
      const gId = String(c.groupId || c.group || '').trim();
      const val = Number(c.totalChitValue || c.totalValue || c.chitValue || 100000);
      if (gId) groupValueMap.set(gId, val);
    });
    (members || []).forEach((m) => {
      (m.chits || []).forEach((c) => {
        const gId = String(c.groupId || c.group || '').trim();
        const val = Number(c.totalChitValue || c.totalValue || c.chitValue || 100000);
        if (gId && !groupValueMap.has(gId)) {
          groupValueMap.set(gId, val);
        }
      });
    });

    const categoryMap = new Map();
    (availableGroups || []).forEach((gId) => {
      const val = groupValueMap.get(gId) || 100000;
      const lakhStr = val >= 100000 ? `${(val / 100000).toFixed(0)} Lakh Chit Groups` : `₹${val.toLocaleString('en-IN')} Groups`;
      if (!categoryMap.has(val)) {
        categoryMap.set(val, { val, label: lakhStr, groups: [] });
      }
      categoryMap.get(val).groups.push(gId);
    });

    const sortedCategories = Array.from(categoryMap.values()).sort((a, b) => a.val - b.val);
    sortedCategories.forEach((cat) => cat.groups.sort(compareGroupIds));
    return sortedCategories;
  }, [availableGroups, chits, members]);

  // Calculate Member Payment Status Rows for the Selected Month & Group Filter
  // Strictly derived from actual payment history / transactions for selectedMonth per individual chit
  const memberPaymentRows = useMemo(() => {
    const rows = [];

    (members || []).forEach((m) => {
      if (m.status === 'archived') return;

      const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
      const chitSubscriptions = activeChits.length > 0 ? activeChits : [
        {
          id: `chit_${m.id}_${m.groupId || 'I'}`,
          groupId: m.groupId || m.group || 'I',
          totalChitValue: m.calculatedTotalChitValue || 100000,
          amountToPay: m.amountToPay || 5000,
          pending: m.pending || 0,
          balance: m.balance || 0,
        },
      ];

      const isMultiChit = chitSubscriptions.length > 1;

      chitSubscriptions.forEach((c) => {
        const gId = String(c.groupId || m.groupId || m.group || 'I').trim();

        // Apply Group Filter
        if (selectedGroupId !== 'all' && gId !== selectedGroupId) return;

        // Apply Search Filter
        const sq = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !sq ||
          (m.name && m.name.toLowerCase().includes(sq)) ||
          (m.phone && String(m.phone).includes(sq)) ||
          (gId && gId.toLowerCase().includes(sq));

        if (!matchesSearch) return;

        const rowKey = `${m.id}_${gId}`;
        const chitVal = Number(c.totalChitValue || 100000);

        const reqChitAmount = getEffectiveMonthlyAmount(m, c, groupPaymentSettings);

        // Calculate paid amount from actual payment transactions in Firestore for selectedMonth
        let paidFromTxns = 0;
        const mPhoneClean = (m.phone || m.whatsapp || '').replace(/\D/g, '');
        const mNameClean = (m.name || '').trim().toLowerCase();
        const cleanGroupStr = gId.replace(/^GROUP\s+/i, '').toUpperCase();

        (payments || []).forEach((p) => {
          const pStatus = String(p.status || 'cleared').toLowerCase();
          if (pStatus === 'failed' || pStatus === 'cancelled') return;

          // 1. Billing Month Match
          let pMonth = p.billingMonth;
          if (!pMonth && p.date) {
            try {
              const d = new Date(p.date);
              if (!isNaN(d.getTime())) {
                pMonth = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
              }
            } catch (_) {}
          }
          if (!pMonth && p.createdAt) {
            try {
              const d = new Date(p.createdAt);
              if (!isNaN(d.getTime())) {
                pMonth = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
              }
            } catch (_) {}
          }

          if (pMonth && String(pMonth).trim().toLowerCase() !== String(selectedMonth).trim().toLowerCase()) {
            return; // Different billing month
          }

          // 2. Member Match
          const pMemId = p.memberId;
          const pMemName = (p.member || p.memberName || '').trim().toLowerCase();
          const pPhoneClean = (p.phone || p.phoneNumber || '').replace(/\D/g, '');

          const isMemMatch =
            (pMemId && pMemId === m.id) ||
            (mPhoneClean && pPhoneClean && (mPhoneClean.endsWith(pPhoneClean) || pPhoneClean.endsWith(mPhoneClean))) ||
            (mNameClean && pMemName && (mNameClean === pMemName || mNameClean.includes(pMemName) || pMemName.includes(mNameClean)));

          if (!isMemMatch) return;

          // 3. Chit Group Match for Multi-Chit vs Single-Chit
          const pGrp = String(p.group || p.groupId || p.chitGroup || '').trim().toUpperCase().replace(/^GROUP\s+/, '');

          let isGrpMatch = false;
          if (!isMultiChit) {
            isGrpMatch = true;
          } else {
            if (p.chitId && (p.chitId === c.id || p.chitId === c.groupId)) {
              isGrpMatch = true;
            } else if (pGrp && pGrp !== 'ALL') {
              isGrpMatch = (cleanGroupStr === pGrp || cleanGroupStr.includes(pGrp) || pGrp.includes(cleanGroupStr));
            } else {
              isGrpMatch = (cleanGroupStr === String(m.groupId || m.group || 'I').replace(/^GROUP\s+/i, '').toUpperCase());
            }
          }

          if (isGrpMatch) {
            paidFromTxns += Number(p.amount || 0);
          }
        });

        let paidAmount = paidFromTxns;
        let pendingAmount = Math.max(reqChitAmount - paidAmount, 0);
        let balanceAmount = Number(c.balance || c.balanceAmount || 0);

        // Apply live edited overrides if present
        if (editedAmounts[rowKey]) {
          if (editedAmounts[rowKey].pendingAmount !== undefined) {
            pendingAmount = Number(editedAmounts[rowKey].pendingAmount);
            paidAmount = Math.max(reqChitAmount - pendingAmount, 0);
          }
          if (editedAmounts[rowKey].balanceAmount !== undefined) {
            balanceAmount = Number(editedAmounts[rowKey].balanceAmount);
          }
        }

        // Section Rules:
        // - Fully Paid (paidAmount >= reqChitAmount or pendingAmount <= 0): Excluded from active Pending queue
        // - Unpaid (paidAmount = 0): Section 1 (FULL PENDING / UNPAID)
        // - Partial Payment (0 < paidAmount < reqChitAmount): Section 2 (PARTIALLY PAID)
        if (pendingAmount <= 0 || paidAmount >= reqChitAmount) {
          return;
        }

        const status = paidAmount > 0 ? 'PARTIAL' : 'PENDING';
        const totalDue = pendingAmount;

        rows.push({
          rowKey,
          memberId: m.id,
          memberName: m.name,
          phone: m.phone || m.whatsapp || '',
          whatsapp: m.whatsapp || m.phone || '',
          groupId: gId,
          groupName: `Group ${gId}`,
          chitValue: chitVal,
          reqChitAmount,
          paidAmount,
          pendingAmount,
          balanceAmount,
          totalDue,
          status,
          memberObj: m,
          chitObj: c,
        });
      });
    });

    return rows;
  }, [members, chits, payments, groupPaymentSettings, editedAmounts, selectedGroupId, selectedMonth, searchQuery]);

  // Section 1: Full Pending / Unpaid Members (Paid = ₹0)
  const fullPendingRows = useMemo(() => {
    return memberPaymentRows.filter((r) => r.status === 'PENDING');
  }, [memberPaymentRows]);

  // Section 2: Partial Payment Members (0 < Paid < Required)
  const partialPaymentRows = useMemo(() => {
    return memberPaymentRows.filter((r) => r.status === 'PARTIAL');
  }, [memberPaymentRows]);

  // Dashboard Summaries Metrics
  const summaryMetrics = useMemo(() => {
    const totalPendingMembers = fullPendingRows.length;
    const partialPaymentMembers = partialPaymentRows.length;
    
    const totalPendingAmount = fullPendingRows.reduce((sum, r) => sum + r.pendingAmount, 0);
    const totalPartialRemaining = partialPaymentRows.reduce((sum, r) => sum + r.pendingAmount, 0);

    return {
      totalPendingMembers,
      partialPaymentMembers,
      totalPendingAmount,
      totalPartialRemaining,
    };
  }, [fullPendingRows, partialPaymentRows]);

  // Handle Input Changes for Pending Amount or Balance Amount
  const handleAmountChange = (rowKey, field, value) => {
    const num = Math.max(parseFloat(value) || 0, 0);
    setEditedAmounts((prev) => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        [field]: num,
      },
    }));
  };

  // Selection Checkbox Handlers
  const handleToggleRow = (rowKey) => {
    setSelectedRowKeys((prev) =>
      prev.includes(rowKey) ? prev.filter((k) => k !== rowKey) : [...prev, rowKey]
    );
  };

  const handleSelectAllCurrent = () => {
    const allCurrentKeys = [...fullPendingRows, ...partialPaymentRows].map((r) => r.rowKey);
    if (selectedRowKeys.length === allCurrentKeys.length) {
      setSelectedRowKeys([]);
    } else {
      setSelectedRowKeys(allCurrentKeys);
    }
  };

  // Apply to Selected (Bulk Update selected rows to monthlyAdjustments)
  const handleApplyToSelected = async () => {
    const selectedRows = [...fullPendingRows, ...partialPaymentRows].filter((r) =>
      selectedRowKeys.includes(r.rowKey)
    );

    if (selectedRows.length === 0) {
      showToast('Please select at least one member to update.', 'warning');
      return;
    }

    try {
      const recordsToSave = selectedRows.map((r) => ({
        memberId: r.memberId,
        memberName: r.memberName,
        groupId: r.groupId,
        billingMonth: selectedMonth,
        chitAmount: r.reqChitAmount,
        paidAmount: r.paidAmount,
        pendingAmount: r.pendingAmount,
        balanceAmount: r.balanceAmount,
        status: r.status,
      }));

      await monthlyRecordService.bulkSaveMonthlyAdjustments(recordsToSave);
      showToast(`✓ Successfully saved adjustments for ${selectedRows.length} selected member records!`, 'success');
      loadData();
    } catch (err) {
      showToast(`Update failed: ${err.message}`, 'error');
    }
  };

  // Apply All (Applies changes to all loaded members after confirmation)
  const handleConfirmApplyAll = async () => {
    setIsApplyAllModalOpen(false);
    const allRows = [...fullPendingRows, ...partialPaymentRows];
    if (allRows.length === 0) return;

    try {
      const recordsToSave = allRows.map((r) => ({
        memberId: r.memberId,
        memberName: r.memberName,
        groupId: r.groupId,
        billingMonth: selectedMonth,
        chitAmount: r.reqChitAmount,
        paidAmount: r.paidAmount,
        pendingAmount: r.pendingAmount,
        balanceAmount: r.balanceAmount,
        status: r.status,
      }));

      await monthlyRecordService.bulkSaveMonthlyAdjustments(recordsToSave);
      showToast(`✓ Applied updates to all ${allRows.length} members for ${selectedMonth}!`, 'success');
      loadData();
    } catch (err) {
      showToast(`Apply All failed: ${err.message}`, 'error');
    }
  };

  // Reset Form
  const handleResetForm = () => {
    setEditedAmounts({});
    setSelectedRowKeys([]);
    setSearchQuery('');
    showToast('Temporary form edits and selections reset.', 'info');
  };

  // Send WhatsApp Reminders (Single / Selected / All)
  const handleSendWhatsAppReminder = async (row) => {
    const rawPhone = row.whatsapp || row.phone;
    const norm = normalizeWhatsAppNumber(rawPhone);

    if (!norm) {
      showToast(`Member "${row.memberName}" does not have a valid WhatsApp phone number.`, 'error');
      return;
    }

    const msg = generatePersonalizedMessage(row.memberObj, null, {
      billingMonth: selectedMonth,
      groupPaymentSettings,
      allGroupsList: chits,
      paymentsList: payments,
    });

    try {
      const res = await sendSingleWhatsAppMessage({
        member: row.memberObj,
        recipient: norm,
        message: msg,
      });

      const isSent = res.success || res.status === 'SENT';

      await createMessageHistoryDoc({
        member: row.memberObj,
        phone: norm,
        channel: 'WHATSAPP',
        message: msg,
        status: isSent ? 'SENT' : 'FAILED',
        groupId: row.groupId,
        billingMonth: selectedMonth,
        chitAmount: row.reqChitAmount,
        pendingAmount: row.pendingAmount,
        balanceAmount: row.balanceAmount,
      });

      if (isSent) {
        showToast(`✓ Payment reminder sent to ${row.memberName}!`, 'success');
      } else {
        showToast(`⚠️ Could not send directly to ${row.memberName}. WhatsApp gateway checked.`, 'warning');
      }
    } catch (err) {
      showToast(`Send error: ${err.message}`, 'error');
    }
  };

  const handleSendRemindersToSelected = async () => {
    const selectedRows = [...fullPendingRows, ...partialPaymentRows].filter((r) =>
      selectedRowKeys.includes(r.rowKey)
    );

    if (selectedRows.length === 0) {
      showToast('Select at least one member to send reminders.', 'warning');
      return;
    }

    setIsBulkSending(true);
    setSendProgress({ current: 0, total: selectedRows.length });

    for (let i = 0; i < selectedRows.length; i++) {
      setSendProgress({ current: i + 1, total: selectedRows.length });
      await handleSendWhatsAppReminder(selectedRows[i]);
      if (i < selectedRows.length - 1) {
        await new Promise((r) => setTimeout(r, 4500));
      }
    }

    setIsBulkSending(false);
    showToast(`✓ Sent reminders to ${selectedRows.length} members!`, 'success');
  };

  // Export to Excel
  const handleExportToExcel = () => {
    const allPendingRecords = [...fullPendingRows, ...partialPaymentRows];
    if (allPendingRecords.length === 0) {
      showToast('No pending or partial payment records to export.', 'warning');
      return;
    }

    const exportData = allPendingRecords.map((r) => ({
      'Member Name': r.memberName,
      'Phone Number': r.phone,
      'Chit Group': `Group ${r.groupId}`,
      'Billing Month': selectedMonth,
      'Required Chit Amount (INR)': r.reqChitAmount,
      'Paid Amount (INR)': r.paidAmount,
      'Remaining Balance (INR)': r.pendingAmount,
      'Total Due (INR)': r.totalDue,
      'Payment Status': r.status === 'PARTIAL' ? 'Partially Paid' : 'Unpaid (Full Pending)',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending_Payments');
    
    XLSX.writeFile(
      workbook,
      `Raghavendra_Chitts_Pending_Payments_${selectedMonth.replace(/\s+/g, '_')}.xlsx`
    );

    showToast(`Exported ${allPendingRecords.length} records to Excel spreadsheet!`, 'success');
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans max-w-7xl mx-auto pb-16">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#285F52]">Collection & Audit</span>
            <span className="text-[#98A2B3]">•</span>
            <span className="text-xs font-bold text-[#111111]">{selectedMonth}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight">Pending Payments & Partial Collection</h1>
          <p className="text-xs text-[#667085] mt-1">
            Track Unpaid (Paid ₹0) & Partially Paid members. Members only leave Pending when remaining balance is ₹0.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-xl text-xs font-bold cursor-pointer border-[#E5E7EB] bg-white text-[#111111]" onClick={handleExportToExcel}>
            <Download className="w-4 h-4 text-[#285F52]" />
            Export to Excel
          </Button>

          <Button variant="primary" className="gap-2 rounded-xl text-xs font-bold bg-[#285F52] hover:bg-[#214D43] text-white cursor-pointer" onClick={handleSendRemindersToSelected}>
            <Send className="w-4 h-4" />
            Send Reminders ({selectedRowKeys.length})
          </Button>
        </div>
      </div>

      {/* DASHBOARD SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[#667085] uppercase tracking-wider">Unpaid Subscriptions</span>
            <Clock className="w-4 h-4 text-[#B7791F]" />
          </div>
          <p className="text-2xl font-black text-[#111111] mt-2">{summaryMetrics.totalPendingMembers}</p>
          <p className="text-[11px] font-semibold text-[#B7791F] mt-1">Zero payment (Paid ₹0)</p>
        </Card>

        <Card className="p-4 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[#667085] uppercase tracking-wider">Partially Paid Subscriptions</span>
            <AlertCircle className="w-4 h-4 text-[#B7791F]" />
          </div>
          <p className="text-2xl font-black text-[#111111] mt-2">{summaryMetrics.partialPaymentMembers}</p>
          <p className="text-[11px] font-semibold text-[#B7791F] mt-1">Paid partial amount</p>
        </Card>

        <Card className="p-4 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[#667085] uppercase tracking-wider">Unpaid Dues</span>
            <IndianRupee className="w-4 h-4 text-[#B7791F]" />
          </div>
          <p className="text-2xl font-black text-[#B7791F] mt-2">₹{summaryMetrics.totalPendingAmount.toLocaleString('en-IN')}</p>
          <p className="text-[11px] font-semibold text-[#667085] mt-1">Outstanding sum from unpaid</p>
        </Card>

        <Card className="p-4 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[#667085] uppercase tracking-wider">Partial Remaining</span>
            <IndianRupee className="w-4 h-4 text-[#B7791F]" />
          </div>
          <p className="text-2xl font-black text-[#B7791F] mt-2">₹{summaryMetrics.totalPartialRemaining.toLocaleString('en-IN')}</p>
          <p className="text-[11px] font-semibold text-[#667085] mt-1">Remaining balance from partials</p>
        </Card>
      </div>

      {/* CONTROL AREA AT TOP */}
      <Card className="p-5 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#285F52]" />
            <span className="text-xs font-black uppercase text-[#111111]">Payment Collection Control Panel</span>
          </div>
          <button onClick={handleResetForm} className="text-xs text-[#285F52] hover:text-[#214D43] font-bold flex items-center gap-1 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Edits
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. CHIT GROUP */}
          <div>
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">Chit Group</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52] cursor-pointer"
            >
              <option value="all">All Chit Groups</option>
              {groupedAvailableGroups.map((cat) => (
                <optgroup key={cat.val} label={`── ${cat.label} ──`}>
                  {cat.groups.map((g) => (
                    <option key={g} value={g}>
                      Group {g}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 2. BILLING MONTH */}
          <div>
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">Billing Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 3. GROUP CHIT AMOUNT */}
          <div>
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">Group Monthly Chit Amount</label>
            <input
              type="number"
              min="0"
              step="1"
              value={groupMonthlyChitAmount}
              onChange={(e) => setGroupMonthlyChitAmount(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
            />
          </div>

          {/* 4. GROUP PENDING AMOUNT */}
          <div>
            <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">Total Outstanding Pending</label>
            <div className="w-full px-3 py-2 text-xs font-black bg-[#FFF8E7] border border-[#FDE68A] rounded-xl text-[#B7791F]">
              ₹{(summaryMetrics.totalPendingAmount + summaryMetrics.totalPartialRemaining).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* BULK ACTION CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter member name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 px-3 py-1.5 text-xs bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none"
            />
            <button
              onClick={handleSelectAllCurrent}
              className="px-3 py-1.5 text-xs font-bold border border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] rounded-xl hover:bg-[#E5E7EB] cursor-pointer"
            >
              Select All / Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold cursor-pointer border-[#E5E7EB] bg-white text-[#111111]"
              onClick={handleApplyToSelected}
            >
              Apply to Selected ({selectedRowKeys.length})
            </Button>

            <Button
              variant="primary"
              size="sm"
              className="rounded-xl text-xs font-bold bg-[#285F52] hover:bg-[#214D43] text-white cursor-pointer"
              onClick={() => setIsApplyAllModalOpen(true)}
            >
              Apply All ({fullPendingRows.length + partialPaymentRows.length})
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="p-12 text-center text-[#667085] font-bold text-sm">Loading payment records...</div>
      ) : (
        <div className="space-y-8">
          {/* ─── SECTION 1: UNPAID MEMBERS (Paid Amount = ₹0) ─────────────────────────── */}
          <Card className="border border-[#E5E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 bg-[#FFF8E7] border-b border-[#FDE68A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-[#B7791F] text-white rounded-lg">
                  UNPAID
                </span>
                <h2 className="text-sm font-black text-[#111111]">SECTION 1 — UNPAID MEMBERS</h2>
                <span className="text-xs text-[#667085]">({fullPendingRows.length} Subscriptions • Paid Amount = ₹0 for {selectedMonth})</span>
              </div>
            </div>

            {fullPendingRows.length === 0 ? (
              <div className="p-8 text-center text-[#667085] text-xs font-bold">
                ✓ No unpaid members found for {selectedMonth}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#F7F8F7] border-b border-[#E5E7EB] text-[10px] font-black uppercase tracking-wider text-[#667085]">
                    <tr>
                      <th className="p-3 w-10 text-center">Select</th>
                      <th className="p-3">Member Name</th>
                      <th className="p-3">Chit / Group</th>
                      <th className="p-3 text-right">Due ₹</th>
                      <th className="p-3 text-right">Paid ₹</th>
                      <th className="p-3 text-right">Remaining ₹</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {fullPendingRows.map((row) => {
                      const isChecked = selectedRowKeys.includes(row.rowKey);
                      const isDone = completedFollowUps.includes(row.rowKey);
                      return (
                        <tr key={row.rowKey} className={`hover:bg-[#F7F8F7] transition-colors ${isChecked ? 'bg-[#EEF6F3]' : ''}`}>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(row.rowKey)}
                              className="rounded border-slate-300 text-[#285F52] focus:ring-[#285F52] cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-[#111111]">
                            <div>{row.memberName}</div>
                            <div className="text-[10px] font-normal text-[#667085] font-mono">{row.phone}</div>
                          </td>
                          <td className="p-3 font-semibold text-[#667085]">{row.groupName}</td>
                          <td className="p-3 text-right font-bold text-[#111111]">₹{row.reqChitAmount.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right font-bold text-[#667085]">₹0</td>
                          <td className="p-3 text-right font-black text-[#B7791F]">₹{row.pendingAmount.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-center">
                            {isDone ? (
                              <Badge variant="success" dot>Follow-up Done ✓</Badge>
                            ) : (
                              <Badge variant="pending" dot>UNPAID</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedRecordPaymentTarget(row)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#BFD8D0] bg-[#EEF6F3] text-[#285F52] hover:bg-[#285F52] hover:text-white transition-colors cursor-pointer shrink-0"
                                title="Record Payment for this member"
                              >
                                Record Payment
                              </button>

                              <button
                                onClick={() => handleSendWhatsAppReminder(row)}
                                className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#285F52] hover:bg-[#EEF6F3] transition-colors cursor-pointer shrink-0"
                                title="Send WhatsApp Reminder"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleMarkDone(row)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer shrink-0 ${
                                  isDone
                                    ? 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]'
                                    : 'bg-white text-[#667085] border-[#E5E7EB] hover:text-[#111111]'
                                }`}
                                title="Mark follow-up completed without altering payment balance"
                              >
                                {isDone ? 'Done ✓' : 'Done'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ─── SECTION 2: PARTIALLY PAID MEMBERS (0 < Paid < Required) ───────────────── */}
          <Card className="border border-[#E5E7EB] bg-white rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 bg-[#FFF8E7] border-b border-[#FDE68A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-[#B7791F] text-white rounded-lg">
                  PARTIALLY PAID
                </span>
                <h2 className="text-sm font-black text-[#111111]">SECTION 2 — PARTIALLY PAID MEMBERS</h2>
                <span className="text-xs text-[#667085]">({partialPaymentRows.length} Subscriptions • Paid partial amount)</span>
              </div>
            </div>

            {partialPaymentRows.length === 0 ? (
              <div className="p-8 text-center text-[#667085] text-xs font-bold">
                ✓ No partial payment records for {selectedMonth}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#F7F8F7] border-b border-[#E5E7EB] text-[10px] font-black uppercase tracking-wider text-[#667085]">
                    <tr>
                      <th className="p-3 w-10 text-center">Select</th>
                      <th className="p-3">Member Name</th>
                      <th className="p-3">Chit / Group</th>
                      <th className="p-3 text-right">Due ₹</th>
                      <th className="p-3 text-right">Paid ₹</th>
                      <th className="p-3 text-right">Remaining ₹</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {partialPaymentRows.map((row) => {
                      const isChecked = selectedRowKeys.includes(row.rowKey);
                      const isDone = completedFollowUps.includes(row.rowKey);
                      return (
                        <tr key={row.rowKey} className={`hover:bg-[#F7F8F7] transition-colors ${isChecked ? 'bg-[#EEF6F3]' : ''}`}>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(row.rowKey)}
                              className="rounded border-slate-300 text-[#285F52] focus:ring-[#285F52] cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-[#111111]">
                            <div className="flex items-center gap-1.5">
                              <span>{row.memberName}</span>
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#FFF8E7] text-[#B7791F] border border-[#FDE68A] shrink-0">
                                PARTIAL
                              </span>
                            </div>
                            <div className="text-[10px] font-normal text-[#667085] font-mono">{row.phone}</div>
                          </td>
                          <td className="p-3 font-semibold text-[#667085]">{row.groupName}</td>
                          <td className="p-3 text-right font-bold text-[#111111]">₹{row.reqChitAmount.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right font-bold text-[#285F52]">₹{row.paidAmount.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right font-black text-[#B7791F]">₹{row.pendingAmount.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-center">
                            {isDone ? (
                              <Badge variant="success" dot>Follow-up Done ✓</Badge>
                            ) : (
                              <Badge variant="partial" dot>
                                PARTIALLY PAID (₹{row.pendingAmount.toLocaleString('en-IN')} Left)
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedRecordPaymentTarget(row)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#BFD8D0] bg-[#EEF6F3] text-[#285F52] hover:bg-[#285F52] hover:text-white transition-colors cursor-pointer shrink-0"
                                title="Record further partial or full payment"
                              >
                                Record Payment
                              </button>

                              <button
                                onClick={() => handleSendWhatsAppReminder(row)}
                                className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#285F52] hover:bg-[#EEF6F3] transition-colors cursor-pointer shrink-0"
                                title="Send WhatsApp Reminder for current remaining balance"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleMarkDone(row)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer shrink-0 ${
                                  isDone
                                    ? 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]'
                                    : 'bg-white text-[#667085] border-[#E5E7EB] hover:text-[#111111]'
                                }`}
                                title="Mark follow-up completed without altering payment balance"
                              >
                                {isDone ? 'Done ✓' : 'Done'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* RECORD PAYMENT MODAL FOR SINGLE ROW TARGET */}
      {selectedRecordPaymentTarget && (
        <RecordPaymentModal
          isOpen={Boolean(selectedRecordPaymentTarget)}
          onClose={() => setSelectedRecordPaymentTarget(null)}
          onRecord={(newTxn, meta = {}) => {
            if (meta.isFullyPaid) {
              showToast(`✓ Payment completed successfully for ${newTxn.member || 'Member'}! Automatically removed from Pending Payments.`, 'success');
            } else {
              showToast(`✓ Payment of ₹${newTxn.amount.toLocaleString('en-IN')} recorded for ${newTxn.member || 'Member'}.`, 'success');
            }
            setSelectedRecordPaymentTarget(null);
            loadData();
          }}
          members={members}
          groupPaymentSettings={groupPaymentSettings}
          initialMemberId={selectedRecordPaymentTarget.memberId}
          initialGroupId={selectedRecordPaymentTarget.groupId}
          payments={payments}
        />
      )}

      {/* CONFIRMATION MODAL FOR APPLY ALL */}
      <Modal
        isOpen={isApplyAllModalOpen}
        onClose={() => setIsApplyAllModalOpen(false)}
        title="Confirm Apply All Changes"
        subtitle="This action will save payment records for all loaded members."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 font-sans">
          <p className="text-xs text-[#111111] leading-relaxed">
            Apply changes to all <strong>{fullPendingRows.length + partialPaymentRows.length} subscriptions</strong> in{' '}
            <strong>{selectedGroupId === 'all' ? 'All Groups' : `Group ${selectedGroupId}`}</strong> for{' '}
            <strong>{selectedMonth}</strong>?
          </p>

          <div className="p-3 bg-[#FFF8E7] border border-[#FDE68A] rounded-xl text-xs text-[#B7791F]">
            <strong>Note:</strong> Previous monthly historical records will remain safe and unchanged.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button variant="secondary" size="sm" onClick={() => setIsApplyAllModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="bg-[#285F52] hover:bg-[#214D43] text-white" onClick={handleConfirmApplyAll}>
              Confirm Apply All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
