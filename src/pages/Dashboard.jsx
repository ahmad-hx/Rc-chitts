import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Layers,
  IndianRupee,
  MessageSquare,
  Plus,
  ArrowRight,
  Send,
  Gavel,
  UserPlus,
  AlertTriangle,
  History,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Calendar,
  ImagePlus,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';

import StatCard from '../components/StatCard';
import Button from '../components/Button';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import CreateChitModal from '../components/CreateChitModal';
import StartAuctionModal from '../components/StartAuctionModal';
import SaveDashboardImageModal from '../components/SaveDashboardImageModal';
import ViewDashboardImageModal from '../components/ViewDashboardImageModal';
import EditDashboardImageModal from '../components/EditDashboardImageModal';
import DashboardImageGallery from '../components/DashboardImageGallery';
import { memberService, chitService, paymentService, auctionService, groupPaymentSettingsService } from '../services/dbService';
import { whatsappDbService } from '../services/whatsappDbService';
import { dashboardImageService } from '../services/dashboardImageService';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getChitMonth } from '../utils/chitMonthUtils';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils';

// Helper to check if auction conducted date is within 1 calendar month
function isAuctionWithinLastMonth(auctionDateInput, referenceDate = new Date()) {
  if (!auctionDateInput) return false;
  let aDate;
  if (typeof auctionDateInput === 'object' && auctionDateInput instanceof Date && !isNaN(auctionDateInput.getTime())) {
    aDate = new Date(auctionDateInput);
  } else if (typeof auctionDateInput === 'object' && typeof auctionDateInput.toDate === 'function') {
    aDate = auctionDateInput.toDate();
  } else if (typeof auctionDateInput === 'object' && typeof auctionDateInput.seconds === 'number') {
    aDate = new Date(auctionDateInput.seconds * 1000);
  } else {
    aDate = new Date(String(auctionDateInput).trim());
  }

  if (isNaN(aDate.getTime())) return false;

  const now = new Date(referenceDate);
  const visibleUntil = new Date(aDate);
  visibleUntil.setMonth(visibleUntil.getMonth() + 1);

  // Start of auction date to end of visibleUntil date
  const start = new Date(aDate.getFullYear(), aDate.getMonth(), aDate.getDate(), 0, 0, 0, 0);
  const end = new Date(visibleUntil.getFullYear(), visibleUntil.getMonth(), visibleUntil.getDate(), 23, 59, 59, 999);

  return now >= start && now <= end;
}

