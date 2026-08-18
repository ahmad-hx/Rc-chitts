import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Phone,
  Layers,
  X,
  MessageSquare,
  MapPin,
  Calendar,
  MessageCircle,
  FileText,
  UserCheck,
  Edit,
  History,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  CircleDollarSign,
  Users,
  IndianRupee,
  ArrowRight,
  LayoutGrid,
  Table,
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import MemberMessageModal from '../components/MemberMessageModal';
import { memberService, groupPaymentSettingsService } from '../services/dbService';

// Helper for Roman numeral parsing (I -> 1, II -> 2, III -> 3, IV -> 4, V -> 5, VI -> 6, VII -> 7, VIII -> 8, IX -> 9, X -> 10, XVII -> 17, etc.)
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
  const [members, setMembers] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [memberCategoryFilter, setMemberCategoryFilter] = useState('all');
  const [toast, setToast] = useState(null);

  // Hierarchy Navigation States
  const [selectedChitValue, setSelectedChitValue] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [viewMode, setViewMode] = useState('hierarchy');

  // Modal control states
  const [selectedMember, setSelectedMember] = useState(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit Group Monthly Amount Modal State (Group Level)
  const [isEditMonthlyModalOpen, setIsEditMonthlyModalOpen] = useState(false);
  const [targetGroupForMonthly, setTargetGroupForMonthly] = useState(null);
  const [inputMonthlyAmount, setInputMonthlyAmount] = useState('');
  const [isSavingMonthlyAmount, setIsSavingMonthlyAmount] = useState(false);

  // Edit Member Pending / Balance Adjustment Modal State (Member Level)
  const [isEditAdjustmentModalOpen, setIsEditAdjustmentModalOpen] = useState(false);
  const [targetChitForAdjustment, setTargetChitForAdjustment] = useState(null);
  const [inputPendingAmount, setInputPendingAmount] = useState('0');
  const [inputBalanceAmount, setInputBalanceAmount] = useState('0');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  // Load members & group payment settings from Firestore
  useEffect(() => {
    let mounted = true;
    async function loadMembersFromDb() {
      setLoading(true);
      setError(null);
      try {
        const fetched = await memberService.getMembers();
        if (mounted) {
          setMembers(Array.isArray(fetched) ? fetched : []);
        }
      } catch (e) {
        if (mounted) {
          setError('Unable to load members from Firebase.');
          setMembers([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadGroupPaymentSettingsFromDb() {
      try {
        const { settingsMap } = await groupPaymentSettingsService.getGroupPaymentSettings();
        if (mounted) {
          setGroupPaymentSettings(settingsMap || {});
        }
      } catch (e) {
        console.warn('[GROUP PAYMENT SETTINGS NOTICE]', e?.message);
      }
    }

    loadMembersFromDb();
    loadGroupPaymentSettingsFromDb();
    return () => { mounted = false; };
  }, []);

  // Edit Payment Form states
  const [selectedChitId, setSelectedChitId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [updateNote, setUpdateNote] = useState('');

  // Edit Member Form states
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNominee, setEditNominee] = useState('');

  // Add Member Form states
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberWhatsApp, setNewMemberWhatsApp] = useState('');
  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [newMemberCity, setNewMemberCity] = useState('');
  const [newMemberState, setNewMemberState] = useState('');
  const [newMemberPincode, setNewMemberPincode] = useState('');
  const [newMemberNominee, setNewMemberNominee] = useState('');
  const [newMemberJoiningDate, setNewMemberJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMemberNotes, setNewMemberNotes] = useState('');
  const [newMemberChits, setNewMemberChits] = useState([
    {
      id: `new_chit_${Date.now()}_1`,
      name: '₹1,00,000 Chit (Group RC-01)',
      groupId: 'RC-01',
      chitValue: '100000',
      initialAmount: '5000',
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE'
    }
  ]);
  const [newMemberErrors, setNewMemberErrors] = useState({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
    }
    if (searchParams.get('filter') === 'due') {
      setMemberCategoryFilter('due');
    }
  }, [searchParams]);

  const getActiveChits = (member) => (member.chits || []).filter(chit => chit.status ? chit.status === 'ACTIVE' : true);

  const getMemberType = (member) => {
    const activeCount = getActiveChits(member).length;
    if (activeCount === 1) return 'SINGLE';
    if (activeCount >= 2) return 'MULTIPLE';
    return 'NONE';
  };

  const getMemberTypeVariant = (member) => {
    const type = getMemberType(member);
    if (type === 'SINGLE') return 'info';
    if (type === 'MULTIPLE') return 'success';
    return 'secondary';
  };

  // Helper to read group monthly base amount
  const getGroupMonthlyBaseAmount = (totalChitValue, groupId) => {
    const key = `${totalChitValue}_${groupId}`;
    if (typeof groupPaymentSettings[key] === 'number' && groupPaymentSettings[key] > 0) {
      return groupPaymentSettings[key];
    }
    return Math.floor(Number(totalChitValue || 100000) / 20);
  };

  // Formula: Current Month Payable = (Group Monthly Base * quantity) + Member Pending - Member Balance (clamped to min 0)
  const calculateChitPayable = (chit) => {
    const baseGroupMonthly = getGroupMonthlyBaseAmount(chit.totalChitValue || 100000, chit.groupId || 'I');
    const quantity = Number(chit.quantity || 1);
    const pending = Number(chit.pending || 0);
    const balance = Number(chit.balance || 0);
    return Math.max((baseGroupMonthly * quantity) + pending - balance, 0);
  };

  const calculateTotalDue = (member) => {
    return getActiveChits(member).reduce((sum, chit) => sum + calculateChitPayable(chit), 0);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DYNAMIC FRONT-END HIERARCHICAL GROUPING & ROMAN NUMERAL SORTING
  // ─────────────────────────────────────────────────────────────────────────
  const chitCollections = useMemo(() => {
    const valueMap = new Map();

    members.forEach((member) => {
      const activeChits = getActiveChits(member);
      activeChits.forEach((chit) => {
        const value = Number(chit.totalChitValue || 100000);
        const groupId = chit.groupId || 'I';
        const quantity = Number(chit.quantity || 1);

        if (!valueMap.has(value)) {
          valueMap.set(value, {
            chitValue: value,
            formattedValue: `₹${(value / 100000).toFixed(0)} Lakh`,
            fullFormattedValue: `₹${value.toLocaleString('en-IN')}`,
            groupsMap: new Map(),
            totalHoldingsCount: 0,
            memberSet: new Set(),
            totalDueAmount: 0,
          });
        }

        const chitPayable = calculateChitPayable(chit);
        const valObj = valueMap.get(value);
        valObj.totalHoldingsCount += quantity;
        valObj.memberSet.add(member.id);
        valObj.totalDueAmount += chitPayable;

        if (!valObj.groupsMap.has(groupId)) {
          valObj.groupsMap.set(groupId, {
            groupId,
            chitValue: value,
            monthlyPremium: getGroupMonthlyBaseAmount(value, groupId),
            totalHoldingsCount: 0,
            memberSet: new Set(),
            membersList: [],
            totalDueAmount: 0,
          });
        }

        const grpObj = valObj.groupsMap.get(groupId);
        grpObj.totalHoldingsCount += quantity;
        grpObj.memberSet.add(member.id);
        grpObj.totalDueAmount += chitPayable;

        if (!grpObj.membersList.some(item => item.member.id === member.id)) {
          grpObj.membersList.push({
            member,
            chit,
            quantity,
          });
        }
      });
    });

    const sortedCollections = Array.from(valueMap.values())
      .sort((a, b) => a.chitValue - b.chitValue) // Category Order: ₹1L -> ₹2L -> ₹5L
      .map((valObj) => {
        const groupsArray = Array.from(valObj.groupsMap.values())
          .sort((a, b) => compareGroupIds(a.groupId, b.groupId))
          .map((grp) => ({
            ...grp,
            uniqueMembersCount: grp.memberSet.size,
          }));

        return {
          ...valObj,
          uniqueMembersCount: valObj.memberSet.size,
          groupsCount: groupsArray.length,
          groups: groupsArray,
        };
      });

    return sortedCollections;
  }, [members, groupPaymentSettings]);

  const activeCollection = useMemo(() => {
    if (!selectedChitValue) return null;
    return chitCollections.find((c) => c.chitValue === selectedChitValue) || null;
  }, [chitCollections, selectedChitValue]);

  const activeGroup = useMemo(() => {
    if (!activeCollection || !selectedGroupId) return null;
    return activeCollection.groups.find((g) => g.groupId === selectedGroupId) || null;
  }, [activeCollection, selectedGroupId]);

  // Overall Global Filtering for Search & Filter Controls
  const filteredMembers = members.filter(member => {
    const activeChitsCount = getActiveChits(member).length;
    const nameStr = member.name || '';
    const phoneStr = member.phone || '';
    const waStr = member.whatsapp || '';
    const idStr = member.id || '';
    const matchesSearch = nameStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          phoneStr.includes(searchQuery) ||
                          waStr.includes(searchQuery) ||
                          idStr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      memberCategoryFilter === 'all' ||
      (memberCategoryFilter === 'single' && activeChitsCount === 1) ||
      (memberCategoryFilter === 'multiple' && activeChitsCount >= 2) ||
      (memberCategoryFilter === 'due' && calculateTotalDue(member) > 0);
    return matchesSearch && matchesCategory;
  });

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending_due': return 'warning';
      case 'warning':
      case 'overdue': return 'danger';
      default: return 'info';
    }
  };

  const formatStatusText = (status) => {
    return status ? status.toUpperCase().replace('_', ' ') : 'ACTIVE';
  };

  const totalMembersCount = members.length;
  const singleMembersCount = members.filter(member => getActiveChits(member).length === 1).length;
  const multipleMembersCount = members.filter(member => getActiveChits(member).length >= 2).length;
  const totalActiveChitsCount = members.reduce((sum, member) => sum + getActiveChits(member).length, 0);

  const createNewChit = () => ({
    id: `new_chit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    name: '₹1,00,000 Chit (Group RC-01)',
    groupId: 'RC-01',
    chitValue: '100000',
    initialAmount: '5000',
    pending: 0,
    balance: 0,
    startDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE'
  });

  const handleNewMemberChitChange = (id, field, value) => {
    setNewMemberChits(prev => prev.map(chit => chit.id === id ? { ...chit, [field]: value } : chit));
    setNewMemberErrors(prev => {
      const updated = { ...prev };
      delete updated[`${field}_${id}`];
      return updated;
    });
  };

  const addNewChit = () => {
    setNewMemberChits(prev => [...prev, createNewChit()]);
  };

  const removeNewChit = (id) => {
    setNewMemberChits(prev => (prev.length > 1 ? prev.filter(chit => chit.id !== id) : prev));
  };

  const validatePhone = (value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10;
  };

  const handleOpenManage = (member) => {
    setSelectedMember(member);
    if (member.chits?.length > 0) {
      setSelectedChitId(member.chits[0].id);
      setNewAmount(calculateChitPayable(member.chits[0]).toString());
    }
    setUpdateNote('');
    setIsManageModalOpen(true);
  };

  const handleOpenDetails = (member) => {
    setSelectedMember(member);
    setIsDetailModalOpen(true);
  };

  const handleOpenMessage = (member) => {
    setSelectedMember(member);
    setIsMessageModalOpen(true);
  };

  const handleOpenEdit = (member) => {
    setSelectedMember(member);
    setEditName(member.name);
    setEditPhone(member.phone);
    setEditAddress(member.address || '');
    setEditNominee(member.nominee || '');
    setIsEditModalOpen(true);
  };

  // Group-Level Edit Handler (Edit Base Monthly Amount for entire Group)
  const handleOpenEditMonthlyAmount = (group) => {
    const key = `${group.chitValue}_${group.groupId}`;
    const currentSetting = groupPaymentSettings[key];
    setTargetGroupForMonthly({
      chitValue: group.chitValue,
      groupId: group.groupId,
      fullFormattedValue: `₹${group.chitValue.toLocaleString('en-IN')}`,
    });
    setInputMonthlyAmount(currentSetting ? String(currentSetting) : '');
    setIsEditMonthlyModalOpen(true);
  };

  const handleSaveMonthlyAmount = async (e) => {
    e.preventDefault();
    if (!targetGroupForMonthly) return;

    const parsedAmount = parseFloat(inputMonthlyAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Please enter a valid positive monthly amount.', 'error');
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
      setGroupPaymentSettings((prev) => ({
        ...prev,
        [key]: parsedAmount,
      }));

      setIsEditMonthlyModalOpen(false);
      showToast(`Base monthly payment for Group ${targetGroupForMonthly.groupId} updated to ₹${parsedAmount.toLocaleString('en-IN')}!`);
    } catch (err) {
      showToast(`Error saving amount: ${err.message}`, 'error');
    } finally {
      setIsSavingMonthlyAmount(false);
    }
  };

  // Member-Level Edit Handler (Edit Individual Member Pending / Balance Adjustment)
  const handleOpenEditAdjustment = (member, chit) => {
    const val = chit.totalChitValue || selectedChitValue || 100000;
    const grp = chit.groupId || selectedGroupId || 'I';
    const baseMonthly = getGroupMonthlyBaseAmount(val, grp);

    setSelectedMember(member);
    setTargetChitForAdjustment({
      ...chit,
      baseGroupMonthly: baseMonthly,
    });
    setInputPendingAmount(String(chit.pending || 0));
    setInputBalanceAmount(String(chit.balance || 0));
    setIsEditAdjustmentModalOpen(true);
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

      setMembers((prevMembers) =>
        prevMembers.map((m) => {
          if (m.id === selectedMember.id) {
            return {
              ...m,
              chits: updatedChits,
              holdings: updatedChits,
            };
          }
          return m;
        })
      );

      const updatedSelectedMember = {
        ...selectedMember,
        chits: updatedChits,
        holdings: updatedChits,
      };
      setSelectedMember(updatedSelectedMember);
      setIsEditAdjustmentModalOpen(false);
      showToast(`Financial adjustment updated for ${selectedMember.name}! Pending: ₹${parsedPending.toLocaleString('en-IN')}, Balance: ₹${parsedBalance.toLocaleString('en-IN')}`);
    } catch (err) {
      showToast(`Error saving adjustment: ${err.message}`, 'error');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleSaveEditMember = (e) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim()) {
      showToast('Name and phone are required', 'error');
      return;
    }

    const updated = members.map(m => {
      if (m.id === selectedMember.id) {
        return {
          ...m,
          name: editName.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
          nominee: editNominee.trim()
        };
      }
      return m;
    });

    setMembers(updated);
    const updatedMember = updated.find(m => m.id === selectedMember.id);
    setSelectedMember(updatedMember);
    setIsEditModalOpen(false);
    showToast('Member profile updated successfully!');
  };

  const formatCurrency = (amount) => `₹${(amount ?? 0).toLocaleString('en-IN')}`;

  const handleUpdatePayment = (e) => {
    e.preventDefault();
    if (!selectedMember || !selectedChitId) return;

    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    const updatedMembers = members.map(m => {
      if (m.id === selectedMember.id) {
        const updatedChits = m.chits.map(c => {
          if (c.id === selectedChitId) {
            const newHistoryItem = {
              date: new Date().toISOString().split('T')[0],
              amount: parsedAmount,
              updatedBy: 'Admin',
              note: updateNote || 'Manual update'
            };
            return {
              ...c,
              amountToPay: parsedAmount,
              paymentHistory: [newHistoryItem, ...(c.paymentHistory || [])]
            };
          }
          return c;
        });

        const totalDue = updatedChits.reduce((sum, c) => sum + (c.amountToPay || 0), 0);
        const newStatus = totalDue === 0 ? 'active' : m.status;

        return { ...m, chits: updatedChits, status: newStatus };
      }
      return m;
    });

    setMembers(updatedMembers);
    const latestMemberState = updatedMembers.find(m => m.id === selectedMember.id);
    setSelectedMember(latestMemberState);
    setUpdateNote('');
    showToast(`Payment amount for ${selectedMember.name} updated!`);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!newMemberName.trim()) errors.name = 'Member name is required.';
    if (!newMemberPhone.trim() || !validatePhone(newMemberPhone)) errors.phone = 'Valid phone number required.';
    if (!newMemberWhatsApp.trim() || !validatePhone(newMemberWhatsApp)) errors.whatsapp = 'Valid WhatsApp number required.';
    if (!newMemberAddress.trim()) errors.address = 'Address line is required.';

    if (Object.keys(errors).length > 0) {
      setNewMemberErrors(errors);
      return;
    }

    try {
      const dup = await memberService.checkDuplicateMember({
        phone: newMemberPhone,
        whatsapp: newMemberWhatsApp,
        name: newMemberName,
      });

      if (dup) {
        showToast(`Member ${dup.name} (${dup.phone}) already exists!`, 'error');
        return;
      }
    } catch (err) {
      // Continue if duplicate check errors out
    }

    const memberId = `mem_${Date.now()}`;
    const newMemberPayload = {
      id: memberId,
      name: newMemberName.trim(),
      phone: newMemberPhone.trim(),
      whatsapp: newMemberWhatsApp.trim(),
      address: newMemberAddress.trim(),
      city: newMemberCity.trim() || 'Guntur',
      state: newMemberState.trim() || 'Andhra Pradesh',
      pincode: newMemberPincode.trim() || '522002',
      joiningDate: newMemberJoiningDate,
      nominee: newMemberNominee.trim() || 'Family Member',
      notes: newMemberNotes.trim(),
      status: 'active',
      chits: newMemberChits.map((chit, index) => {
        const totalChitValue = parseFloat(chit.chitValue) || 100000;
        const initialAmount = parseFloat(chit.initialAmount) || 5000;
        return {
          id: `chit_${Date.now()}_${index + 1}`,
          name: chit.name,
          groupId: chit.groupId || 'RC-01',
          totalChitValue,
          amountToPay: initialAmount,
          pending: 0,
          balance: 0,
          balanceAmount: Math.max(totalChitValue - initialAmount, 0),
          startDate: chit.startDate,
          status: chit.status || 'ACTIVE',
          paymentHistory: [
            {
              date: new Date().toISOString().split('T')[0],
              amount: initialAmount,
              updatedBy: 'Admin',
              note: 'Member enrollment setup'
            }
          ]
        };
      })
    };

    let createdMember = newMemberPayload;
    try {
      createdMember = await memberService.addMember(newMemberPayload);
    } catch (dbErr) {
      console.warn('Firestore member insert notice:', dbErr.message);
    }

    setMembers([createdMember, ...members]);
    setIsAddModalOpen(false);
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberWhatsApp('');
    setNewMemberAddress('');
    setNewMemberCity('');
    setNewMemberState('');
    setNewMemberPincode('');
    setNewMemberNominee('');
    setNewMemberNotes('');
    setNewMemberChits([createNewChit()]);
    setNewMemberErrors({});
    showToast(`New member ${newMemberPayload.name} enrolled successfully!`);
  };

  const isSearchOrFilterActive = searchQuery.trim() !== '' || memberCategoryFilter !== 'all' || viewMode === 'all_members';

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
          <span className="text-[11px] font-normal text-amber-700">Check browser console for details.</span>
        </div>
      )}

      {/* HEADER SECTION & BREADCRUMBS */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          {/* BREADCRUMB TRAIL */}
          <nav className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1">
            <button
              onClick={() => {
                setSelectedChitValue(null);
                setSelectedGroupId(null);
                setViewMode('hierarchy');
                setSearchQuery('');
              }}
              className="hover:text-sky-600 cursor-pointer transition-colors"
            >
              Members
            </button>

            {selectedChitValue && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <button
                  onClick={() => {
                    setSelectedGroupId(null);
                    setViewMode('hierarchy');
                  }}
                  className={`cursor-pointer transition-colors ${!selectedGroupId ? 'text-sky-700 font-extrabold' : 'hover:text-sky-600'}`}
                >
                  ₹{(selectedChitValue / 100000).toFixed(0)} Lakh Chits
                </button>
              </>
            )}

            {selectedGroupId && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sky-700 font-extrabold">Group {selectedGroupId}</span>
              </>
            )}

            {isSearchOrFilterActive && !selectedChitValue && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sky-700 font-extrabold">
                  {searchQuery.trim() !== '' ? `Search Results ("${searchQuery}")` : 'All Members Directory'}
                </span>
              </>
            )}
          </nav>

          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            {selectedGroupId
              ? `₹${(selectedChitValue / 100000).toFixed(0)} Lakh • Group ${selectedGroupId} Members`
              : selectedChitValue
              ? `₹${(selectedChitValue / 100000).toFixed(0)} Lakh Chit Groups`
              : isSearchOrFilterActive
              ? 'Members Directory'
              : 'Members Overview'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {selectedGroupId
              ? `Showing members enrolled in Group ${selectedGroupId} (${activeGroup?.uniqueMembersCount || 0} Members, ₹${(selectedChitValue / 100000).toFixed(0)} Lakh Chit).`
              : selectedChitValue
              ? `Select a chit group under ₹${(selectedChitValue / 100000).toFixed(0)} Lakh collection to view or edit monthly payment configurations.`
              : 'Explore chit fund collections, navigate ordered groups (Group I to XVII, Group A, B, C), and configure group monthly base amounts & individual member adjustments.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'hierarchy' && !selectedChitValue && !isSearchOrFilterActive && (
            <Button
              variant="secondary"
              className="gap-2 cursor-pointer rounded-2xl text-xs font-bold"
              onClick={() => setViewMode('all_members')}
            >
              <Table className="w-4 h-4 text-sky-600" />
              All Members Directory
            </Button>
          )}

          {viewMode === 'all_members' && (
            <Button
              variant="secondary"
              className="gap-2 cursor-pointer rounded-2xl text-xs font-bold"
              onClick={() => setViewMode('hierarchy')}
            >
              <LayoutGrid className="w-4 h-4 text-sky-600" />
              Chit Hierarchy View
            </Button>
          )}

          <Button variant="primary" className="gap-2 cursor-pointer rounded-2xl" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Member
          </Button>
        </div>
      </div>

      {/* SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 font-sans">
        <Card
          onClick={() => {
            setMemberCategoryFilter('all');
            setSelectedChitValue(null);
            setSelectedGroupId(null);
            setViewMode('all_members');
          }}
          className={`p-4 sm:p-5 border bg-white rounded-3xl shadow-xs cursor-pointer transition-all hover:border-sky-300 hover:shadow-md ${memberCategoryFilter === 'all' && viewMode === 'all_members' ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Members</p>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">{loading ? '...' : totalMembersCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">197 Total Directory</p>
        </Card>

        <Card
          onClick={() => {
            setMemberCategoryFilter('single');
            setSelectedChitValue(null);
            setSelectedGroupId(null);
            setViewMode('all_members');
          }}
          className={`p-4 sm:p-5 border bg-white rounded-3xl shadow-xs cursor-pointer transition-all hover:border-sky-300 hover:shadow-md ${memberCategoryFilter === 'single' ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Single Chit Members</p>
            <Badge variant="info">Single</Badge>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-sky-700">{loading ? '...' : singleMembersCount}</p>
          <p className="text-[11px] text-sky-600 font-medium mt-1">129 Members (1 Chit)</p>
        </Card>

        <Card
          onClick={() => {
            setMemberCategoryFilter('multiple');
            setSelectedChitValue(null);
            setSelectedGroupId(null);
            setViewMode('all_members');
          }}
          className={`p-4 sm:p-5 border bg-white rounded-3xl shadow-xs cursor-pointer transition-all hover:border-emerald-300 hover:shadow-md ${memberCategoryFilter === 'multiple' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Multiple Chit Members</p>
            <Badge variant="success">Multiple</Badge>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700">{loading ? '...' : multipleMembersCount}</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">68 Members (Multi Holdings)</p>
        </Card>

        <Card
          onClick={() => {
            setSelectedChitValue(null);
            setSelectedGroupId(null);
            setViewMode('hierarchy');
            setMemberCategoryFilter('all');
          }}
          className="p-4 sm:p-5 border border-slate-200 bg-white rounded-3xl shadow-xs cursor-pointer transition-all hover:border-sky-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Active Chits</p>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">{loading ? '...' : totalActiveChitsCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">283 Active Holdings</p>
        </Card>
      </div>

      {/* SEARCH & HORIZONTALLY SCROLLABLE FILTER BAR */}
      <Card className="p-3.5 sm:p-4 border border-slate-200 bg-white rounded-2xl shadow-xs font-sans">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-md w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search members by name, phone or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim() !== '') {
                  setSelectedChitValue(null);
                  setSelectedGroupId(null);
                }
              }}
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3 h-3" />
              Filter:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { value: 'all', label: `All (${totalMembersCount})` },
                { value: 'single', label: `Single Chit (${singleMembersCount})` },
                { value: 'multiple', label: `Multiple Chits (${multipleMembersCount})` },
                { value: 'due', label: 'Pending Dues' }
              ].map(filterOption => (
                <button
                  key={filterOption.value}
                  onClick={() => {
                    setMemberCategoryFilter(filterOption.value);
                    if (filterOption.value !== 'all') {
                      setSelectedChitValue(null);
                      setSelectedGroupId(null);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    memberCategoryFilter === filterOption.value
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ERROR STATE */}
      {error && (
        <Card className="p-8 border border-red-200 bg-red-50 text-center rounded-3xl">
          <p className="text-sm font-bold text-red-800">{error}</p>
        </Card>
      )}

      {/* LOADING STATE */}
      {loading && !error && (
        <Card className="p-12 border border-slate-200 bg-white text-center rounded-3xl space-y-3">
          <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-600">Loading members and chit collections from Firebase...</p>
        </Card>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && members.length === 0 && (
        <Card className="p-8 border border-slate-200 bg-white text-center rounded-3xl">
          <p className="text-sm font-bold text-slate-700">No members found.</p>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* LEVEL 1: CHIT COLLECTIONS DASHBOARD VIEW (Hierarchy Mode, No Search) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === 'hierarchy' && !selectedChitValue && !isSearchOrFilterActive && (
        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Portfolio Overview</p>
              <h2 className="mt-0.5 text-xl font-bold text-slate-900">Chit Collections & Group-Level Controls</h2>
            </div>
            <span className="text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
              {chitCollections.length} Plan Categories
            </span>
          </div>

          {/* DISPLAY CHIT CATEGORY SECTIONS IN ORDER (₹1 Lakh -> ₹2 Lakh -> ₹5 Lakh) */}
          {chitCollections.map((collection) => (
            <div key={collection.chitValue} className="space-y-4">
              {/* CATEGORY SECTION HEADER */}
              <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black tracking-wide font-sans">
                    {collection.fullFormattedValue} Chits Category
                  </span>
                  <span className="text-xs font-bold text-sky-300 bg-sky-950 px-2.5 py-0.5 rounded-lg border border-sky-800">
                    {collection.groupsCount} Active Groups
                  </span>
                </div>
                <button
                  onClick={() => setSelectedChitValue(collection.chitValue)}
                  className="text-xs font-bold text-sky-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Explore {collection.groupsCount} Groups</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* RESPONSIVE GRID OF ORDERED GROUP CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {collection.groups.map((group) => {
                  const settingKey = `${group.chitValue}_${group.groupId}`;
                  const configuredAmount = groupPaymentSettings[settingKey];
                  const hasConfiguredAmount = typeof configuredAmount === 'number' && configuredAmount > 0;
                  const displayGroupBase = hasConfiguredAmount ? configuredAmount : Math.floor(group.chitValue / 20);

                  return (
                    <div
                      key={group.groupId}
                      onClick={() => {
                        setSelectedChitValue(collection.chitValue);
                        setSelectedGroupId(group.groupId);
                      }}
                      className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-sky-300 active:scale-[0.99] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-lg">
                            Group {group.groupId}
                          </span>
                          <Badge variant="success">ACTIVE</Badge>
                        </div>

                        <h3 className="text-base font-black text-slate-900">Group {group.groupId}</h3>
                        <p className="text-[11px] text-slate-500 font-medium">₹{(group.chitValue / 100000).toFixed(0)} Lakh Chit Base</p>

                        <div className="space-y-1.5 mt-3 text-xs">
                          <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px]">
                            <span className="text-slate-500">Members:</span>
                            <span className="font-bold text-slate-900">{group.uniqueMembersCount}</span>
                          </div>

                          <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px]">
                            <span className="text-slate-500">Group Base Amount:</span>
                            <span className={`font-bold ${hasConfiguredAmount ? 'text-emerald-700 font-mono' : 'text-slate-800 font-mono'}`}>
                              ₹{displayGroupBase.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full justify-center gap-1 rounded-xl text-[10px] font-bold border-sky-200 text-sky-700 hover:bg-sky-50 cursor-pointer py-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditMonthlyAmount(group);
                          }}
                        >
                          <Edit className="w-3 h-3" />
                          Edit Monthly Amount
                        </Button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChitValue(collection.chitValue);
                            setSelectedGroupId(group.groupId);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <span>View</span>
                          <ArrowRight className="w-3 h-3 text-sky-600" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* LEVEL 2: CHIT GROUPS SELECTION VIEW FOR SPECIFIC CATEGORY */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === 'hierarchy' && selectedChitValue && !selectedGroupId && !isSearchOrFilterActive && activeCollection && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl gap-1.5 cursor-pointer text-xs font-bold"
                onClick={() => setSelectedChitValue(null)}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to All Chit Collections
              </Button>
              <h2 className="text-xl font-black text-slate-900">{activeCollection.fullFormattedValue} Active Groups</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {activeCollection.groupsCount} Groups • {activeCollection.uniqueMembersCount} Unique Members
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {activeCollection.groups.map((group) => {
              const settingKey = `${group.chitValue}_${group.groupId}`;
              const configuredAmount = groupPaymentSettings[settingKey];
              const hasConfiguredAmount = typeof configuredAmount === 'number' && configuredAmount > 0;
              const displayGroupBase = hasConfiguredAmount ? configuredAmount : Math.floor(group.chitValue / 20);

              return (
                <div
                  key={group.groupId}
                  onClick={() => setSelectedGroupId(group.groupId)}
                  className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-sky-300 active:scale-[0.99] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-xl">
                        Group {group.groupId}
                      </span>
                      <Badge variant="success">ACTIVE</Badge>
                    </div>

                    <h3 className="text-lg font-black text-slate-900">Group {group.groupId}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">₹{(group.chitValue / 100000).toFixed(0)} Lakh Base Subscription</p>

                    <div className="space-y-2 mt-4 text-xs">
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-medium">Enrolled Members:</span>
                        <span className="font-bold text-slate-900">{group.uniqueMembersCount} Members</span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-medium">Group Base Monthly:</span>
                        <span className={`font-bold ${hasConfiguredAmount ? 'text-emerald-700 font-mono text-sm' : 'text-slate-800 font-mono text-sm'}`}>
                          ₹{displayGroupBase.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* EDIT GROUP MONTHLY AMOUNT BUTTON */}
                      <div className="pt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full justify-center gap-1.5 rounded-xl text-[11px] font-bold border-sky-200 text-sky-700 hover:bg-sky-50 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditMonthlyAmount(group);
                          }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit Monthly Amount
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs font-bold text-sky-600 group-hover:text-sky-800 pt-3 border-t border-slate-100">
                    <span>View Group Members</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* LEVEL 3: GROUP MEMBERS VIEW */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {!loading && !error && viewMode === 'hierarchy' && selectedChitValue && selectedGroupId && !isSearchOrFilterActive && activeGroup && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl gap-1.5 cursor-pointer text-xs font-bold"
                onClick={() => setSelectedGroupId(null)}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to {activeCollection.formattedValue} Groups
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
                {activeGroup.uniqueMembersCount} Members in Group {selectedGroupId}
              </span>
            </div>
          </div>

          {/* GROUP BANNER STATS & GROUP-LEVEL MONTHLY CONTROL */}
          {(() => {
            const groupSettingKey = `${selectedChitValue}_${selectedGroupId}`;
            const configuredMonthly = groupPaymentSettings[groupSettingKey];
            const hasConfiguredMonthly = typeof configuredMonthly === 'number' && configuredMonthly > 0;
            const groupBaseDisplay = hasConfiguredMonthly ? configuredMonthly : Math.floor(selectedChitValue / 20);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900 text-white rounded-3xl p-6 shadow-xl">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Group Category</p>
                  <p className="mt-1 text-2xl font-black">{activeCollection.fullFormattedValue} • Group {selectedGroupId}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Group Base Monthly Amount</p>
                    <button
                      onClick={() => handleOpenEditMonthlyAmount({ chitValue: selectedChitValue, groupId: selectedGroupId })}
                      className="text-[10px] font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3 h-3" /> Edit Base
                    </button>
                  </div>
                  <p className="mt-1 text-2xl font-black text-emerald-400 font-mono">
                    ₹{groupBaseDisplay.toLocaleString('en-IN')} / month
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Group Total Due</p>
                  <p className="mt-1 text-2xl font-black text-amber-400">₹{activeGroup.totalDueAmount.toLocaleString('en-IN')}</p>
                </div>
              </div>
            );
          })()}

          {/* GROUP MEMBER TABLE */}
          <div className="overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Group & Monthly Breakdown</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Month Payable</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeGroup.membersList.map(({ member, chit, quantity }) => {
                  const baseMonthly = getGroupMonthlyBaseAmount(chit.totalChitValue || selectedChitValue, chit.groupId || selectedGroupId);
                  const memberPending = Number(chit.pending || 0);
                  const memberBalance = Number(chit.balance || 0);
                  const currentMonthPayable = calculateChitPayable(chit);

                  return (
                    <tr key={`${member.id}_${chit.id}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {(member?.name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{member?.name || 'Unnamed Member'}</div>
                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1 font-sans">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {member?.phone || 'No Phone'}
                              </span>
                              <Badge variant={getMemberTypeVariant(member)}>{getMemberType(member)}</Badge>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs space-y-1">
                          <div className="font-bold text-slate-900 flex items-center justify-between">
                            <span>₹{(chit.totalChitValue || selectedChitValue).toLocaleString('en-IN')} • Group {chit.groupId || selectedGroupId}</span>
                            {quantity > 1 && <Badge variant="info">+{quantity - 1} Holding</Badge>}
                          </div>
                          <div className="text-slate-600 flex flex-wrap items-center gap-x-3 text-[11px]">
                            <span>Monthly Base: <strong className="font-mono text-slate-900">₹{baseMonthly.toLocaleString('en-IN')}</strong></span>
                            <span>Pending: <strong className="text-amber-700 font-mono">+₹{memberPending.toLocaleString('en-IN')}</strong></span>
                            <span>Balance: <strong className="text-emerald-700 font-mono">-₹{memberBalance.toLocaleString('en-IN')}</strong></span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-base font-black text-slate-900 font-sans">
                          ₹{currentMonthPayable.toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(member.status)}>
                          {formatStatusText(member.status)}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold space-x-2">
                        <Button variant="secondary" size="sm" className="rounded-xl cursor-pointer" onClick={() => handleOpenDetails(member)}>
                          View Details
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-xl cursor-pointer border-sky-300 text-sky-700 hover:bg-sky-50 font-bold"
                          onClick={() => handleOpenEditAdjustment(member, chit)}
                        >
                          ✏ Edit Adjustment
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* DIRECT TABLE / MULTI-CHIT CARDS VIEW */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {!loading && !error && (isSearchOrFilterActive || viewMode === 'all_members') && (
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Showing {filteredMembers.length} {memberCategoryFilter === 'multiple' ? 'Multiple Chit' : (memberCategoryFilter === 'single' ? 'Single Chit' : '')} Members
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl gap-1.5 cursor-pointer text-xs font-bold"
              onClick={() => {
                setSearchQuery('');
                setMemberCategoryFilter('all');
                setViewMode('hierarchy');
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-600" />
              Return to Chit Hierarchy View
            </Button>
          </div>

          {/* DEDICATED MULTIPLE-CHIT MEMBERS CARD LIST VIEW */}
          {memberCategoryFilter === 'multiple' ? (
            <div className="space-y-4 font-sans">
              <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Dedicated Category</span>
                    <h2 className="text-xl font-black text-white">Multiple Chit Members Directory</h2>
                    <p className="text-xs text-slate-300 mt-0.5">Displaying strictly the 68 Multi-Chit members. Each chit holding has independent financial controls.</p>
                  </div>
                  <Badge variant="success" className="self-start sm:self-auto px-3 py-1 text-xs shrink-0">
                    68 Multiple-Chit Members
                  </Badge>
                </div>

                {/* MULTI-CHIT GROUP CATEGORY SUB-FILTERS */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800 overflow-x-auto no-scrollbar">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Group Category Filter:</span>
                  {[
                    { value: 'all', label: 'All Holdings (68)' },
                    { value: '100000', label: '₹1 Lakh Groups' },
                    { value: '200000', label: '₹2 Lakh Groups' },
                    { value: '500000', label: '₹5 Lakh Groups' },
                  ].map((sub) => (
                    <button
                      key={sub.value}
                      onClick={() => setMultiChitGroupFilter(sub.value)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                        multiChitGroupFilter === sub.value
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const multiChitDisplayList = filteredMembers.filter((m) => {
                  if (multiChitGroupFilter === 'all') return true;
                  const targetVal = Number(multiChitGroupFilter);
                  return getActiveChits(m).some((c) => (c.totalChitValue || 100000) === targetVal);
                });

                if (multiChitDisplayList.length === 0) {
                  return (
                    <Card className="p-12 text-center text-slate-500 font-bold text-sm bg-white border border-slate-200 rounded-3xl">
                      No Multiple-Chit members found matching your search or group category selection.
                    </Card>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4">
                    {multiChitDisplayList.map((member) => {
                      const activeChits = getActiveChits(member);
                      const totalHoldingsCount = activeChits.reduce((sum, h) => sum + (h.quantity || 1), 0);

                    return (
                      <Card key={member.id} className="p-5 border border-slate-200 bg-white rounded-3xl shadow-xs space-y-4 hover:border-emerald-300 transition-all">
                        {/* MEMBER HEADER */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                              {(member?.name || 'M').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-base font-black text-slate-900">{member?.name || 'Unnamed Member'}</h3>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                                <span className="flex items-center gap-1 font-sans">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  {member?.phone || 'No Phone'}
                                </span>
                                {member?.whatsapp && (
                                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                                    {member.whatsapp}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black">
                              MULTIPLE • {totalHoldingsCount} Holding{totalHoldingsCount === 1 ? '' : 's'}
                            </span>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="rounded-xl gap-1 cursor-pointer font-bold text-sky-700 hover:bg-sky-50"
                              onClick={() => handleOpenMessage(member)}
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              WhatsApp
                            </Button>
                          </div>
                        </div>

                        {/* INDIVIDUAL HOLDINGS LIST WITH SCOPED EDIT BUTTON FOR EACH HOLDING */}
                        <div className="space-y-2.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Independent Chit Holdings & Financial Controls</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeChits.map((chit) => {
                              const baseMonthly = getGroupMonthlyBaseAmount(chit.totalChitValue || 100000, chit.groupId || 'I');
                              const memberPending = Number(chit.pending || 0);
                              const memberBalance = Number(chit.balance || 0);
                              const chitPayable = calculateChitPayable(chit);

                              return (
                                <div key={chit.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-2 hover:bg-slate-100/70 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-slate-900">
                                        ₹{(chit.totalChitValue / 100000).toFixed(0)}L • Group {chit.groupId}
                                      </span>
                                      {chit.quantity > 1 && (
                                        <span className="bg-emerald-700 text-white font-extrabold px-1.5 py-0.5 rounded-md text-[10px]">
                                          × {chit.quantity} holdings
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="py-1 px-2.5 rounded-lg text-[10px] font-bold border-sky-300 text-sky-700 hover:bg-sky-50 cursor-pointer flex items-center gap-1 shrink-0"
                                      onClick={() => handleOpenEditAdjustment(member, chit)}
                                    >
                                      <Edit className="w-3 h-3" />
                                      Edit Holding
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-xl border border-slate-200/80 text-[11px]">
                                    <div>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Monthly Base</span>
                                      <span className="font-bold text-slate-800 font-mono">₹{baseMonthly.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Pending</span>
                                      <span className="font-bold text-amber-700 font-mono">+₹{memberPending.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Balance</span>
                                      <span className="font-bold text-emerald-700 font-mono">-₹{memberBalance.toLocaleString('en-IN')}</span>
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 text-xs">
                                    <span className="text-slate-500 font-medium">Holding Payable Due:</span>
                                    <span className="font-black text-slate-900 font-mono">₹{chitPayable.toLocaleString('en-IN')}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* CARD FOOTER */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Current Month Payable</span>
                            <span className="text-lg font-black text-slate-900 font-sans">
                              ₹{calculateTotalDue(member).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="rounded-xl font-bold cursor-pointer"
                            onClick={() => handleOpenDetails(member)}
                          >
                            View Profile & Full Ledger
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* DESKTOP DIRECT TABLE VIEW */}
              <div className="hidden md:block overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-xs font-sans">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Member</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Chits & Monthly Breakdown</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Month Payable</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                          No members found matching your search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((member) => {
                        const activeChits = getActiveChits(member);
                        const activeCount = activeChits.length;
                        const memberTotalPayable = calculateTotalDue(member);

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-sky-700 font-black text-sm shrink-0 shadow-xs">
                                  {(member?.name || 'M').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-900">{member?.name || 'Unnamed Member'}</div>
                                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                    <span className="flex items-center gap-1 font-sans">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      {member?.phone || 'No Phone'}
                                    </span>
                                    <Badge variant={getMemberTypeVariant(member)}>{getMemberType(member)}</Badge>
                                    <span className="text-[11px] text-slate-400">{activeCount} Active Chit{activeCount === 1 ? '' : 's'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                {activeChits.length > 0 ? (
                                  activeChits.map((chit) => {
                                    const baseMonthly = getGroupMonthlyBaseAmount(chit.totalChitValue || 100000, chit.groupId || 'I');
                                    const memberPending = Number(chit.pending || 0);
                                    const memberBalance = Number(chit.balance || 0);
                                    const chitPayable = calculateChitPayable(chit);

                                    return (
                                      <div key={chit.id} className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs space-y-1">
                                        <div className="font-bold text-slate-900 flex items-center justify-between">
                                          <span>₹{(chit.totalChitValue || 100000).toLocaleString('en-IN')} • Group {chit.groupId || 'RC-01'}</span>
                                          <span className="font-mono text-emerald-700 font-bold">Payable: ₹{chitPayable.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="text-slate-600 flex flex-wrap items-center gap-x-3 text-[11px]">
                                          <span>Base: ₹{baseMonthly.toLocaleString('en-IN')}</span>
                                          <span>Pending: <strong className="text-amber-700">+₹{memberPending.toLocaleString('en-IN')}</strong></span>
                                          <span>Balance: <strong className="text-emerald-700">-₹{memberBalance.toLocaleString('en-IN')}</strong></span>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-xs text-slate-400">No active chits enrolled</div>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-base font-black text-slate-900 font-sans">
                                ₹{memberTotalPayable.toLocaleString('en-IN')}
                              </span>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={getStatusVariant(member.status)}>
                                {formatStatusText(member.status)}
                              </Badge>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold space-x-2">
                              <Button variant="secondary" size="sm" className="rounded-xl cursor-pointer" onClick={() => handleOpenDetails(member)}>
                                View Details
                              </Button>
                              {activeChits.length > 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="rounded-xl cursor-pointer border-sky-300 text-sky-700 hover:bg-sky-50 font-bold"
                                  onClick={() => handleOpenEditAdjustment(member, activeChits[0])}
                                >
                                  ✏ Edit Adjustment
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE LIST CARDS VIEW */}
              <div className="md:hidden space-y-4 font-sans">
                {filteredMembers.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-sm text-slate-500">
                    No members found matching your search criteria.
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <Card key={member.id} className="border border-slate-200 bg-white rounded-3xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-sky-700 font-black text-xs">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 font-sans">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {member.phone}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getStatusVariant(member.status)}>
                          {formatStatusText(member.status)}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Subscriptions ({getActiveChits(member).length})</p>
                        {getActiveChits(member).map((chit) => {
                          const baseMonthly = getGroupMonthlyBaseAmount(chit.totalChitValue || 100000, chit.groupId || 'I');
                          const memberPending = Number(chit.pending || 0);
                          const memberBalance = Number(chit.balance || 0);
                          const chitPayable = calculateChitPayable(chit);

                          return (
                            <div key={chit.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                              <div className="flex justify-between font-bold text-slate-900">
                                <span>₹{(chit.totalChitValue || 100000).toLocaleString('en-IN')} • Group {chit.groupId || 'RC-01'}</span>
                                <span className="text-emerald-700 font-mono">₹{chitPayable.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-[11px] text-slate-500">
                                <span>Base: ₹{baseMonthly.toLocaleString('en-IN')}</span>
                                <span>Pending: +₹{memberPending} | Bal: -₹{memberBalance}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Month Payable</span>
                          <span className="text-base font-black text-slate-900 font-sans">₹{calculateTotalDue(member).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => handleOpenDetails(member)}>
                            Details
                          </Button>
                          {getActiveChits(member).length > 0 && (
                            <Button variant="secondary" size="sm" className="rounded-xl font-bold text-sky-700" onClick={() => handleOpenEditAdjustment(member, getActiveChits(member)[0])}>
                              Edit Adj
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 1. EDIT GROUP MONTHLY PAYMENT MODAL (GROUP LEVEL) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isEditMonthlyModalOpen && targetGroupForMonthly && (
        <Modal
          isOpen={isEditMonthlyModalOpen}
          onClose={() => setIsEditMonthlyModalOpen(false)}
          title="Edit Group Base Monthly Amount"
          subtitle={`Configure group-level base monthly payment for ${targetGroupForMonthly.fullFormattedValue} • Group ${targetGroupForMonthly.groupId}.`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveMonthlyAmount} className="space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Chit Collection:</span>
                <span className="font-bold text-slate-900">{targetGroupForMonthly.fullFormattedValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Chit Group ID:</span>
                <span className="font-bold text-sky-700 font-mono">Group {targetGroupForMonthly.groupId}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Group Base Monthly Payment Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  required
                  placeholder="e.g. 4500"
                  value={inputMonthlyAmount}
                  onChange={(e) => setInputMonthlyAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 text-sm font-bold bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                This base amount applies to all members in Group {targetGroupForMonthly.groupId}. Individual member pending and balance adjustments remain preserved.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => setIsEditMonthlyModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gold"
                size="sm"
                className="rounded-xl gap-1.5"
                disabled={isSavingMonthlyAmount}
              >
                {isSavingMonthlyAmount ? 'Saving Amount...' : 'Save Base Amount'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 2. EDIT MEMBER PENDING / BALANCE ADJUSTMENT MODAL (MEMBER LEVEL) */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {isEditAdjustmentModalOpen && targetChitForAdjustment && selectedMember && (
        <Modal
          isOpen={isEditAdjustmentModalOpen}
          onClose={() => setIsEditAdjustmentModalOpen(false)}
          title={`Edit Adjustment: ${selectedMember.name}`}
          subtitle={`Modify pending dues or balance credits for Group ${targetChitForAdjustment.groupId || 'I'} (₹${(targetChitForAdjustment.totalChitValue / 100000).toFixed(0)} Lakh Chit).`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveAdjustment} className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Member Pending Amount (Arrears / Unpaid Dues) (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={inputPendingAmount}
                  onChange={(e) => setInputPendingAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 text-sm font-bold bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400">Additional unpaid dues owed by this member.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Member Balance / Credit Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={inputBalanceAmount}
                  onChange={(e) => setInputBalanceAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 text-sm font-bold bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400">Credit / advance balance deducted from current payable.</p>
            </div>

            {/* LIVE CALCULATION PREVIEW PANEL */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Calculation Preview</p>

              <div className="flex justify-between text-slate-300">
                <span>Group Base Monthly Amount:</span>
                <span className="font-mono font-bold">₹{targetChitForAdjustment.baseGroupMonthly.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-amber-400">
                <span>+ Pending Dues:</span>
                <span className="font-mono font-bold">+ ₹{(Math.max(parseFloat(inputPendingAmount) || 0, 0)).toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-emerald-400">
                <span>- Member Credit Balance:</span>
                <span className="font-mono font-bold">- ₹{(Math.max(parseFloat(inputBalanceAmount) || 0, 0)).toLocaleString('en-IN')}</span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black">
                <span className="text-sky-300">Current Month Payable:</span>
                <span className="text-white font-mono text-base">
                  ₹{Math.max(targetChitForAdjustment.baseGroupMonthly + (Math.max(parseFloat(inputPendingAmount) || 0, 0)) - (Math.max(parseFloat(inputBalanceAmount) || 0, 0)), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => setIsEditAdjustmentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gold"
                size="sm"
                className="rounded-xl gap-1.5"
                disabled={isSavingAdjustment}
              >
                {isSavingAdjustment ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MEMBER DETAILS MODAL */}
      {isDetailModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setIsDetailModalOpen(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden z-10 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-sans">Member Profile</h3>
                <p className="text-xs text-slate-500">Complete record, active chits breakdown, and payment ledger history.</p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-200">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-md">
                  {selectedMember.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xl font-black text-slate-900">{selectedMember.name}</h4>
                    <Badge variant={getStatusVariant(selectedMember.status)}>
                      {formatStatusText(selectedMember.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Member ID: <span className="font-mono text-slate-900 font-bold">{selectedMember.id}</span>
                  </p>
                </div>
                <div className="sm:text-right bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Current Month Payable</span>
                  <span className="text-xl font-black text-sky-700 font-sans">
                    {formatCurrency(calculateTotalDue(selectedMember))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contact & Nominee Info</h5>
                  <div className="space-y-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Phone: <strong className="font-bold text-slate-900">{selectedMember.phone}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>WhatsApp: <strong className="font-bold text-slate-900">{selectedMember.whatsapp || selectedMember.phone}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Joining Date: <strong>{selectedMember.joiningDate || '2024-01-01'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Nominee: <strong className="text-slate-900">{selectedMember.nominee || 'Family Member'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Address</h5>
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900">{selectedMember.address || 'Door No. 12-34, Main Road'}</p>
                      <p className="text-slate-500 mt-0.5">{[selectedMember.city, selectedMember.state, selectedMember.pincode].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Current Month Payment Breakdown ({selectedMember.chits.length})
                </h5>

                <div className="space-y-4">
                  {selectedMember.chits.map((chit) => {
                    const displayGroupBase = getGroupMonthlyBaseAmount(chit.totalChitValue || 100000, chit.groupId || 'I');
                    const memberPending = Number(chit.pending || 0);
                    const memberBalance = Number(chit.balance || 0);
                    const currentMonthPayable = calculateChitPayable(chit);

                    return (
                      <div key={chit.id} className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Month Payment Breakdown</p>
                            <h6 className="text-sm font-black text-white mt-0.5">
                              Group: ₹{(chit.totalChitValue / 100000).toFixed(0)} Lakh • Group {chit.groupId || 'I'}
                            </h6>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="rounded-xl text-xs font-bold gap-1.5 border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                            onClick={() => {
                              handleOpenEditAdjustment(selectedMember, chit);
                            }}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit Pending / Balance
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Group Base Monthly</span>
                            <span className="text-base font-black text-slate-200 font-mono">
                              ₹{displayGroupBase.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Member Pending</span>
                            <span className="text-base font-black text-amber-400 font-mono">
                              + ₹{memberPending.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Member Balance</span>
                            <span className="text-base font-black text-emerald-400 font-mono">
                              - ₹{memberBalance.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="bg-slate-950 p-3 rounded-xl border border-sky-500/40">
                            <span className="text-[10px] font-bold text-sky-400 uppercase block">Current Month Payable</span>
                            <span className="text-base font-black text-sky-300 font-mono">
                              ₹{currentMonthPayable.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenEdit(selectedMember)}
                  className="gap-1.5 rounded-xl"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Member Profile
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenMessage(selectedMember);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Send Message
                </Button>
              </div>

              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setIsDetailModalOpen(false)}>
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE PAYMENTS MODAL */}
      {isManageModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setIsManageModalOpen(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden z-10 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-sans">Manage Payments: {selectedMember.name}</h3>
                <p className="text-xs text-slate-500">Update current dues and review ledger history entries.</p>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 font-sans">
                  Select Chit Group to Adjust
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedMember.chits.map(chit => (
                    <button
                      key={chit.id}
                      onClick={() => {
                        setSelectedChitId(chit.id);
                        setNewAmount(calculateChitPayable(chit).toString());
                      }}
                      className={`p-3 border rounded-2xl text-left transition-all text-xs flex flex-col justify-between cursor-pointer ${
                        selectedChitId === chit.id
                          ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-bold text-slate-900">{chit.name}</span>
                      <span className="text-[11px] text-slate-500 mt-1">
                        Current Month Payable: <strong className="text-sky-700 font-bold font-mono">₹{calculateChitPayable(chit).toLocaleString('en-IN')}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedChitId && (
                <form onSubmit={handleUpdatePayment} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Update Ledger Record</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Recorded Due Amount (₹)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">₹</span>
                        <input
                          type="number"
                          required
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold font-sans"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reason / Audit Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Dividend adjustment after auction"
                        value={updateNote}
                        onChange={(e) => setUpdateNote(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" variant="gold" size="sm" className="rounded-xl">
                      Update Ledger Amount
                    </Button>
                  </div>
                </form>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsManageModalOpen(false);
                  handleOpenMessage(selectedMember);
                }}
                className="gap-1.5 rounded-xl"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Generate Notification
              </Button>
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setIsManageModalOpen(false)}>
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MEMBER PROFILE MODAL */}
      {isEditModalOpen && selectedMember && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Profile: ${selectedMember.name}`}
          subtitle="Update contact details, address, and nominee information."
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSaveEditMember} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Member Full Name *</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Phone Number *</label>
              <input
                type="text"
                required
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Address Line</label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nominee Details</label>
              <input
                type="text"
                value={editNominee}
                onChange={(e) => setEditNominee(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" size="sm">
                Save Profile
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MEMBER MESSAGE MODAL */}
      <MemberMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        member={selectedMember}
        onSent={(msg) => showToast(msg)}
        groupPaymentSettings={groupPaymentSettings}
      />

      {/* ADD NEW MEMBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden z-10 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-sans">Add New Member</h3>
                <p className="text-xs text-slate-500">Enter member details and configure initial chit group subscriptions.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="overflow-y-auto max-h-[calc(90vh-128px)]">
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Babu"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {newMemberErrors.name && <p className="text-[10px] text-red-600 mt-1">{newMemberErrors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="e.g. +919876543210"
                      value={newMemberPhone}
                      onChange={(e) => setNewMemberPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {newMemberErrors.phone && <p className="text-[10px] text-red-600 mt-1">{newMemberErrors.phone}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">WhatsApp Number *</label>
                    <input
                      type="tel"
                      placeholder="e.g. +919876543210"
                      value={newMemberWhatsApp}
                      onChange={(e) => setNewMemberWhatsApp(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nominee Details</label>
                    <input
                      type="text"
                      placeholder="e.g. Sita Devi (Wife)"
                      value={newMemberNominee}
                      onChange={(e) => setNewMemberNominee(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">Address Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Address Line *</label>
                      <input
                        type="text"
                        placeholder="Door No. 12-34, Main Road"
                        value={newMemberAddress}
                        onChange={(e) => setNewMemberAddress(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">City / Town</label>
                      <input
                        type="text"
                        placeholder="Guntur"
                        value={newMemberCity}
                        onChange={(e) => setNewMemberCity(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pincode</label>
                      <input
                        type="text"
                        placeholder="522001"
                        value={newMemberPincode}
                        onChange={(e) => setNewMemberPincode(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">Chit Subscriptions</h4>
                      <p className="text-[10px] text-slate-500">Single Chit or Multiple Chits can be configured.</p>
                    </div>
                    <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={addNewChit}>
                      + Add Another Chit
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {newMemberChits.map((chit, index) => (
                      <div key={chit.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900">Chit #{index + 1}</p>
                          {newMemberChits.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeNewChit(chit.id)}
                              className="text-red-600 text-[10px] font-bold uppercase tracking-wider hover:underline"
                            >
                              Remove Chit
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Chit Group</label>
                            <select
                              value={chit.name}
                              onChange={(e) => handleNewMemberChitChange(chit.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="₹1,00,000 Chit (Group RC-01)">₹1,00,000 Chit (RC-01)</option>
                              <option value="₹2,00,000 Chit (Group RC-02)">₹2,00,000 Chit (RC-02)</option>
                              <option value="₹3,00,000 Chit (Group RC-03)">₹3,00,000 Chit (RC-03)</option>
                              <option value="₹5,00,000 Chit (Group RC-05)">₹5,00,000 Chit (RC-05)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Value (₹)</label>
                            <input
                              type="number"
                              value={chit.chitValue}
                              onChange={(e) => handleNewMemberChitChange(chit.id, 'chitValue', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 font-bold"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Initial Due (₹)</label>
                            <input
                              type="number"
                              value={chit.initialAmount}
                              onChange={(e) => handleNewMemberChitChange(chit.id, 'initialAmount', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" className="rounded-xl">
                  Save & Register Member
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
