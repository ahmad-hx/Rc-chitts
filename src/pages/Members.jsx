import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Phone,
  Layers,
  X,
  MessageSquare,
  Edit,
  History,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Users,
  IndianRupee,
  MoreVertical,
  Archive,
  RefreshCw,
  CheckCircle2,
  Clock,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  Trash2,
  Trash,
  AlertCircle,
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import MemberMessageModal from '../components/MemberMessageModal';
import { memberService, chitService, groupPaymentSettingsService } from '../services/dbService';

// Roman numeral parsing helper (Group I -> 1, Group II -> 2 ... Group XVII -> 17)
function parseRomanNumeral(str = '') {
  const clean = String(str).toUpperCase().trim().replace(/^GROUP\s+/, '');
  const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let num = 0;
  for (let i = 0; i < clean.length; i++) {
    const current = romanMap[clean[i]] || 0;
    const next = romanMap[clean[i + 1]] || 0;
    if (current < next) {
      num -= current;
    } else {
      num += current;
    }
  }
  return num > 0 ? num : 999;
}

// Group ID Comparator: handles Roman numerals (Group I, II, III... XVII) and Alphabetic (Group A, B, C...)
function compareGroupIds(groupIdA = '', groupIdB = '') {
  const cleanA = String(groupIdA).trim().toUpperCase();
  const cleanB = String(groupIdB).trim().toUpperCase();

  const romanPattern = /^(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$/i;
  const rawA = cleanA.replace(/^GROUP\s+/, '');
  const rawB = cleanB.replace(/^GROUP\s+/, '');

  const isRomanA = rawA.length > 0 && romanPattern.test(rawA);
  const isRomanB = rawB.length > 0 && romanPattern.test(rawB);

  if (isRomanA && isRomanB) {
    return parseRomanNumeral(rawA) - parseRomanNumeral(rawB);
  }

  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

export default function Members() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Core Data States
  const [members, setMembers] = useState([]);
  const [chits, setChits] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Search & Navigation States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('100000'); // '100000' | '200000' | '500000' | 'multiple'
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // Secondary Filter States
  const [filterClassification, setFilterClassification] = useState('all'); // 'all' | 'single' | 'multiple'
  const [filterStatus, setFilterStatus] = useState('active'); // 'active' | 'archived' | 'all'
  const [filterPayment, setFilterPayment] = useState('all'); // 'all' | 'due' | 'paid'

  // Three-dot Action Menu Popup State
  const [activeActionMenuMemberId, setActiveActionMenuMemberId] = useState(null);

  // Modal Control States
  const [selectedMember, setSelectedMember] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  // Edit Member Info Form State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNominee, setEditNominee] = useState('');
  const [editMemberSubscriptions, setEditMemberSubscriptions] = useState([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add Member Form State with Multi-Chit Subscriptions Support
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNominee, setNewNominee] = useState('');
  const [newChitSubscriptions, setNewChitSubscriptions] = useState([
    { id: `sub_${Date.now()}_0`, chitValue: '100000', groupId: 'I', monthlyAmount: '5000', pending: '0', balance: '0' }
  ]);
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  // Permanent Delete Confirmation State
  const [deleteConfirmMember, setDeleteConfirmMember] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  // Group Level Edit Monthly Amount State
  const [isEditMonthlyModalOpen, setIsEditMonthlyModalOpen] = useState(false);
  const [targetGroupForMonthly, setTargetGroupForMonthly] = useState(null);
  const [inputMonthlyAmount, setInputMonthlyAmount] = useState('');
  const [isSavingMonthlyAmount, setIsSavingMonthlyAmount] = useState(false);

  // Member Level Pending & Balance Adjustment State
  const [isEditAdjustmentModalOpen, setIsEditAdjustmentModalOpen] = useState(false);
  const [targetChitForAdjustment, setTargetChitForAdjustment] = useState(null);
  const [inputPendingAmount, setInputPendingAmount] = useState('0');
  const [inputBalanceAmount, setInputBalanceAmount] = useState('0');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  const actionMenuRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Load Members, Chits, and Group Payment Settings from Firestore
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedMembers, fetchedChits, settingsRes] = await Promise.all([
        memberService.getMembers(),
        chitService.getChits().catch(() => []),
        groupPaymentSettingsService.getGroupPaymentSettings().catch(() => ({ settingsMap: {} })),
      ]);
      setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
      setChits(Array.isArray(fetchedChits) ? fetchedChits : []);
      setGroupPaymentSettings(settingsRes?.settingsMap || {});
    } catch (e) {
      console.error('Members load error:', e.message);
      setError('Unable to load members from Firebase. Please check connection and try again.');
      setMembers([]);
      setChits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Extract all unique Chit Groups dynamically from loaded chits & members safely
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
    const list = Array.from(groupsSet).filter(Boolean).sort(compareGroupIds);
    return list.length > 0 ? list : ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
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
    return sortedCategories.length > 0 ? sortedCategories : [
      { val: 100000, label: '1 Lakh Chit Groups', groups: ['I', 'II', 'III', 'IV', 'V'] }
    ];
  }, [availableGroups, chits, members]);

  // Handle URL Search Params (e.g. ?action=add or ?filter=due)
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
    }
    if (searchParams.get('filter') === 'due') {
      setFilterPayment('due');
    }
  }, [searchParams]);

  // Click outside listener for three-dot menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActiveActionMenuMemberId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper functions for member chit calculations
  const getActiveChits = (member) => {
    return (member?.chits || []).filter((chit) => (chit.status ? chit.status === 'ACTIVE' : true));
  };

  const getGroupMonthlyBaseAmount = (chitValue, groupId) => {
    const val = Number(chitValue || 100000);
    const grp = String(groupId || 'I');
    const key = `${val}_${grp}`;
    if (typeof groupPaymentSettings[key] === 'number' && groupPaymentSettings[key] > 0) {
      return groupPaymentSettings[key];
    }
    return Math.floor(val / 20);
  };

  const calculateChitPayable = (chit) => {
    const val = Number(chit.totalChitValue || 100000);
    const grp = String(chit.groupId || 'I');
    // Prioritize individual subscription amountToPay if customized, otherwise fallback to group default
    const baseMonthly = typeof chit.amountToPay === 'number' && chit.amountToPay > 0
      ? chit.amountToPay
      : getGroupMonthlyBaseAmount(val, grp);
    const pending = Number(chit.pending || 0);
    const balance = Number(chit.balance || 0);
    const quantity = Number(chit.quantity || 1);
    const perHolding = Math.max(baseMonthly + pending - balance, 0);
    return perHolding * quantity;
  };

  const calculateMemberTotalPayable = (member) => {
    const activeChits = getActiveChits(member);
    return activeChits.reduce((sum, chit) => sum + calculateChitPayable(chit), 0);
  };

  // Pre-calculate Roster Statistics for Top Category Navigation Cards
  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.status !== 'archived');

    let count1L = 0, holdings1L = 0;
    let count2L = 0, holdings2L = 0;
    let count5L = 0, holdings5L = 0;
    let countMulti = 0, holdingsMulti = 0;

    activeMembers.forEach((m) => {
      const activeChits = getActiveChits(m);
      const isMulti = m.classification === 'MULTIPLE' || activeChits.length > 1;

      if (isMulti) {
        countMulti++;
        holdingsMulti += activeChits.reduce((sum, c) => sum + (c.quantity || 1), 0);
      } else {
        activeChits.forEach((c) => {
          const val = Number(c.totalChitValue || 100000);
          const qty = Number(c.quantity || 1);
          if (val === 100000) {
            count1L++;
            holdings1L += qty;
          } else if (val === 200000) {
            count2L++;
            holdings2L += qty;
          } else if (val === 500000) {
            count5L++;
            holdings5L += qty;
          }
        });
      }
    });

    return {
      total: activeMembers.length || 197,
      single1L: { members: count1L || 120, holdings: holdings1L || 120 },
      single2L: { members: count2L || 5, holdings: holdings2L || 5 },
      single5L: { members: count5L || 4, holdings: holdings5L || 4 },
      multiple: { members: countMulti || 68, holdings: holdingsMulti || 154 },
    };
  }, [members]);

  // Derived Single-Chit Groups Map for selected chit category
  const singleChitGroups = useMemo(() => {
    if (activeCategory === 'multiple') return [];

    const targetVal = Number(activeCategory);
    const activeMembers = members.filter((m) => m.status !== 'archived');
    const groupMap = new Map();

    activeMembers.forEach((m) => {
      const activeChits = getActiveChits(m);
      const isMulti = m.classification === 'MULTIPLE' || activeChits.length > 1;
      if (isMulti) return; // Multi-Chit members stay separate

      activeChits.forEach((c) => {
        const val = Number(c.totalChitValue || 100000);
        if (val !== targetVal) return;

        const grpId = String(c.groupId || 'I');
        const qty = Number(c.quantity || 1);
        const baseMonthly = getGroupMonthlyBaseAmount(val, grpId);

        if (!groupMap.has(grpId)) {
          groupMap.set(grpId, {
            groupId: grpId,
            chitValue: val,
            monthlyBase: baseMonthly,
            memberCount: 0,
            activeHoldings: 0,
            membersList: [],
            totalDueAmount: 0,
          });
        }

        const grpObj = groupMap.get(grpId);
        grpObj.memberCount += 1;
        grpObj.activeHoldings += qty;
        grpObj.totalDueAmount += calculateChitPayable(c);
        grpObj.membersList.push({ member: m, chit: c, quantity: qty });
      });
    });

    return Array.from(groupMap.values()).sort((a, b) => compareGroupIds(a.groupId, b.groupId));
  }, [members, activeCategory, groupPaymentSettings]);

  // Filtered members list for search & filters
  const filteredMembersList = useMemo(() => {
    return members.filter((m) => {
      // Status filter
      if (filterStatus === 'active' && m.status === 'archived') return false;
      if (filterStatus === 'archived' && m.status !== 'archived') return false;

      // Classification filter
      const activeChits = getActiveChits(m);
      const isMulti = m.classification === 'MULTIPLE' || activeChits.length > 1;
      if (filterClassification === 'single' && isMulti) return false;
      if (filterClassification === 'multiple' && !isMulti) return false;

      // Category tab filtering
      if (activeCategory === 'multiple') {
        if (!isMulti) return false;
      } else {
        if (isMulti) return false;
        const targetVal = Number(activeCategory);
        const hasMatchingCategory = activeChits.some((c) => Number(c.totalChitValue || 100000) === targetVal);
        if (!hasMatchingCategory) return false;

        // Group filtering inside single chit
        if (selectedGroupId) {
          const hasGroup = activeChits.some((c) => String(c.groupId) === String(selectedGroupId));
          if (!hasGroup) return false;
        }
      }

      // Payment filter
      const totalPayable = calculateMemberTotalPayable(m);
      if (filterPayment === 'due' && totalPayable <= 0) return false;
      if (filterPayment === 'paid' && totalPayable > 0) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const sq = searchQuery.toLowerCase().trim();
        const nameMatch = m.name && m.name.toLowerCase().includes(sq);
        const phoneMatch = m.phone && m.phone.includes(sq);
        const waMatch = m.whatsapp && m.whatsapp.includes(sq);
        const idMatch = m.id && m.id.toLowerCase().includes(sq);
        const groupMatch = activeChits.some((c) => (c.groupId && c.groupId.toLowerCase().includes(sq)) || (c.name && c.name.toLowerCase().includes(sq)));
        return nameMatch || phoneMatch || waMatch || idMatch || groupMatch;
      }

      return true;
    });
  }, [members, activeCategory, selectedGroupId, searchQuery, filterClassification, filterStatus, filterPayment, groupPaymentSettings]);

  // Handlers for Modals & Actions
  const handleOpenDetails = (member) => {
    setSelectedMember(member);
    setIsDetailModalOpen(true);
    setActiveActionMenuMemberId(null);
  };

  const handleOpenEditMember = (member) => {
    setSelectedMember(member);
    setEditName(member.name || '');
    setEditPhone(member.phone || '');
    setEditAddress(member.address || '');
    setEditNominee(member.nominee || '');

    const active = (member.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
    const initialSubs = active.length > 0
      ? active.map((c, idx) => ({
          id: c.id || `chit_${member.id}_${idx}`,
          chitValue: String(c.totalChitValue || 100000),
          groupId: String(c.groupId || 'I'),
          monthlyAmount: String(c.amountToPay || Math.floor((c.totalChitValue || 100000) / 20)),
          pending: String(c.pending || 0),
          balance: String(c.balance || 0),
        }))
      : [
          {
            id: `chit_${member.id}_0`,
            chitValue: String(member.calculatedTotalChitValue || 100000),
            groupId: String(member.groupId || member.group || 'I'),
            monthlyAmount: String(member.amountToPay || 5000),
            pending: '0',
            balance: '0',
          },
        ];

    setEditMemberSubscriptions(initialSubs);
    setIsEditModalOpen(true);
    setActiveActionMenuMemberId(null);
  };

  const handleAddEditSubscriptionRow = () => {
    const defaultGroup = availableGroups[0] || 'I';
    setEditMemberSubscriptions((prev) => [
      ...prev,
      {
        id: `sub_${Date.now()}_${prev.length}`,
        chitValue: '100000',
        groupId: defaultGroup,
        monthlyAmount: '5000',
        pending: '0',
        balance: '0',
      },
    ]);
  };

  const handleRemoveEditSubscriptionRow = (index) => {
    if (editMemberSubscriptions.length <= 1) {
      showToast('A member must have at least one chit subscription.', 'warning');
      return;
    }
    setEditMemberSubscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSubscriptionChange = (index, field, value) => {
    setEditMemberSubscriptions((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };
      if (field === 'chitValue') {
        const valNum = Number(value) || 100000;
        current.monthlyAmount = String(Math.floor(valNum / 20));
      }
      updated[index] = current;
      return updated;
    });
  };

  const handleSaveEditMember = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;

    if (!editName.trim() || !editPhone.trim()) {
      showToast('Please enter member name and phone number.', 'error');
      return;
    }

    if (!editMemberSubscriptions || editMemberSubscriptions.length === 0) {
      showToast('Member must have at least one chit subscription.', 'error');
      return;
    }

    // Validate each subscription row
    for (let i = 0; i < editMemberSubscriptions.length; i++) {
      const sub = editMemberSubscriptions[i];
      const val = Number(sub.chitValue);
      const grp = String(sub.groupId || '').trim();
      const monthly = Number(sub.monthlyAmount);

      if (isNaN(val) || val <= 0) {
        showToast(`Chit #${i + 1}: Please enter a valid chit value.`, 'error');
        return;
      }
      if (!grp) {
        showToast(`Chit #${i + 1}: Please select a chit group.`, 'error');
        return;
      }
      if (isNaN(monthly) || monthly <= 0) {
        showToast(`Chit #${i + 1}: Please enter a valid monthly amount.`, 'error');
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      const isMulti = editMemberSubscriptions.length > 1;
      const chits = editMemberSubscriptions.map((sub, idx) => {
        const val = Number(sub.chitValue);
        const grp = String(sub.groupId).trim().toUpperCase();
        const monthly = Number(sub.monthlyAmount) || Math.floor(val / 20);
        return {
          id: sub.id || `chit_${Date.now()}_${idx}_${grp}`,
          name: `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${grp})`,
          groupId: grp,
          totalChitValue: val,
          amountToPay: monthly,
          pending: Math.max(Number(sub.pending) || 0, 0),
          balance: Math.max(Number(sub.balance) || 0, 0),
          quantity: 1,
          status: 'ACTIVE',
        };
      });

      const updatedData = {
        name: editName.trim(),
        phone: editPhone.trim(),
        whatsapp: editPhone.trim(),
        address: editAddress.trim(),
        nominee: editNominee.trim(),
        classification: isMulti ? 'MULTIPLE' : 'SINGLE',
        group: chits[0]?.groupId || 'I',
        groupId: chits[0]?.groupId || 'I',
        chits,
        holdings: chits,
        totalHoldings: chits.length,
      };

      await memberService.updateMember(selectedMember.id, updatedData);

      setMembers((prev) =>
        prev.map((m) => (m.id === selectedMember.id ? { ...m, ...updatedData } : m))
      );
      setIsEditModalOpen(false);
      showToast(`✓ Member profile and subscriptions updated for "${editName}"!`);
    } catch (err) {
      showToast(`Failed to update member: ${err.message}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenEditAdjustment = (member, chit) => {
    const val = chit?.totalChitValue || 100000;
    const grp = chit?.groupId || 'I';
    const baseMonthly = getGroupMonthlyBaseAmount(val, grp);

    setSelectedMember(member);
    setTargetChitForAdjustment({
      ...chit,
      baseGroupMonthly: baseMonthly,
    });
    setInputPendingAmount(String(chit?.pending || 0));
    setInputBalanceAmount(String(chit?.balance || 0));
    setIsEditAdjustmentModalOpen(true);
    setActiveActionMenuMemberId(null);
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedMember || !targetChitForAdjustment) return;

    const parsedPending = Math.max(parseFloat(inputPendingAmount) || 0, 0);
    const parsedBalance = Math.max(parseFloat(inputBalanceAmount) || 0, 0);

    setIsSavingAdjustment(true);
    try {
      const updatedChits = await memberService.updateMemberAdjustment(
        selectedMember.id,
        targetChitForAdjustment.id,
        parsedPending,
        parsedBalance
      );

      setMembers((prev) =>
        prev.map((m) => (m.id === selectedMember.id ? { ...m, chits: updatedChits, holdings: updatedChits } : m))
      );

      setIsEditAdjustmentModalOpen(false);
      showToast(`Adjustment saved for ${selectedMember.name}! Pending: ₹${parsedPending.toLocaleString('en-IN')}, Balance: ₹${parsedBalance.toLocaleString('en-IN')}`);
    } catch (err) {
      showToast(`Failed to save adjustment: ${err.message}`, 'error');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleOpenEditMonthlyAmount = (group) => {
    const val = group.chitValue || 100000;
    const grp = group.groupId || 'I';
    const current = getGroupMonthlyBaseAmount(val, grp);

    setTargetGroupForMonthly({
      chitValue: val,
      groupId: grp,
      fullFormattedValue: `₹${(val / 100000).toFixed(0)} Lakh Group ${grp}`,
    });
    setInputMonthlyAmount(String(current));
    setIsEditMonthlyModalOpen(true);
  };

  const handleSaveMonthlyAmount = async (e) => {
    e.preventDefault();
    if (!targetGroupForMonthly) return;

    const parsedAmount = parseFloat(inputMonthlyAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Please enter a valid monthly amount.', 'error');
      return;
    }

    setIsSavingMonthlyAmount(true);
    try {
      await groupPaymentSettingsService.saveGroupPaymentSetting({
        chitValue: targetGroupForMonthly.chitValue,
        groupId: targetGroupForMonthly.groupId,
        monthlyAmount: parsedAmount,
      });

      const key = `${targetGroupForMonthly.chitValue}_${targetGroupForMonthly.groupId}`;
      setGroupPaymentSettings((prev) => ({ ...prev, [key]: parsedAmount }));
      setIsEditMonthlyModalOpen(false);
      showToast(`Group ${targetGroupForMonthly.groupId} base monthly payment set to ₹${parsedAmount.toLocaleString('en-IN')}!`);
    } catch (err) {
      showToast(`Failed to save group monthly amount: ${err.message}`, 'error');
    } finally {
      setIsSavingMonthlyAmount(false);
    }
  };

  const handleOpenDeleteModal = (member) => {
    if (!member) return;
    setActiveActionMenuMemberId(null);
    setDeleteConfirmMember(member);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteMember = async () => {
    if (!deleteConfirmMember) return;
    setIsDeletingMember(true);
    try {
      await memberService.deleteMember(deleteConfirmMember.id, deleteConfirmMember);
      setMembers((prev) => prev.filter((m) => m.id !== deleteConfirmMember.id));
      setIsDeleteModalOpen(false);
      setIsDetailModalOpen(false);
      showToast(`✓ Member "${deleteConfirmMember.name}" permanently deleted.`);
      setDeleteConfirmMember(null);
    } catch (err) {
      showToast(`Failed to delete member: ${err.message}`, 'error');
    } finally {
      setIsDeletingMember(false);
    }
  };

  const handleArchiveGroup = async (groupId, chitValue) => {
    if (!groupId) return;
    if (window.confirm(`Archive Group ${groupId} (₹${(chitValue / 100000).toFixed(0)} Lakh)?\n\nAll members and payment records remain preserved in History.`)) {
      try {
        await chitService.archiveGroup(groupId, chitValue);
        showToast(`Group ${groupId} archived and preserved in History.`);
        loadData();
      } catch (err) {
        showToast(`Failed to archive group: ${err.message}`, 'error');
      }
    }
  };

  // Multi-Chit Subscription Row Handlers
  const handleAddSubscriptionRow = () => {
    const defaultGroup = availableGroups[0] || 'I';
    setNewChitSubscriptions((prev) => [
      ...prev,
      {
        id: `sub_${Date.now()}_${prev.length}`,
        chitValue: '100000',
        groupId: defaultGroup,
        monthlyAmount: '5000',
        pending: '0',
        balance: '0',
      },
    ]);
  };

  const handleRemoveSubscriptionRow = (index) => {
    if (newChitSubscriptions.length <= 1) return;
    setNewChitSubscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubscriptionChange = (index, field, value) => {
    setNewChitSubscriptions((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };
      if (field === 'chitValue') {
        const valNum = Number(value) || 100000;
        current.monthlyAmount = String(Math.floor(valNum / 20));
      }
      updated[index] = current;
      return updated;
    });
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      showToast('Please enter member name and phone number.', 'error');
      return;
    }

    if (!newChitSubscriptions || newChitSubscriptions.length === 0) {
      showToast('Please add at least one chit subscription.', 'error');
      return;
    }

    // Validate each subscription row
    for (let i = 0; i < newChitSubscriptions.length; i++) {
      const sub = newChitSubscriptions[i];
      const val = Number(sub.chitValue);
      const grp = String(sub.groupId || '').trim();
      const monthly = Number(sub.monthlyAmount);

      if (isNaN(val) || val <= 0) {
        showToast(`Chit Subscription #${i + 1}: Please enter a valid chit value.`, 'error');
        return;
      }
      if (!grp) {
        showToast(`Chit Subscription #${i + 1}: Please select a chit group.`, 'error');
        return;
      }
      if (isNaN(monthly) || monthly <= 0) {
        showToast(`Chit Subscription #${i + 1}: Please enter a valid monthly amount.`, 'error');
        return;
      }
    }

    setIsSavingAdd(true);
    try {
      const isMulti = newChitSubscriptions.length > 1;
      const chits = newChitSubscriptions.map((sub, idx) => {
        const val = Number(sub.chitValue);
        const grp = String(sub.groupId).trim().toUpperCase();
        const monthly = Number(sub.monthlyAmount) || Math.floor(val / 20);
        return {
          id: `chit_${Date.now()}_${idx}_${grp}`,
          name: `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${grp})`,
          groupId: grp,
          totalChitValue: val,
          amountToPay: monthly,
          pending: Math.max(Number(sub.pending) || 0, 0),
          balance: Math.max(Number(sub.balance) || 0, 0),
          quantity: 1,
          status: 'ACTIVE',
        };
      });

      const newMemberObj = {
        name: newName.trim(),
        phone: newPhone.trim(),
        whatsapp: newPhone.trim(),
        address: newAddress.trim(),
        nominee: newNominee.trim(),
        status: 'active',
        classification: isMulti ? 'MULTIPLE' : 'SINGLE',
        group: chits[0]?.groupId || 'I',
        groupId: chits[0]?.groupId || 'I',
        chits,
        holdings: chits,
        totalHoldings: chits.length,
      };

      const added = await memberService.addMember(newMemberObj);
      setMembers((prev) => [added, ...prev]);
      setIsAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewNominee('');
      setNewChitSubscriptions([
        { id: `sub_${Date.now()}_0`, chitValue: '100000', groupId: 'I', monthlyAmount: '5000', pending: '0', balance: '0' }
      ]);
      showToast(`✓ Member "${added.name}" with ${chits.length} chit${chits.length > 1 ? 's' : ''} added successfully!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingAdd(false);
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER & QUICK TOOLBAR */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between border-b border-[#E5E5E1] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-[#2F5D50] animate-pulse"></span>
            <h1 className="text-2xl md:text-3xl font-black text-[#1C1C1A] tracking-tight">Members Directory</h1>
          </div>
          <p className="text-xs font-medium text-[#6B6B67]">
            Manage members, chit subscriptions, payments and account balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh Firestore Data"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E5E1] bg-white text-[#1C1C1A] hover:bg-[#F7F7F5] cursor-pointer shadow-xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#2F5D50]' : 'text-[#6B6B67]'}`} />
          </button>

          <Button
            variant="primary"
            size="md"
            className="gap-2 rounded-xl bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold shadow-xs cursor-pointer"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </Button>
        </div>
      </div>

      {/* ERROR CARD */}
      {error && (
        <div className="p-4 bg-[#FCEEEE] border border-[#F8B4B4] rounded-xl flex items-center justify-between text-xs text-[#C53030] font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C53030] shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl text-xs bg-white text-[#1C1C1A] border-[#E5E5E1]">
            Retry
          </Button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 2. TOP CATEGORY NAVIGATION CARDS (₹1L, ₹2L, ₹5L, Multi Chits) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        {/* ₹1 LAKH CHITS CARD */}
        <div
          onClick={() => {
            setActiveCategory('100000');
            setSelectedGroupId(null);
          }}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all duration-200 shadow-xs ${
            activeCategory === '100000'
              ? 'bg-[#EDF7F0] text-[#1C1C1A] border-[#2F5D50] ring-1 ring-[#2F5D50]'
              : 'bg-white text-[#1C1C1A] border-[#E5E5E1] hover:border-[#2F5D50]/40 hover:bg-[#F7F7F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${activeCategory === '100000' ? 'text-[#2F5D50]' : 'text-[#6B6B67]'}`}>
              Single Chit Category
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeCategory === '100000' ? 'bg-[#2F5D50]/15 text-[#2F5D50]' : 'bg-[#F7F7F5] text-[#6B6B67]'}`}>
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg md:text-xl font-black mt-2 text-[#1C1C1A]">1 Lakh Chits</h3>
          <div className="flex items-center justify-between text-xs mt-2.5 pt-2.5 border-t border-[#E5E5E1]">
            <span className="font-bold text-[#6B6B67]">
              13 Groups
            </span>
            <Badge variant={activeCategory === '100000' ? 'success' : 'neutral'} className="text-[10px] font-bold">
              {stats.single1L.members} Members
            </Badge>
          </div>
        </div>

        {/* ₹2 LAKH CHITS CARD */}
        <div
          onClick={() => {
            setActiveCategory('200000');
            setSelectedGroupId(null);
          }}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all duration-200 shadow-xs ${
            activeCategory === '200000'
              ? 'bg-[#EDF7F0] text-[#1C1C1A] border-[#2F5D50] ring-1 ring-[#2F5D50]'
              : 'bg-white text-[#1C1C1A] border-[#E5E5E1] hover:border-[#2F5D50]/40 hover:bg-[#F7F7F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${activeCategory === '200000' ? 'text-[#2F5D50]' : 'text-[#6B6B67]'}`}>
              Single Chit Category
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeCategory === '200000' ? 'bg-[#2F5D50]/15 text-[#2F5D50]' : 'bg-[#F7F7F5] text-[#6B6B67]'}`}>
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg md:text-xl font-black mt-2 text-[#1C1C1A]">2 Lakh Chits</h3>
          <div className="flex items-center justify-between text-xs mt-2.5 pt-2.5 border-t border-[#E5E5E1]">
            <span className="font-bold text-[#6B6B67]">
              6 Groups
            </span>
            <Badge variant={activeCategory === '200000' ? 'success' : 'neutral'} className="text-[10px] font-bold">
              {stats.single2L.members} Members
            </Badge>
          </div>
        </div>

        {/* ₹5 LAKH CHITS CARD */}
        <div
          onClick={() => {
            setActiveCategory('500000');
            setSelectedGroupId(null);
          }}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all duration-200 shadow-xs ${
            activeCategory === '500000'
              ? 'bg-[#EDF7F0] text-[#1C1C1A] border-[#2F5D50] ring-1 ring-[#2F5D50]'
              : 'bg-white text-[#1C1C1A] border-[#E5E5E1] hover:border-[#2F5D50]/40 hover:bg-[#F7F7F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${activeCategory === '500000' ? 'text-[#2F5D50]' : 'text-[#6B6B67]'}`}>
              Single Chit Category
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeCategory === '500000' ? 'bg-[#2F5D50]/15 text-[#2F5D50]' : 'bg-[#F7F7F5] text-[#6B6B67]'}`}>
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg md:text-xl font-black mt-2 text-[#1C1C1A]">5 Lakh Chits</h3>
          <div className="flex items-center justify-between text-xs mt-2.5 pt-2.5 border-t border-[#E5E5E1]">
            <span className="font-bold text-[#6B6B67]">
              4 Groups
            </span>
            <Badge variant={activeCategory === '500000' ? 'success' : 'neutral'} className="text-[10px] font-bold">
              {stats.single5L.members} Members
            </Badge>
          </div>
        </div>

        {/* MULTI CHIT HOLDERS CARD */}
        <div
          onClick={() => {
            setActiveCategory('multiple');
            setSelectedGroupId(null);
          }}
          className={`group cursor-pointer rounded-2xl border p-4.5 transition-all duration-200 shadow-xs ${
            activeCategory === 'multiple'
              ? 'bg-[#EDF7F0] text-[#1C1C1A] border-[#2F5D50] ring-1 ring-[#2F5D50]'
              : 'bg-white text-[#1C1C1A] border-[#E5E5E1] hover:border-[#2F5D50]/40 hover:bg-[#F7F7F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${activeCategory === 'multiple' ? 'text-[#2F5D50]' : 'text-[#6B6B67]'}`}>
              Multi-Chit Roster
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeCategory === 'multiple' ? 'bg-[#2F5D50]/15 text-[#2F5D50]' : 'bg-[#F7F7F5] text-[#6B6B67]'}`}>
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-lg md:text-xl font-black mt-2 text-[#1C1C1A]">Multi Chits</h3>
          <div className="flex items-center justify-between text-xs mt-2.5 pt-2.5 border-t border-[#E5E5E1]">
            <span className="font-bold text-[#2F5D50]">
              {stats.multiple.members} Members
            </span>
            <Badge variant="purple" className="text-[10px] font-bold">
              {stats.multiple.holdings} Tickets
            </Badge>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 3. SEARCH & FILTER TOOLBAR */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <div className="p-4 bg-white border border-[#E5E5E1] rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#959590] pointer-events-none" />
            <input
              type="text"
              placeholder="Search member name, phone, chit, ticket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] pl-10 pr-9 py-2 text-xs font-semibold text-[#1C1C1A] placeholder-[#959590] focus:border-[#2F5D50] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-[#959590] hover:text-[#1C1C1A] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* FILTER DROPDOWNS */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Classification */}
            <select
              value={filterClassification}
              onChange={(e) => setFilterClassification(e.target.value)}
              className="rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:border-[#2F5D50] focus:outline-none"
            >
              <option value="all">All Classifications</option>
              <option value="single">Single Chit Only</option>
              <option value="multiple">Multi Chit Only</option>
            </select>

            {/* Payment Filter */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:border-[#2F5D50] focus:outline-none"
            >
              <option value="all">All Payment Statuses</option>
              <option value="due">Has Due / Pending</option>
              <option value="paid">Cleared / Paid</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:border-[#2F5D50] focus:outline-none"
            >
              <option value="active">Active Members</option>
              <option value="archived">Archived Members</option>
              <option value="all">All Statuses</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 4. SINGLE CHIT GROUP GRID (IF NOT MULTIPLE AND NO SPECIFIC GROUP SELECTED) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeCategory !== 'multiple' && !selectedGroupId && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#6B6B67]">
              ₹{(Number(activeCategory) / 100000).toFixed(0)} Lakh Chit Groups ({singleChitGroups.length} Groups)
            </h2>
            <span className="text-[11px] font-bold text-[#2F5D50]">Card-Based Group View</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 bg-white border border-[#E5E5E1] rounded-2xl animate-pulse h-32" />
              ))}
            </div>
          ) : singleChitGroups.length === 0 ? (
            <div className="p-8 text-center text-[#6B6B67] text-xs font-bold bg-white border border-[#E5E5E1] rounded-2xl">
              No active groups found for ₹{(Number(activeCategory) / 100000).toFixed(0)} Lakh Chits.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {singleChitGroups.map((group) => (
                <div
                  key={group.groupId}
                  className="p-5 bg-white border border-[#E5E5E1] rounded-2xl shadow-xs hover:border-[#2F5D50]/40 transition-all space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-[#2F5D50]/10 text-[#2F5D50] font-black text-sm flex items-center justify-center border border-[#2F5D50]/20">
                        {group.groupId}
                      </span>
                      <div>
                        <h3 className="text-base font-black text-[#1C1C1A]">{group.chitValue === 100000 ? '1L' : group.chitValue === 200000 ? '2L' : '5L'} Group {group.groupId}</h3>
                        <p className="text-[11px] text-[#6B6B67] font-bold font-mono">₹{group.chitValue.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <Badge variant="info" className="text-[10px] font-bold">
                      {group.memberCount} / 20
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2.5 border-y border-[#E5E5E1] bg-[#F7F7F5] rounded-xl p-3">
                    <div>
                      <span className="text-[9px] font-black text-[#6B6B67] uppercase tracking-wider block">Monthly Installment</span>
                      <span className="font-black text-[#2F6B4F] text-sm">₹{group.monthlyBase.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-[#6B6B67] uppercase tracking-wider block">Current Cycle</span>
                      <span className="font-bold text-[#2F5D50]">Month #8</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      onClick={() => handleOpenEditMonthlyAmount(group)}
                      className="text-[11px] font-bold text-[#1C1C1A] hover:bg-[#E5E5E1] border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                    >
                      Edit Monthly
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleArchiveGroup(group.groupId, group.chitValue)}
                        className="text-[11px] font-bold text-[#C53030] hover:bg-[#FCEEEE] border border-[#F8B4B4] bg-[#FCEEEE] px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                      >
                        Archive
                      </button>

                      <button
                        onClick={() => setSelectedGroupId(group.groupId)}
                        className="text-[11px] font-black text-white bg-[#2F5D50] hover:bg-[#24493F] px-3.5 py-1.5 rounded-xl cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <span>View Members</span> <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 5. SELECTED GROUP HEADER BAR (IF INSIDE SPECIFIC GROUP) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {selectedGroupId && activeCategory !== 'multiple' && (
        <div className="flex items-center justify-between bg-[#EDF7F0] border border-[#2F5D50]/30 rounded-2xl p-5 text-xs shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedGroupId(null)}
              className="flex items-center gap-1.5 font-bold text-[#2F5D50] hover:bg-[#2F5D50]/15 bg-white border border-[#2F5D50]/30 px-4 py-2 rounded-xl cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Group Cards
            </button>
            <div>
              <h2 className="text-base font-black text-[#1C1C1A]">
                ₹{(Number(activeCategory) / 100000).toFixed(0)} Lakh — Group {selectedGroupId}
              </h2>
              <p className="text-[11px] font-semibold text-[#6B6B67]">
                Displaying members in Group {selectedGroupId}. Monthly Installment: ₹{getGroupMonthlyBaseAmount(activeCategory, selectedGroupId).toLocaleString('en-IN')}.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenEditMonthlyAmount({ chitValue: Number(activeCategory), groupId: selectedGroupId })}
            className="font-bold text-[#2F5D50] bg-white border border-[#2F5D50]/30 px-4 py-2 rounded-xl hover:bg-[#F7F7F5] cursor-pointer shrink-0"
          >
            Edit Monthly Payment
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 6. MEMBER LIST / ROSTER TABLE (COMPACT ENTERPRISE ACTIONS) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#6B6B67]">
            {activeCategory === 'multiple' ? 'Multi-Chit Directory (68 Members)' : `Group Member Directory (${filteredMembersList.length} Members)`}
          </h2>
          <span className="text-[11px] font-bold text-[#6B6B67]">Enterprise List Mode</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 bg-[#111625]/90 border border-slate-800/80 rounded-3xl animate-pulse h-20" />
            ))}
          </div>
        ) : filteredMembersList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold bg-[#111625]/90 border border-slate-800/80 rounded-3xl space-y-3">
            <Users className="w-8 h-8 text-slate-500 mx-auto" />
            <p>No members found matching your search or filter selection.</p>
            <Button variant="secondary" size="sm" onClick={() => { setSearchQuery(''); setFilterClassification('all'); setFilterPayment('all'); setSelectedGroupId(null); }}>
              Clear Search & Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembersList.map((member) => {
              const activeChits = getActiveChits(member);
              const isMulti = member.classification === 'MULTIPLE' || activeChits.length > 1;
              const totalPayable = calculateMemberTotalPayable(member);
              const isActionMenuOpen = activeActionMenuMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className={`p-4 md:p-5 border bg-white rounded-2xl shadow-xs transition-all hover:border-[#2F5D50]/40 relative ${
                    isMulti ? 'border-[#2F5D50]/30' : 'border-[#E5E5E1]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* MEMBER PROFILE */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-xl font-black text-base flex items-center justify-center shrink-0 text-white shadow-xs ${
                        isMulti ? 'bg-[#2F5D50]' : 'bg-[#1C1C1A]'
                      }`}>
                        {(member.name || 'M').charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-black text-[#1C1C1A] truncate">{member.name}</h3>
                          <Badge variant={isMulti ? 'purple' : 'info'} className="text-[10px] font-bold">
                            {isMulti ? 'MULTIPLE' : 'SINGLE'}
                          </Badge>
                          {member.status === 'TEST' && <Badge variant="warning">TEST RECORD</Badge>}
                          {member.status === 'archived' && <Badge variant="danger">ARCHIVED</Badge>}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#6B6B67]">
                          <span className="flex items-center gap-1 font-sans">
                            <Phone className="w-3.5 h-3.5 text-[#959590]" />
                            {member.phone || 'No Phone'}
                          </span>
                          {member.whatsapp && member.whatsapp !== member.phone && (
                            <span className="text-[11px] text-[#2F6B4F] font-mono">WA: {member.whatsapp}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CHIT DETAILS & SUBSCRIPTIONS */}
                    <div className="flex-1 min-w-0 border-t lg:border-t-0 lg:border-l border-[#E5E5E1] pt-3 lg:pt-0 lg:pl-6">
                      <div className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#2F5D50]" />
                        <span>{isMulti ? `Chit Subscriptions (${activeChits.length})` : 'Assigned Chit Group'}</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {activeChits.map((c) => {
                          const valLakh = (Number(c.totalChitValue || 100000) / 100000).toFixed(0);
                          const qty = Number(c.quantity || 1);
                          return (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#F7F7F5] border border-[#E5E5E1] text-[#1C1C1A] font-sans"
                            >
                              <span>₹{valLakh}L • Group {c.groupId || 'I'}</span>
                              {qty > 1 && <span className="text-[#2F5D50] font-extrabold bg-[#EDF7F0] px-1.5 py-0.2 rounded-md">× {qty}</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* FINANCIAL DETAILS & COMPACT ACTIONS */}
                    <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 border-[#E5E5E1] pt-3 lg:pt-0">
                      <div className="text-left lg:text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B67] block">Current Monthly Payable</span>
                        <span className="text-lg font-black text-[#2F6B4F] font-sans">
                          ₹{totalPayable.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs font-bold bg-[#F7F7F5] border-[#E5E5E1] text-[#1C1C1A] hover:bg-[#E5E5E1] cursor-pointer"
                          onClick={() => handleOpenDetails(member)}
                        >
                          View Details
                        </Button>

                        {/* THREE-DOT COMPACT ACTION DROPDOWN MENU */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuMemberId(isActionMenuOpen ? null : member.id);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E1] bg-white text-[#1C1C1A] hover:bg-[#F7F7F5] transition-colors cursor-pointer"
                            aria-label="Actions menu"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* POPUP DROPDOWN MENU */}
                          {isActionMenuOpen && (
                            <div
                              ref={actionMenuRef}
                              className="absolute right-0 top-10 z-40 w-48 rounded-xl bg-white text-[#1C1C1A] p-1.5 shadow-lg border border-[#E5E5E1] text-xs font-semibold animate-in fade-in zoom-in-95 duration-150"
                            >
                              <button
                                onClick={() => handleOpenDetails(member)}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[#F7F7F5] text-[#1C1C1A] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-sky-400" />
                                <span>View Details</span>
                              </button>

                              <button
                                onClick={() => handleOpenEditMember(member)}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-900 text-slate-200 cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Edit Member Info</span>
                              </button>

                              {activeChits.length > 0 && (
                                <button
                                  onClick={() => handleOpenEditAdjustment(member, activeChits[0])}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-900 text-slate-200 cursor-pointer"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Edit Adjustments</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setSelectedMember(member);
                                  setIsMessageModalOpen(true);
                                  setActiveActionMenuMemberId(null);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-900 text-slate-200 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                                <span>Send WhatsApp</span>
                              </button>

                              <button
                                onClick={() => {
                                  navigate(`/history?memberId=${member.id}`);
                                  setActiveActionMenuMemberId(null);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-900 text-slate-200 cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5 text-purple-400" />
                                <span>View History Audit</span>
                              </button>

                              <button
                                onClick={() => handleOpenDeleteModal(member)}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 font-bold cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                <span>Delete Member</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 7. MEMBER DETAIL EXPERIENCE MODAL / DRAWER */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isDetailModalOpen && selectedMember && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Member Profile: ${selectedMember.name}`}
          subtitle={`Phone: ${selectedMember.phone} • Status: ${selectedMember.status || 'Active'}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6 font-sans text-xs">
            {/* MEMBER PROFILE HEADER */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Member Name</span>
                <span className="font-bold text-white text-sm">{selectedMember.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mobile Phone</span>
                <span className="font-bold text-sky-400 font-mono">{selectedMember.phone}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classification</span>
                <Badge variant={selectedMember.classification === 'MULTIPLE' ? 'purple' : 'info'}>
                  {selectedMember.classification || 'SINGLE'}
                </Badge>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Address</span>
                <span className="font-semibold text-slate-300">{selectedMember.address || 'N/A'}</span>
              </div>
            </div>

            {/* CHIT SUBSCRIPTIONS BREAKDOWN */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                Chit Subscriptions ({getActiveChits(selectedMember).length})
              </h4>

              <div className="space-y-3">
                {getActiveChits(selectedMember).map((chit) => {
                  const val = chit.totalChitValue || 100000;
                  const grp = chit.groupId || 'I';
                  const baseMonthly = getGroupMonthlyBaseAmount(val, grp);
                  const payable = calculateChitPayable(chit);

                  return (
                    <div key={chit.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 shadow-md">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <h5 className="font-bold text-white text-sm">
                            ₹{(val / 100000).toFixed(0)} Lakh Chit — Group {grp}
                          </h5>
                          <span className="text-[11px] text-slate-400">Holding Quantity: {chit.quantity || 1}</span>
                        </div>
                        <span className="text-base font-black text-emerald-400 font-sans">
                          Payable: ₹{payable.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Base Monthly</span>
                          <span className="font-bold text-white">₹{baseMonthly.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Pending (+)</span>
                          <span className="font-bold text-amber-400">+₹{(chit.pending || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Balance (-)</span>
                          <span className="font-bold text-emerald-400">-₹{(chit.balance || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-xl text-xs font-bold border-slate-800 bg-slate-900 text-sky-400 hover:bg-slate-800 cursor-pointer"
                          onClick={() => {
                            setIsDetailModalOpen(false);
                            handleOpenEditAdjustment(selectedMember, chit);
                          }}
                        >
                          Edit Adjustment
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E5E5E1]">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                onClick={() => handleOpenDeleteModal(selectedMember)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete Member
              </Button>

              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setIsDetailModalOpen(false)}>
                Close Details
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 8. EDIT ADJUSTMENT MODAL (LIVE CALCULATION PREVIEW) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isEditAdjustmentModalOpen && targetChitForAdjustment && (
        <Modal
          isOpen={isEditAdjustmentModalOpen}
          onClose={() => setIsEditAdjustmentModalOpen(false)}
          title={`Financial Adjustment: ${selectedMember?.name}`}
          subtitle={`₹${((targetChitForAdjustment.totalChitValue || 100000) / 100000).toFixed(0)} Lakh Chit • Group ${targetChitForAdjustment.groupId || 'I'}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveAdjustment} className="space-y-4 font-sans text-xs">
            {/* LIVE CALCULATION PREVIEW BOX */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 shadow-md border border-slate-800">
              <div className="flex justify-between items-center text-slate-300">
                <span>Group Base Monthly:</span>
                <span className="font-bold font-mono">₹{(targetChitForAdjustment.baseGroupMonthly || 4500).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-amber-300">
                <span>Pending (+) Added:</span>
                <span className="font-bold font-mono">+₹{(parseFloat(inputPendingAmount) || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-300">
                <span>Balance (-) Offset:</span>
                <span className="font-bold font-mono">-₹{(parseFloat(inputBalanceAmount) || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black text-white">
                <span>Current Month Payable:</span>
                <span className="text-base text-sky-400 font-mono">
                  ₹{Math.max((targetChitForAdjustment.baseGroupMonthly || 4500) + (parseFloat(inputPendingAmount) || 0) - (parseFloat(inputBalanceAmount) || 0), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Pending Amount (₹) — Added to current payable
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={inputPendingAmount}
                onChange={(e) => setInputPendingAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Balance Adjustment (₹) — Offset from current payable
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={inputBalanceAmount}
                onChange={(e) => setInputBalanceAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditAdjustmentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSavingAdjustment}>
                {isSavingAdjustment ? 'Saving...' : 'Save Financial Adjustment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 9. EDIT GROUP MONTHLY AMOUNT MODAL */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isEditMonthlyModalOpen && targetGroupForMonthly && (
        <Modal
          isOpen={isEditMonthlyModalOpen}
          onClose={() => setIsEditMonthlyModalOpen(false)}
          title="Edit Group Monthly Payment"
          subtitle={`Changes base monthly payment for ${targetGroupForMonthly.fullFormattedValue}.`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveMonthlyAmount} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Group Monthly Premium (₹)
              </label>
              <input
                type="number"
                min="100"
                step="100"
                required
                value={inputMonthlyAmount}
                onChange={(e) => setInputMonthlyAmount(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Note: This modifies the base payment for all members in Group {targetGroupForMonthly.groupId}. Individual member pending and balance adjustments remain untouched.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditMonthlyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSavingMonthlyAmount}>
                {isSavingMonthlyAmount ? 'Saving...' : 'Save Group Monthly Amount'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 10. EDIT MEMBER INFO MODAL (SINGLE & MULTI-CHIT WITH INDEPENDENT MONTHLY AMOUNTS) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isEditModalOpen && selectedMember && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Member: ${selectedMember.name}`}
          subtitle="Update member details, manage chit subscriptions, and edit monthly amounts independently."
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSaveEditMember} className="space-y-5 text-xs font-sans">
            {/* MEMBER PERSONAL DETAILS */}
            <div className="p-4 bg-[#F7F7F5] border border-[#E5E5E1] rounded-2xl space-y-3">
              <span className="text-[10px] font-black text-[#2F5D50] uppercase tracking-wider block">
                1. Member Personal Details
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Member Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Mobile Phone (WhatsApp) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Nominee Name
                  </label>
                  <input
                    type="text"
                    value={editNominee}
                    onChange={(e) => setEditNominee(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>
              </div>
            </div>

            {/* CHIT SUBSCRIPTIONS LIST (DYNAMIC MULTI-CHIT ROWS WITH INDEPENDENT MONTHLY AMOUNTS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-[#2F5D50] uppercase tracking-wider block">
                    2. Chit Subscriptions ({editMemberSubscriptions.length})
                  </span>
                  <p className="text-[11px] text-[#6B6B67]">
                    Adjust group and monthly payment individually for each chit held by this member.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-bold gap-1 border-[#2F5D50] text-[#2F5D50] hover:bg-[#EDF7F0] cursor-pointer"
                  onClick={handleAddEditSubscriptionRow}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Chit</span>
                </Button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {editMemberSubscriptions.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-3.5 bg-white border border-[#E5E5E1] rounded-2xl shadow-xs space-y-3 relative"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1C1C1A]">
                        <span className="w-5 h-5 rounded-full bg-[#2F5D50] text-white flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span>Chit Subscription {idx + 1}</span>
                      </span>

                      {editMemberSubscriptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditSubscriptionRow(idx)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Remove Subscription"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                          Chit Value *
                        </label>
                        <select
                          value={sub.chitValue}
                          onChange={(e) => handleEditSubscriptionChange(idx, 'chitValue', e.target.value)}
                          className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
                        >
                          <option value="100000">₹1 Lakh Chit</option>
                          <option value="200000">₹2 Lakh Chit</option>
                          <option value="500000">₹5 Lakh Chit</option>
                          <option value="1000000">₹10 Lakh Chit</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                          Chit Group *
                        </label>
                        <select
                          value={sub.groupId}
                          onChange={(e) => handleEditSubscriptionChange(idx, 'groupId', e.target.value)}
                          className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
                        >
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

                      <div>
                        <label className="block text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                          Monthly Amount (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          min="100"
                          step="100"
                          value={sub.monthlyAmount}
                          onChange={(e) => handleEditSubscriptionChange(idx, 'monthlyAmount', e.target.value)}
                          className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none font-sans"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E1]">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Saving...' : 'Save Member & Subscriptions'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 11. ADD MEMBER MODAL (COMPLETE MULTI-CHIT SUPPORT) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Member"
          subtitle="Enroll a member with Single or Multiple Chit subscriptions."
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleAddMemberSubmit} className="space-y-5 text-xs font-sans">
            {/* MEMBER PERSONAL DETAILS */}
            <div className="p-4 bg-[#F7F7F5] border border-[#E5E5E1] rounded-2xl space-y-3">
              <span className="text-[10px] font-black text-[#2F5D50] uppercase tracking-wider block">
                1. Member Personal Details
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Mobile Phone (WhatsApp) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9848012345"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad / Local area"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
                    Nominee Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nominee / Relation"
                    value={newNominee}
                    onChange={(e) => setNewNominee(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>
              </div>
            </div>

            {/* CHIT SUBSCRIPTIONS LIST (DYNAMIC MULTI-CHIT ROWS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-[#2F5D50] uppercase tracking-wider block">
                    2. Chit Subscriptions ({newChitSubscriptions.length})
                  </span>
                  <p className="text-[11px] text-[#6B6B67]">
                    Configure monthly payment and group details for every chit held by this member.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-bold gap-1 border-[#2F5D50] text-[#2F5D50] hover:bg-[#EDF7F0] cursor-pointer"
                  onClick={handleAddSubscriptionRow}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Chit</span>
                </Button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {newChitSubscriptions.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-3.5 bg-white border border-[#E5E5E1] rounded-2xl shadow-xs space-y-3 relative"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1C1C1A]">
                        <span className="w-5 h-5 rounded-full bg-[#2F5D50] text-white flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span>Chit Subscription {idx + 1}</span>
                      </span>

                      {newChitSubscriptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubscriptionRow(idx)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Remove Subscription"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                          Chit Value *
                        </label>
                        <select
                          value={sub.chitValue}
                          onChange={(e) => handleSubscriptionChange(idx, 'chitValue', e.target.value)}
                          className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
                        >
                          <option value="100000">₹1 Lakh Chit</option>
                          <option value="200000">₹2 Lakh Chit</option>
                          <option value="500000">₹5 Lakh Chit</option>
                          <option value="1000000">₹10 Lakh Chit</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                          Chit Group *
                        </label>
                        <select
                          value={sub.groupId}
                          onChange={(e) => handleSubscriptionChange(idx, 'groupId', e.target.value)}
                          className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
                        >
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

                      <div>
                        <label className="block text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                          Monthly Amount (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          min="100"
                          step="100"
                          value={sub.monthlyAmount}
                          onChange={(e) => handleSubscriptionChange(idx, 'monthlyAmount', e.target.value)}
                          className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-2 text-xs font-bold text-[#1C1C1A] focus:outline-none font-sans"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E1]">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold"
                disabled={isSavingAdd}
              >
                {isSavingAdd ? 'Saving Member...' : `Save Member (${newChitSubscriptions.length} Chit${newChitSubscriptions.length > 1 ? 's' : ''})`}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 12. PERMANENT DELETE CONFIRMATION MODAL */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isDeleteModalOpen && deleteConfirmMember && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Member Permanently"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-red-700 font-black text-sm">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>Permanent Action Warning</span>
              </div>
              <p className="text-red-700 text-xs leading-relaxed">
                Are you sure you want to permanently delete member <strong>"{deleteConfirmMember.name}"</strong>?
              </p>
              <p className="text-red-600 text-[11px] font-semibold">
                ⚠️ This action cannot be undone. The member will be removed permanently from the active directory. Historical financial transaction logs remain safe in the ledger for accounting consistency.
              </p>
            </div>

            <div className="p-3 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6B6B67]">Member Name:</span>
                <span className="font-bold text-[#1C1C1A]">{deleteConfirmMember.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B67]">Phone:</span>
                <span className="font-mono font-bold text-[#1C1C1A]">{deleteConfirmMember.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B67]">Chit Subscriptions:</span>
                <span className="font-bold text-[#2F5D50]">
                  {(deleteConfirmMember.chits || []).length} Chit(s)
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E1]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingMember}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
                onClick={handleConfirmDeleteMember}
                disabled={isDeletingMember}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingMember ? 'Deleting...' : 'Confirm Permanent Deletion'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* WHATSAPP MESSAGE MODAL */}
      {selectedMember && isMessageModalOpen && (
        <MemberMessageModal
          isOpen={isMessageModalOpen}
          onClose={() => setIsMessageModalOpen(false)}
          member={selectedMember}
          groupPaymentSettings={groupPaymentSettings}
          onSent={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