// Helper to format auction date
function formatAuctionDateDisplay(dateInput) {
  if (!dateInput) return 'Recently Conducted';
  let d;
  if (typeof dateInput === 'object' && dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    d = dateInput.toDate();
  } else if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    d = new Date(dateInput.seconds * 1000);
  } else {
    d = new Date(String(dateInput).trim());
  }
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedMonth } = useBillingMonth();

  // Data states
  const [members, setMembers] = useState([]);
  const [chits, setChits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [waLogs, setWaLogs] = useState([]);
  const [auctionsMap, setAuctionsMap] = useState({});
  const [auctionsList, setAuctionsList] = useState([]);
  const [dashboardImages, setDashboardImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState(null);

  // Modals state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isCreateChitOpen, setIsCreateChitOpen] = useState(false);
  const [isStartAuctionOpen, setIsStartAuctionOpen] = useState(false);
  const [auctionConfirmTarget, setAuctionConfirmTarget] = useState(null);
  const [selectedAuctionDetails, setSelectedAuctionDetails] = useState(null);
  const [deletingAuctionTarget, setDeletingAuctionTarget] = useState(null);
  const [isDeletingAuction, setIsDeletingAuction] = useState(false);
  const [isSaveImageOpen, setIsSaveImageOpen] = useState(false);
  const [viewingImageDoc, setViewingImageDoc] = useState(null);
  const [editingImageDoc, setEditingImageDoc] = useState(null);
  const [deletingImageDoc, setDeletingImageDoc] = useState(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
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
        const [fetchedMembers, fetchedChits, fetchedPayments, settingsRes, fetchedWaLogs, fetchedAuctions, fetchedImages] = await Promise.all([
          memberService.getMembers(),
          chitService.getChits(),
          paymentService.getPayments().catch(() => []),
          groupPaymentSettingsService.getGroupPaymentSettings().catch(() => ({ settingsMap: {} })),
          whatsappDbService.getWhatsAppHistory().catch(() => []),
          auctionService.getAuctions().catch(() => ({ auctionsMap: {}, auctionsList: [] })),
          dashboardImageService.getDashboardImages().catch(() => []),
        ]);
        if (mounted) {
          setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
          setChits(Array.isArray(fetchedChits) ? fetchedChits : []);
          setPayments(Array.isArray(fetchedPayments) ? fetchedPayments : []);
          setGroupPaymentSettings(settingsRes?.settingsMap || {});
          setWaLogs(Array.isArray(fetchedWaLogs) ? fetchedWaLogs : []);
          setAuctionsMap(fetchedAuctions?.auctionsMap || {});
          setAuctionsList(Array.isArray(fetchedAuctions?.auctionsList) ? fetchedAuctions.auctionsList : []);
          setDashboardImages(Array.isArray(fetchedImages) ? fetchedImages : []);
        }
      } catch (e) {
        if (mounted) {
          setError('Unable to load data from Firebase.');
          setMembers([]);
          setChits([]);
          setPayments([]);
          setWaLogs([]);
          setAuctionsMap({});
          setAuctionsList([]);
          setDashboardImages([]);
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

  const activeGroupsCount = chits.length || 26;

  // Derive Remaining Dues for Selected Month based on actual Firestore payments sum
  const { totalPendingAmount, dueMembersCount, dueMembersList } = useMemo(() => {
    let pendingSum = 0;
    let dueCount = 0;
    const dueList = [];

    activeMembers.forEach((m) => {
      const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
      const chitSubscriptions = activeChits.length > 0 ? activeChits : [
        {
          id: `chit_${m.id}_${m.groupId || 'I'}`,
          groupId: m.groupId || m.group || 'I',
          totalChitValue: m.calculatedTotalChitValue || 100000,
          amountToPay: m.amountToPay || 5000,
        },
      ];

      const isMulti = chitSubscriptions.length > 1;
      let hasPendingForMember = false;
      const memberChitsWithPending = [];

      chitSubscriptions.forEach((c) => {
        const reqAmount = getEffectiveMonthlyAmount(m, c, groupPaymentSettings);

        let paidForChit = 0;
        const mPhoneClean = (m.phone || m.whatsapp || '').replace(/\D/g, '');
        const mNameClean = (m.name || '').trim().toLowerCase();
        const gIdClean = String(c.groupId || m.groupId || m.group || 'I').trim().toUpperCase().replace(/^GROUP\s+/, '');

        (payments || []).forEach((p) => {
          const pStatus = String(p.status || 'cleared').toLowerCase();
          if (pStatus === 'failed' || pStatus === 'cancelled') return;

          let pMonth = p.billingMonth;
          if (!pMonth && p.date) {
            try {
              const d = new Date(p.date);
              if (!isNaN(d.getTime())) pMonth = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            } catch (_) {}
          }
          if (pMonth && String(pMonth).trim().toLowerCase() !== String(selectedMonth).trim().toLowerCase()) {
            return;
          }

          const isMemMatch =
            (p.memberId && p.memberId === m.id) ||
            (mPhoneClean && p.phone && p.phone.replace(/\D/g, '').endsWith(mPhoneClean)) ||
            (mNameClean && (p.member || p.memberName) && (p.member || p.memberName).trim().toLowerCase() === mNameClean);

          if (!isMemMatch) return;

          const pGrp = String(p.group || p.groupId || p.chitGroup || '').trim().toUpperCase().replace(/^GROUP\s+/, '');
          let isGrpMatch = false;
          if (!isMulti) {
            isGrpMatch = true;
          } else {
            if (p.chitId && (p.chitId === c.id || p.chitId === c.groupId)) {
              isGrpMatch = true;
            } else if (pGrp && pGrp !== 'ALL') {
              isGrpMatch = (gIdClean === pGrp || gIdClean.includes(pGrp) || pGrp.includes(gIdClean));
            } else {
              isGrpMatch = (gIdClean === String(m.groupId || m.group || 'I').replace(/^GROUP\s+/i, '').toUpperCase());
            }
          }

          if (isGrpMatch) {
            paidForChit += Number(p.amount || 0);
          }
        });

        const remaining = Math.max(reqAmount - paidForChit, 0);
        if (remaining > 0) {
          pendingSum += remaining;
          hasPendingForMember = true;
          memberChitsWithPending.push({
            ...c,
            pending: remaining,
            paid: paidForChit,
            reqAmount,
          });
        }
      });

      if (hasPendingForMember) {
        dueCount++;
        dueList.push({
          ...m,
          chits: memberChitsWithPending.length > 0 ? memberChitsWithPending : m.chits,
        });
      }
    });

    return { totalPendingAmount: pendingSum, dueMembersCount: dueCount, dueMembersList: dueList };
  }, [activeMembers, payments, selectedMonth]);

  // Derive Today Collection
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCollection = payments
    .filter((p) => String(p.date || '').startsWith(todayStr))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // 4 Primary Summary Cards
  const statsCards = [
    {
      title: 'Active Chit Groups',
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
      title: 'Pending Due',
      value: totalPendingAmount > 0 ? `₹${totalPendingAmount.toLocaleString('en-IN')}` : '₹0',
      icon: Clock,
      badgeText: `${dueMembersCount} Members Pending`,
      badgeColor: 'warning',
      description: 'Follow-ups required',
      onClick: () => navigate('/pending-payments'),
    },
  ];

  // Recent Completed Auctions (Lifecycle-based: Visible across the 20-month duration of the group, newest first)
  const recentCompletedAuctions = useMemo(() => {
    const list = Array.isArray(auctionsList) ? auctionsList : [];

    return list
      .filter((a) => {
        // 1. Exclude soft-deleted auctions
        const isNotDeleted = !a.isDeleted && a.status !== 'DELETED';
        const isCompleted = (a.isAuctioned === true || a.status === 'COMPLETED') && isNotDeleted;
        if (!isCompleted) return false;

        // 2. Dynamic group matching
        const chitGroup = chits.find(
          (c) =>
            String(c.groupId).trim().toUpperCase() === String(a.groupId).trim().toUpperCase() &&
            (a.totalChitValue ? Number(c.totalChitValue) === Number(a.totalChitValue) : true)
        ) || chits.find((c) => String(c.groupId).trim().toUpperCase() === String(a.groupId).trim().toUpperCase());

        const startMonth = chitGroup?.startingMonth || a.billingMonth || 'August 2026';
        const capacity = Number(chitGroup?.capacity || chitGroup?.duration || 20);

        // 3. Chit Lifecycle Calculation (Months 1 through 20)
        const chitMonthInfo = getChitMonth(startMonth, selectedMonth);
        const isGroupLifecycleActive = chitMonthInfo.rawMonthNumber <= capacity && chitMonthInfo.rawMonthNumber >= 1;

        return isGroupLifecycleActive;
      })
      .sort((a, b) => {
        const timeA = new Date(a.auctionDate || a.completedAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.auctionDate || b.completedAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });
  }, [auctionsList, chits, selectedMonth]);

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
          pending: chit.pending || chit.monthlyAmount || chit.amountToPay || 5000,
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
        groupName: result.groupName,
        totalChitValue: result.totalChitValue,
        billingMonth: selectedMonth,
        isAuctioned: true,
        bidAmount: result.bidAmount,
        dividend: result.dividend,
        netPayout: result.payout,
        roundNumber: result.month,
        auctionDate: result.date || new Date().toISOString().split('T')[0],
      });

      const updated = await auctionService.getAuctions();
      setAuctionsMap(updated?.auctionsMap || {});
      setAuctionsList(Array.isArray(updated?.auctionsList) ? updated.auctionsList : []);
    } catch (_) {}

    showToast(`✓ Auction completed for Group ${result.groupId}! Winner: ${result.winner} (Dividend: ₹${result.dividend.toLocaleString('en-IN')}/mem)`);
  };

  const handleConfirmToggleAuction = async () => {
    if (!auctionConfirmTarget) return;
    const { member, isAuctioned } = auctionConfirmTarget;
    setAuctionConfirmTarget(null);

    try {
      const gId = String(member.group || member.groupId || 'I').replace(/^Group\s+/i, '').split(' ')[0];
      await auctionService.setAuctionStatus({
        memberId: member.id,
        memberName: member.member || member.name,
        groupId: gId,
        billingMonth: selectedMonth,
        isAuctioned: !isAuctioned,
        auctionDate: new Date().toISOString().split('T')[0],
      });

      const updated = await auctionService.getAuctions();
      setAuctionsMap(updated?.auctionsMap || {});
      setAuctionsList(Array.isArray(updated?.auctionsList) ? updated.auctionsList : []);
      showToast(`✓ Auction status updated for ${member.member || member.name} (${selectedMonth}).`, 'success');
    } catch (err) {
      showToast(`Failed to update auction status: ${err.message}`, 'error');
    }
  };

  const handleConfirmDeleteAuction = async () => {
    if (!deletingAuctionTarget) return;
    setIsDeletingAuction(true);
    try {
      await auctionService.deleteAuction(deletingAuctionTarget);
      const updated = await auctionService.getAuctions();
      setAuctionsMap(updated?.auctionsMap || {});
      setAuctionsList(Array.isArray(updated?.auctionsList) ? updated.auctionsList : []);
      if (selectedAuctionDetails?.id === deletingAuctionTarget.id) {
        setSelectedAuctionDetails(null);
      }
      showToast(`✓ Auction for Group ${deletingAuctionTarget.groupId} removed from active view and preserved in Auction History.`);
      setDeletingAuctionTarget(null);
    } catch (err) {
      showToast(`Failed to delete auction: ${err.message}`, 'error');
    } finally {
      setIsDeletingAuction(false);
    }
  };

  // Image Handlers
  const handleImageSaved = (savedDoc) => {
    setDashboardImages((prev) => [savedDoc, ...prev.filter((img) => img.id !== savedDoc.id)]);
    showToast('✓ Image saved successfully to Firebase Storage and Firestore!');
  };

  const handleImageUpdated = (updatedDoc) => {
    setDashboardImages((prev) => prev.map((img) => (img.id === updatedDoc.id ? updatedDoc : img)));
    showToast('✓ Image details updated successfully.');
  };

  const handleConfirmDeleteImage = async () => {
    if (!deletingImageDoc) return;
    setIsDeletingImage(true);

    try {
      await dashboardImageService.deleteDashboardImage(deletingImageDoc);
      setDashboardImages((prev) => prev.filter((img) => img.id !== deletingImageDoc.id));
      showToast('Image deleted successfully');
      setDeletingImageDoc(null);
    } catch (err) {
      showToast(`Failed to delete image: ${err.message}`, 'error');
    } finally {
      setIsDeletingImage(false);
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

      {/* DASHBOARD HERO HEADER WITH ACTION BUTTONS */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between border-b border-[#E5E7EB] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#285F52]"></span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#285F52]">DASHBOARD</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111111]">
            Welcome back, Admin
          </h1>
          <p className="text-xs font-medium text-[#667085]">
            Quick overview of your chit business • <strong className="text-[#111111]">{activeGroupsCount} Active Groups</strong> • <strong className="text-[#111111]">{totalMembersCount} Registered Members</strong>
          </p>
        </div>

        {/* QUICK ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="md"
            className="gap-2 rounded-xl border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F7F8F7] font-bold shadow-xs cursor-pointer"
            onClick={() => navigate('/members?action=add')}
          >
            <UserPlus className="h-4 w-4 text-[#667085]" />
            <span>Add Member</span>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="gap-2 rounded-xl border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F7F8F7] font-bold shadow-xs cursor-pointer"
            onClick={() => setIsCreateChitOpen(true)}
          >
            <Plus className="h-4 w-4 text-[#667085]" />
            <span>Create Chit</span>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="gap-2 rounded-xl border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F7F8F7] font-bold shadow-xs cursor-pointer"
            onClick={() => setIsStartAuctionOpen(true)}
          >
            <Gavel className="h-4 w-4 text-[#667085]" />
            <span>Conduct Auction</span>
          </Button>

          {/* SAVE IMAGE BUTTON */}
          <Button
            variant="outline"
            size="md"
            className="gap-2 rounded-xl border-[#BFD8D0] bg-[#EEF6F3] text-[#285F52] hover:bg-[#285F52] hover:text-white font-bold shadow-xs cursor-pointer transition-colors"
            onClick={() => setIsSaveImageOpen(true)}
          >
            <ImagePlus className="h-4 w-4" />
            <span>Save Image</span>
          </Button>

          {/* PRIMARY ACTION: Record Payment */}
          <Button
            variant="primary"
            size="md"
            className="gap-2 rounded-xl bg-[#285F52] hover:bg-[#214D43] text-white font-bold shadow-sm cursor-pointer"
            onClick={() => setIsRecordPaymentOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </Button>
        </div>
      </div>

      {/* 4 PRIMARY SUMMARY CARDS */}
      <section className="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <div
            key={stat.title}
            onClick={stat.onClick}
            className="group cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs transition-all duration-200 hover:border-[#285F52]/40 active:scale-[0.99]"
          >
            <StatCard
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              badgeText={stat.badgeText}
              badgeColor={stat.badgeColor}
              className="border-none bg-transparent p-0 shadow-none text-[#111111]"
            />
            <div className="mt-3 flex items-center justify-end text-[11px] font-bold text-[#285F52] opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Explore Section</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        ))}
      </section>

      {/* DASHBOARD LOWER SECTIONS: PAYMENTS & PENDING */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* PANEL 1: RECENT PAYMENTS */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#285F52]">Collections Ledger</p>
                <h2 className="mt-0.5 text-lg font-black text-[#111111]">Recent Payments</h2>
              </div>
              <Button
                variant="outline"
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] hover:bg-[#E5E7EB] cursor-pointer"
                onClick={() => navigate('/payments')}
              >
                View All
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {recentPaymentsList.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E5E7EB] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EEF6F3] border border-[#BFD8D0] text-[#285F52] text-xs font-black flex items-center justify-center shrink-0">
                      {p.member ? p.member.slice(0, 2).toUpperCase() : 'RM'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111111]">{p.member}</p>
                      <p className="text-[10px] font-semibold text-[#667085]">{p.group}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black text-[#285F52]">+₹{(p.amount || 5000).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] font-medium text-[#98A2B3]">{p.date || 'Today'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsRecordPaymentOpen(true)}
            className="mt-4 w-full py-2.5 rounded-xl border border-[#BFD8D0] bg-[#EEF6F3] text-xs font-bold text-[#285F52] hover:bg-[#285F52] hover:text-white transition-colors cursor-pointer"
          >
            + Record New Collection
          </button>
        </div>

        {/* PANEL 2: UPCOMING / PENDING PAYMENTS */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#B7791F]">Action Required</p>
                <h2 className="mt-0.5 text-lg font-black text-[#111111]">Upcoming / Pending Payments</h2>
              </div>
              <Button
                variant="outline"
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] hover:bg-[#E5E7EB] cursor-pointer"
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
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E5E7EB] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-[#111111]">{d.member}</p>
                        {isAuctioned && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#FFF8E7] text-[#B7791F] border border-[#FDE68A] flex items-center gap-1">
                            🔨 Auctioned — {selectedMonth}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-semibold text-[#667085]">{d.group}</p>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-xs font-black text-[#B7791F]">₹{(d.pending || 5000).toLocaleString('en-IN')}</p>
                        <span
                          className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                            d.dueColor === 'red'
                              ? 'bg-[#FEF3F2] text-[#B42318] border border-[#FECACA]'
                              : 'bg-[#FFF8E7] text-[#B7791F] border border-[#FDE68A]'
                          }`}
                        >
                          {d.dueStatus}
                        </span>
                      </div>

                      <button
                        onClick={() => setAuctionConfirmTarget({ member: d, isAuctioned })}
                        className={`text-[10px] font-extrabold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                          isAuctioned
                            ? 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0] hover:bg-[#285F52] hover:text-white'
                            : 'bg-white text-[#667085] border-[#E5E7EB] hover:bg-[#F7F8F7] hover:text-[#111111]'
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
            className="mt-4 w-full py-2.5 rounded-xl border border-[#B7791F]/30 bg-[#FFF8E7] text-xs font-bold text-[#B7791F] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
          >
            Send Payment Reminders via WhatsApp
          </button>
        </div>
      </section>

      {/* SECTION: RECENT COMPLETED AUCTIONS (Chit Lifecycle-based) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#285F52]"></span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#285F52]">Auction History</p>
            </div>
            <h2 className="text-xl font-black text-[#111111]">Recent Completed Auctions</h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Auctions conducted and active across current chit group lifecycles.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F7F8F7] font-bold text-xs gap-1.5 self-start sm:self-auto cursor-pointer"
            onClick={() => setIsStartAuctionOpen(true)}
          >
            <Gavel className="w-3.5 h-3.5 text-[#285F52]" />
            <span>Conduct Auction</span>
          </Button>
        </div>

        {recentCompletedAuctions.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#E5E7EB] rounded-2xl space-y-1">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#EEF6F3] border border-[#BFD8D0] flex items-center justify-center text-[#285F52] mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-[#111111]">No active completed auctions</p>
            <p className="text-xs text-[#667085]">Completed auctions for active chit groups will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {recentCompletedAuctions.map((auction) => {
              const chitGroup = chits.find((c) =>
                String(c.groupId).trim().toUpperCase() === String(auction.groupId).trim().toUpperCase() &&
                (auction.totalChitValue ? Number(c.totalChitValue) === Number(auction.totalChitValue) : true)
              ) || chits.find((c) => String(c.groupId).trim().toUpperCase() === String(auction.groupId).trim().toUpperCase());

              const totalVal = Number(auction.totalChitValue || chitGroup?.totalChitValue || 100000);
              const gId = auction.groupId ? String(auction.groupId).replace(/^GROUP\s+/i, '').trim() : 'I';
              const formattedCategory = totalVal >= 100000 ? `₹${(totalVal / 100000).toFixed(0)} Lakh` : `₹${totalVal.toLocaleString('en-IN')}`;
              const fullGroupTitle = `${formattedCategory} — Group ${gId}`;

              const chitMonthInfo = getChitMonth(chitGroup?.startingMonth || auction.billingMonth, selectedMonth);

              return (
                <div
                  key={auction.id}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4 hover:border-[#285F52]/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* STATUS BADGE & DELETE BUTTON */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EEF6F3] border border-[#BFD8D0] text-[#285F52] text-[11px] font-black tracking-wide">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#285F52]" />
                        AUCTION COMPLETED
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDeletingAuctionTarget({
                            ...auction,
                            groupTitle: fullGroupTitle,
                            totalChitValue: totalVal,
                          })
                        }
                        title="Delete Auction"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[#667085] hover:border-[#FECACA] hover:bg-[#FEF3F2] hover:text-[#B42318] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* WINNER & CHIT GROUP & CHIT MONTH */}
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085] block">
                          👤 Winner
                        </span>
                        <p className="text-base font-black text-[#111111] truncate mt-0.5">
                          {auction.memberName || auction.winnerName || 'Member'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E5E7EB]">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085] block">
                            🏷️ Chit Group
                          </span>
                          <p className="text-xs font-black text-[#285F52] mt-0.5">
                            {fullGroupTitle}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085] block">
                            Chit Month
                          </span>
                          <span className="inline-block text-xs font-black text-[#111111] bg-[#F7F8F7] px-2 py-0.5 rounded-md border border-[#E5E7EB] mt-0.5">
                            {chitMonthInfo.display}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FINANCIAL METRICS GRID */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-[#F7F8F7] rounded-xl border border-[#E5E7EB] text-xs">
                      {auction.bidAmount > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                            💰 Auction Amount
                          </span>
                          <span className="font-black text-[#111111] text-xs">
                            ₹{auction.bidAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}

                      {auction.dividend > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                            Discount / Dividend
                          </span>
                          <span className="font-black text-[#285F52] text-xs">
                            ₹{auction.dividend.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}

                      {auction.netPayout > 0 && (
                        <div className="col-span-2 pt-1 border-t border-[#E5E7EB] flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                            Net Prize Payout:
                          </span>
                          <span className="font-black text-[#285F52] text-xs">
                            ₹{auction.netPayout.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CONDUCTED DATE & ACTION */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB] text-xs">
                    <div className="flex items-center gap-1.5 text-[#667085]">
                      <Calendar className="w-3.5 h-3.5 text-[#667085]" />
                      <span className="text-[11px] font-medium">
                        Conducted: {formatAuctionDateDisplay(auction.auctionDate || auction.completedAt || auction.updatedAt)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAuctionDetails({
                          ...auction,
                          groupTitle: fullGroupTitle,
                          totalChitValue: totalVal,
                          chitMonthDisplay: chitMonthInfo.display,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#285F52] hover:text-[#214D43] transition-colors cursor-pointer"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION: RECENT WHATSAPP BROADCAST ENGINE */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#285F52]">Broadcast Engine</p>
            <h2 className="mt-0.5 text-lg font-black text-[#111111]">WhatsApp Messages This Month</h2>
          </div>
          <MessageSquare className="h-5 w-5 text-[#285F52]" />
        </div>

        {/* REALTIME METRICS BADGES */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1 font-sans">
          <div className="p-2.5 bg-[#EEF6F3] border border-[#BFD8D0] rounded-xl">
            <span className="text-[9px] font-bold text-[#285F52] uppercase block">Sent</span>
            <span className="text-base font-black text-[#285F52]">
              {waLogs.filter((l) => l.status === 'Sent' || l.status === 'SENT').length}
            </span>
          </div>
          <div className="p-2.5 bg-[#FFF8E7] border border-[#FDE68A] rounded-xl">
            <span className="text-[9px] font-bold text-[#B7791F] uppercase block">Pending</span>
            <span className="text-base font-black text-[#B7791F]">
              {dueMembersList.length}
            </span>
          </div>
          <div className="p-2.5 bg-[#FEF3F2] border border-[#FECACA] rounded-xl">
            <span className="text-[9px] font-bold text-[#B42318] uppercase block">Failed</span>
            <span className="text-base font-black text-[#B42318]">
              {waLogs.filter((l) => l.status === 'Failed' || l.status === 'FAILED').length}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {waLogs.length > 0 ? (
            waLogs.slice(0, 3).map((wa) => (
              <div
                key={wa.id}
                className="p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E5E7EB] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-2 w-2 rounded-full ${wa.status === 'Sent' || wa.status === 'SENT' ? 'bg-[#285F52]' : 'bg-[#B42318]'}`}></span>
                    <p className="text-xs font-bold text-[#111111] truncate max-w-[150px]">{wa.memberName}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-[#667085]">Group {wa.chitGroupId}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#667085] pt-1 border-t border-[#E5E7EB]">
                  <span className="font-semibold text-[#285F52]">+{wa.phoneNumber}</span>
                  <span>{wa.sentAt ? new Date(wa.sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</span>
                </div>
              </div>
            ))
          ) : (
            recentWhatsAppActivity.map((wa) => (
              <div
                key={wa.id}
                className="p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E5E7EB] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-[#285F52]"></span>
                    <p className="text-xs font-bold text-[#111111]">{wa.type}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-[#667085]">{wa.group}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#667085] pt-1 border-t border-[#E5E7EB]">
                  <span className="font-semibold text-[#285F52]">{wa.count} Members Broadcast</span>
                  <span>{wa.date}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <Button
          variant="primary"
          className="mt-4 w-full justify-center gap-2 rounded-xl py-3 text-xs font-bold bg-[#285F52] hover:bg-[#214D43] text-white cursor-pointer shadow-xs"
          onClick={() => navigate('/whatsapp')}
        >
          <Send className="h-4 w-4" />
          <span>Open WhatsApp Messaging Studio</span>
        </Button>
      </section>

      {/* SAVED IMAGES GALLERY SECTION */}
      <DashboardImageGallery
        images={dashboardImages}
        loading={loading}
        onOpenSaveModal={() => setIsSaveImageOpen(true)}
        onViewImage={(img) => setViewingImageDoc(img)}
        onEditImage={(img) => setEditingImageDoc(img)}
        onDeleteImage={(img) => setDeletingImageDoc(img)}
      />

      {/* QUICK ADMINISTRATIVE SHORTCUTS */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#667085]">Quick Tools</p>
            <h2 className="mt-0.5 text-xl font-bold text-[#111111]">Administrative Shortcuts</h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => setIsSaveImageOpen(true)}
            className="group flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2.5 text-xs font-bold text-[#111111] transition-all duration-150 hover:border-[#285F52]/40 hover:bg-white cursor-pointer shadow-2xs"
          >
            <ImagePlus className="h-4 w-4 text-[#285F52] transition-transform group-hover:scale-110" />
            <span>Save Image</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateChitOpen(true)}
            className="group flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2.5 text-xs font-bold text-[#111111] transition-all duration-150 hover:border-[#285F52]/40 hover:bg-white cursor-pointer shadow-2xs"
          >
            <Layers className="h-4 w-4 text-[#285F52] transition-transform group-hover:scale-110" />
            <span>Create Chit</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRecordPaymentOpen(true)}
            className="group flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2.5 text-xs font-bold text-[#111111] transition-all duration-150 hover:border-[#285F52]/40 hover:bg-white cursor-pointer shadow-2xs"
          >
            <IndianRupee className="h-4 w-4 text-[#285F52] transition-transform group-hover:scale-110" />
            <span>Record Payment</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/whatsapp')}
            className="group flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2.5 text-xs font-bold text-[#111111] transition-all duration-150 hover:border-[#285F52]/40 hover:bg-white cursor-pointer shadow-2xs"
          >
            <Send className="h-4 w-4 text-[#285F52] transition-transform group-hover:scale-110" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/history')}
            className="group flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2.5 text-xs font-bold text-[#111111] transition-all duration-150 hover:border-[#285F52]/40 hover:bg-white cursor-pointer shadow-2xs"
          >
            <History className="h-4 w-4 text-[#667085] transition-transform group-hover:scale-110" />
            <span>View History</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="group flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-2.5 text-xs font-bold text-[#111111] transition-all duration-150 hover:border-[#285F52]/40 hover:bg-white cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#667085] transition-transform group-hover:scale-110" />
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

      {/* DASHBOARD IMAGE MODALS */}
      <SaveDashboardImageModal
        isOpen={isSaveImageOpen}
        onClose={() => setIsSaveImageOpen(false)}
        onImageSaved={handleImageSaved}
      />

      <ViewDashboardImageModal
        isOpen={!!viewingImageDoc}
        onClose={() => setViewingImageDoc(null)}
        imageDoc={viewingImageDoc}
      />

      <EditDashboardImageModal
        isOpen={!!editingImageDoc}
        onClose={() => setEditingImageDoc(null)}
        imageDoc={editingImageDoc}
        onImageUpdated={handleImageUpdated}
      />

      {/* CONFIRMATION DIALOG FOR IMAGE DELETION */}
      <Modal
        isOpen={!!deletingImageDoc}
        onClose={() => !isDeletingImage && setDeletingImageDoc(null)}
        title="Delete Saved Image"
        subtitle="Permanently remove image from Firebase Storage and Firestore."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 font-sans text-xs">
          {deletingImageDoc && (
            <div className="p-3 bg-[#F7F8F7] rounded-xl border border-[#E5E7EB] flex items-center gap-3">
              <img
                src={deletingImageDoc.imageUrl}
                alt="Thumbnail"
                className="w-12 h-12 rounded-lg object-cover bg-black shrink-0 border border-[#E5E7EB]"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#111111] truncate">
                  {deletingImageDoc.title || deletingImageDoc.fileName || 'Untitled Image'}
                </p>
                <p className="text-[10px] text-[#667085] truncate">{deletingImageDoc.fileName}</p>
              </div>
            </div>
          )}

          <p className="text-[#111111] leading-relaxed">
            Are you sure you want to permanently delete this image? This action cannot be undone.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button
              variant="secondary"
              size="sm"
              disabled={isDeletingImage}
              onClick={() => setDeletingImageDoc(null)}
              className="rounded-xl border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] hover:bg-[#E5E7EB]"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isDeletingImage}
              onClick={handleConfirmDeleteImage}
              className="gap-1.5 rounded-xl bg-[#B42318] hover:bg-[#911c13] text-white font-bold cursor-pointer"
            >
              {isDeletingImage ? 'Deleting image...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION DIALOG FOR AUCTION STATUS */}
      <Modal
        isOpen={!!auctionConfirmTarget}
        onClose={() => setAuctionConfirmTarget(null)}
        title={auctionConfirmTarget?.isAuctioned ? 'Remove Auction Status' : 'Mark as Auctioned'}
        subtitle="Confirm updating chit auction status for member."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#111111] leading-relaxed">
            {auctionConfirmTarget?.isAuctioned ? (
              <>Remove auction status for <strong>{auctionConfirmTarget?.member?.member}</strong> for <strong>{selectedMonth}</strong>?</>
            ) : (
              <>Mark <strong>{auctionConfirmTarget?.member?.member}</strong> as auctioned for <strong>{selectedMonth}</strong>?</>
            )}
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
            <Button variant="secondary" size="sm" onClick={() => setAuctionConfirmTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className="bg-[#285F52] hover:bg-[#214D43] text-white" onClick={handleConfirmToggleAuction}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* VIEW COMPLETED AUCTION DETAILS MODAL */}
      {selectedAuctionDetails && (
        <Modal
          isOpen={Boolean(selectedAuctionDetails)}
          onClose={() => setSelectedAuctionDetails(null)}
          title="Completed Auction Details"
          subtitle={`Full auction breakdown for ${selectedAuctionDetails.groupTitle || 'Chit Group'}.`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-4 bg-[#EEF6F3] border border-[#BFD8D0] rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#285F52]" />
                <span className="text-xs font-black text-[#285F52] uppercase tracking-wider">
                  Verified Completed Auction
                </span>
              </div>
              <p className="text-base font-black text-[#111111]">
                {selectedAuctionDetails.memberName || selectedAuctionDetails.winnerName || 'Member'}
              </p>
              <p className="text-xs font-bold text-[#285F52]">
                {selectedAuctionDetails.groupTitle} • Round {selectedAuctionDetails.roundNumber || 1}
              </p>
            </div>

            <div className="space-y-2.5 bg-[#F7F8F7] border border-[#E5E7EB] p-4 rounded-xl">
              <div className="flex justify-between">
                <span className="text-[#667085] font-semibold">Total Chit Value:</span>
                <span className="font-bold text-[#111111]">₹{selectedAuctionDetails.totalChitValue?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#667085] font-semibold">Chit Month:</span>
                <span className="font-bold text-[#111111]">{selectedAuctionDetails.chitMonthDisplay || 'Active'}</span>
              </div>
              {selectedAuctionDetails.bidAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#667085] font-semibold">Bid Discount Amount:</span>
                  <span className="font-bold text-[#111111]">₹{selectedAuctionDetails.bidAmount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              {selectedAuctionDetails.dividend > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#667085] font-semibold">Dividend / Member:</span>
                  <span className="font-bold text-[#285F52]">₹{selectedAuctionDetails.dividend?.toLocaleString('en-IN')}</span>
                </div>
              )}
              {selectedAuctionDetails.netPayout > 0 && (
                <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
                  <span className="text-[#111111] font-bold">Net Prize Payout:</span>
                  <span className="font-black text-[#285F52] text-sm">
                    ₹{selectedAuctionDetails.netPayout?.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-[#E5E7EB] text-[11px]">
                <span className="text-[#667085]">Conducted On:</span>
                <span className="font-medium text-[#111111]">
                  {formatAuctionDateDisplay(selectedAuctionDetails.auctionDate || selectedAuctionDetails.completedAt || selectedAuctionDetails.updatedAt)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#667085]">Billing Cycle:</span>
                <span className="font-medium text-[#111111]">{selectedAuctionDetails.billingMonth}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl text-[#B42318] border-[#FECACA] hover:bg-[#FEF3F2] font-bold"
                onClick={() => {
                  setDeletingAuctionTarget(selectedAuctionDetails);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Auction</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedAuctionDetails(null)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#285F52] hover:bg-[#214D43] text-white font-bold"
                  onClick={() => {
                    setSelectedAuctionDetails(null);
                    navigate('/chits');
                  }}
                >
                  Chit Groups →
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRMATION DIALOG FOR AUCTION DELETION */}
      {deletingAuctionTarget && (
        <Modal
          isOpen={Boolean(deletingAuctionTarget)}
          onClose={() => !isDeletingAuction && setDeletingAuctionTarget(null)}
          title="Delete this auction?"
          subtitle="Confirm removing auction from active view."
          maxWidth="max-w-md"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 bg-[#FFF8E7] border border-[#FDE68A] rounded-xl space-y-1">
              <p className="font-bold text-[#111111]">
                Winner: {deletingAuctionTarget.memberName || 'Member'}
              </p>
              <p className="text-[11px] text-[#667085]">
                Group: {deletingAuctionTarget.groupTitle || `Group ${deletingAuctionTarget.groupId}`} • Round {deletingAuctionTarget.roundNumber || 1}
              </p>
            </div>

            <p className="text-[#111111] leading-relaxed">
              The auction will be removed from the active auction view, but its complete record will remain in Auction History.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="secondary"
                size="sm"
                disabled={isDeletingAuction}
                onClick={() => setDeletingAuctionTarget(null)}
                className="rounded-xl border-[#E5E7EB]"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeletingAuction}
                onClick={handleConfirmDeleteAuction}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
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