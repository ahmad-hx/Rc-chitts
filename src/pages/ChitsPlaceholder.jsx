import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Toast from '../components/Toast';
import CreateChitModal from '../components/CreateChitModal';
import Modal from '../components/Modal';
import ChitMonthEditor from '../components/ChitMonthEditor';
import { Calendar, Users, ArrowRight, Plus, Layers, Gavel, CheckCircle2, Trash2, UserPlus, AlertTriangle, Edit, MoreVertical, Clock } from 'lucide-react';
import { chitService, memberService, groupPaymentSettingsService } from '../services/dbService';
import { useNavigate } from 'react-router-dom';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getChitMonth, getChitMonthForGroup, parseMonthYear, formatMonthYearDisplay, FORMATTED_MONTH_NAMES, toYearMonthString } from '../utils/chitMonthUtils';

// Roman numeral parsing helper
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

export default function ChitsPlaceholder() {
  const navigate = useNavigate();
  const { selectedMonth } = useBillingMonth();
  const [chits, setChits] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedChitCategory, setSelectedChitCategory] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChitLedger, setSelectedChitLedger] = useState(null);

  // Overflow menu state
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Group monthly payment edit modal state
  const [isEditMonthlyModalOpen, setIsEditMonthlyModalOpen] = useState(false);
  const [targetGroupForMonthly, setTargetGroupForMonthly] = useState(null);
  const [inputMonthlyAmount, setInputMonthlyAmount] = useState('');
  const [isSavingMonthly, setIsSavingMonthly] = useState(false);

  // Group starting month edit modal state
  const [isEditStartingMonthModalOpen, setIsEditStartingMonthModalOpen] = useState(false);
  const [targetGroupForStartingMonth, setTargetGroupForStartingMonth] = useState(null);
  const [inputStartingMonth, setInputStartingMonth] = useState('March');
  const [inputStartingYear, setInputStartingYear] = useState('2026');
  const [isSavingStartingMonth, setIsSavingStartingMonth] = useState(false);

  // Delete group modal state
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    let mounted = true;
    async function loadChitData() {
      setLoading(true);
      setError(null);
      try {
        const [fetchedChits, fetchedMembers, settingsRes] = await Promise.all([
          chitService.getChits(),
          memberService.getMembers(),
          groupPaymentSettingsService.getGroupPaymentSettings().catch(() => ({ settingsMap: {} })),
        ]);
        if (mounted) {
          setChits(Array.isArray(fetchedChits) ? fetchedChits : []);
          setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
          setGroupPaymentSettings(settingsRes?.settingsMap || {});
        }
      } catch (e) {
        if (mounted) {
          setError('Unable to load data from Firebase.');
          setChits([]);
          setMembers([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadChitData();
    return () => {
      mounted = false;
    };
  }, []);

  const getGroupMonthlyPremium = (group) => {
    const val = Number(group?.totalChitValue || 100000);
    const grp = String(group?.groupId || 'I').trim().toUpperCase();
    const key = `${val}_${grp}`;
    if (typeof groupPaymentSettings[key] === 'number' && groupPaymentSettings[key] > 0) {
      return groupPaymentSettings[key];
    }
    return Number(group?.monthlyPremium || Math.floor(val / 20));
  };

  const handleChitCreated = async (newGroup) => {
    try {
      const saved = await chitService.createChit(newGroup);
      setChits((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const existingFiltered = safePrev.filter(
          (c) =>
            !(
              String(c.groupId).toUpperCase() === String(saved.groupId).toUpperCase() &&
              Number(c.totalChitValue || 100000) === Number(saved.totalChitValue || 100000)
            )
        );
        return [saved, ...existingFiltered];
      });
      showToast(`✓ Chit Group ${newGroup.groupId} (${newGroup.name}) created and saved to Firebase!`, 'success');
      
      // Reload chits to ensure complete synchronization with all member groups and Firestore documents
      const fetched = await chitService.getChits().catch(() => null);
      if (Array.isArray(fetched) && fetched.length > 0) {
        setChits(fetched);
      }
    } catch (err) {
      showToast(`Failed to save chit group: ${err.message}`, 'error');
      throw err;
    }
  };

  const getEnrolledMembers = (groupId, chitValue = null) => {
    const targetGrp = String(groupId || '').trim().toUpperCase();
    const targetVal = chitValue ? Number(chitValue) : null;
    const safeMembers = Array.isArray(members) ? members.filter(Boolean) : [];
    return safeMembers.filter((m) =>
      (m.chits || []).some((c) => {
        const cGrp = String(c?.groupId || c?.group || '').trim().toUpperCase();
        const cVal = Number(c?.totalChitValue || c?.totalValue || c?.chitValue || 100000);
        if (targetVal) {
          return cGrp === targetGrp && cVal === targetVal;
        }
        return cGrp === targetGrp || (c.name && c.name.includes(groupId));
      })
    );
  };

  const handleViewMembers = (group) => {
    const targetGroupId = group?.groupId || group?.id || group?.group;
    if (!targetGroupId) {
      console.error("[View Members Error] Group ID is missing for group:", group);
      showToast("Unable to open this group's members. Group ID is missing.", "error");
      return;
    }
    const category = group?.totalChitValue || 100000;
    navigate(`/members?group=${encodeURIComponent(targetGroupId)}&category=${encodeURIComponent(category)}`);
  };

  const handleAddMemberForGroup = (group) => {
    const targetGroupId = group?.groupId || group?.id || group?.group;
    if (!targetGroupId) {
      console.error("[Add Member Error] Group ID is missing for group:", group);
      showToast("Unable to open add member. Group ID is missing.", "error");
      return;
    }
    const category = group?.totalChitValue || 100000;
    navigate(`/members?group=${encodeURIComponent(targetGroupId)}&category=${encodeURIComponent(category)}&action=add`);
  };

  const handleOpenEditMonthly = (group) => {
    const val = Number(group?.totalChitValue || 100000);
    const grp = String(group?.groupId || 'I').trim().toUpperCase();
    const current = getGroupMonthlyPremium(group);

    setTargetGroupForMonthly({
      chitValue: val,
      groupId: grp,
      fullFormattedValue: `₹${(val / 100000).toFixed(0)} Lakh Group ${grp}`,
    });
    setInputMonthlyAmount(String(current));
    setIsEditMonthlyModalOpen(true);
    setActiveMenuId(null);
  };

  const handleOpenEditStartingMonth = (group) => {
    const val = Number(group?.totalChitValue || 100000);
    const grp = String(group?.groupId || 'I').trim().toUpperCase();
    const currentStart = group?.startingMonth || 'March 2026';
    const parsed = parseMonthYear(currentStart) || { month: 2, year: 2026 };

    setTargetGroupForStartingMonth({
      id: group?.id,
      chitValue: val,
      groupId: grp,
      fullFormattedValue: `₹${(val / 100000).toFixed(0)} Lakh Group ${grp}`,
      startingMonth: currentStart,
    });
    setInputStartingMonth(FORMATTED_MONTH_NAMES[parsed.month] || 'March');
    setInputStartingYear(String(parsed.year || 2026));
    setIsEditStartingMonthModalOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveMonthlyAmount = async (e) => {
    e.preventDefault();
    if (!targetGroupForMonthly) return;

    const parsedAmount = parseFloat(inputMonthlyAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Please enter a valid monthly amount.', 'error');
      return;
    }

    setIsSavingMonthly(true);
    try {
      await groupPaymentSettingsService.saveGroupPaymentSetting({
        chitValue: targetGroupForMonthly.chitValue,
        groupId: targetGroupForMonthly.groupId,
        monthlyAmount: parsedAmount,
      });

      const key = `${targetGroupForMonthly.chitValue}_${targetGroupForMonthly.groupId}`;
      setGroupPaymentSettings((prev) => ({ ...prev, [key]: parsedAmount }));
      setIsEditMonthlyModalOpen(false);
      showToast(`Monthly payment for Group ${targetGroupForMonthly.groupId} set to ₹${parsedAmount.toLocaleString('en-IN')}!`);
    } catch (err) {
      showToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setIsSavingMonthly(false);
    }
  };

  const handleSaveStartingMonth = async (e) => {
    e.preventDefault();
    if (!targetGroupForStartingMonth) return;

    const cleanYear = parseInt(inputStartingYear, 10);
    if (isNaN(cleanYear) || cleanYear < 2000 || cleanYear > 2100) {
      showToast('Please enter a valid starting year (e.g. 2026).', 'error');
      return;
    }

    const isoStartingMonth = toYearMonthString(inputStartingMonth, cleanYear);
    const formattedDisplay = `${inputStartingMonth} ${cleanYear}`;

    setIsSavingStartingMonth(true);
    try {
      await chitService.updateChitGroupStartingMonth(
        targetGroupForStartingMonth.groupId,
        targetGroupForStartingMonth.chitValue,
        isoStartingMonth,
        targetGroupForStartingMonth.id
      );

      setChits((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.map((c) => {
          const matchId = targetGroupForStartingMonth.id && c.id === targetGroupForStartingMonth.id;
          const matchKey =
            String(c.groupId).trim().toUpperCase() === String(targetGroupForStartingMonth.groupId).trim().toUpperCase() &&
            Number(c.totalChitValue || 100000) === Number(targetGroupForStartingMonth.chitValue);
          if (matchId || matchKey) {
            return { ...c, startingMonth: isoStartingMonth };
          }
          return c;
        });
      });

      setIsEditStartingMonthModalOpen(false);
      showToast(`✓ Starting month for Group ${targetGroupForStartingMonth.groupId} updated to ${formattedDisplay}!`);
    } catch (err) {
      showToast(`Failed to save starting month: ${err.message}`, 'error');
    } finally {
      setIsSavingStartingMonth(false);
    }
  };

  const handleOpenDeleteModal = (group) => {
    setActiveMenuId(null);
    setDeletingGroup(group);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deletingGroup) return;
    setIsDeletingGroup(true);
    try {
      await chitService.deleteChitGroup(
        deletingGroup.groupId,
        deletingGroup.totalChitValue,
        deletingGroup.id
      );

      setChits((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter(
          (c) =>
            c.id !== deletingGroup.id &&
            !(
              String(c.groupId).trim().toUpperCase() === String(deletingGroup.groupId).trim().toUpperCase() &&
              Number(c.totalChitValue || 100000) === Number(deletingGroup.totalChitValue || 100000)
            )
        );
      });

      showToast('Chit group deleted successfully.', 'success');
      setDeletingGroup(null);
    } catch (err) {
      showToast(`Failed to delete group: ${err.message}`, 'error');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Sort and filter chits
  const filteredChits = useMemo(() => {
    const safeGroups = Array.isArray(chits) ? chits.filter(Boolean) : [];
    let list = safeGroups.filter((c) => c.status !== 'ARCHIVED');

    if (selectedChitCategory !== 'all') {
      list = list.filter((c) => {
        const val = Number(c.totalChitValue || c.totalValue || c.chitValue || 100000);
        return String(val) === String(selectedChitCategory);
      });
    }

    return list.sort((a, b) => compareGroupIds(a.groupId, b.groupId));
  }, [chits, selectedChitCategory]);

  return (
    <div className="space-y-6 md:space-y-8 font-sans" onClick={() => setActiveMenuId(null)}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#285F52]">Portfolio</p>
          <h1 className="text-2xl md:text-3xl font-black text-[#111111]">Chit Fund Groups</h1>
          <p className="text-xs text-[#667085] mt-1">
            Ordered group navigation, dynamic Chit Month calculation ({selectedMonth}), capacity tracking, and audit ledgers.
          </p>
        </div>
        <Button
          variant="primary"
          className="gap-2 rounded-xl cursor-pointer bg-[#285F52] hover:bg-[#214D43] text-white whitespace-nowrap shrink-0 px-4 py-2.5 text-xs font-bold"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">+ Create Chit Group</span>
        </Button>
      </div>

      {/* CATEGORY TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar min-w-0">
        {[
          { value: 'all', label: 'All Chit Groups' },
          { value: '100000', label: '₹1 Lakh Chits' },
          { value: '200000', label: '₹2 Lakh Chits' },
          { value: '500000', label: '₹5 Lakh Chits' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedChitCategory(tab.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              selectedChitCategory === tab.value
                ? 'bg-[#285F52] text-white border-[#285F52] shadow-xs'
                : 'bg-white text-[#111111] border-[#E5E7EB] hover:bg-[#F7F8F7]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CHIT GROUP CARDS GRID */}
      {loading ? (
        <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white border border-[#E5E7EB] rounded-2xl">
          Loading chit fund groups...
        </Card>
      ) : filteredChits.length === 0 ? (
        <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white border border-[#E5E7EB] rounded-2xl">
          No chit groups found for the selected category.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full min-w-0">
          {filteredChits.map((group) => {
            const enrolled = getEnrolledMembers(group.groupId, group.totalChitValue);
            const enrolledCount = enrolled.length;
            const monthlyPremium = getGroupMonthlyPremium(group);
            const isMenuOpen = activeMenuId === group.id;
            const chitMonthInfo = getChitMonthForGroup(group, selectedMonth);

            return (
              <Card key={group.id} className="border border-[#E5E7EB] bg-white rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 relative min-w-0">
                {/* TOP ROW: Group Name, Roman Numeral, Capacity Badge, Chit Month Badge & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-extrabold font-mono text-[#285F52] bg-[#EEF6F3] px-2.5 py-1 rounded-lg border border-[#BFD8D0] shrink-0">
                      Group {group.groupId || 'I'}
                    </span>
                    <h3 className="text-base font-black text-[#111111] truncate min-w-0">
                      {group.name || `₹${((group.totalChitValue || 100000) / 100000).toFixed(0)} Lakh Chit (Group ${group.groupId || 'I'})`}
                    </h3>
                  </div>

                  <div className="shrink-0 self-start sm:self-auto">
                    <Badge variant="active" dot>ACTIVE</Badge>
                  </div>
                </div>

                <p className="text-xs text-[#667085] font-medium leading-relaxed">
                  Value: <span className="font-bold text-[#111111]">₹{(group.totalChitValue || 100000).toLocaleString('en-IN')}</span> • Starts: <span className="font-bold text-[#111111]">{formatMonthYearDisplay(group.startingMonth || 'March 2026')}</span>
                </p>

                {/* 3-COLUMN METRICS: CHIT MONTH, MEMBERS, MONTHLY AMOUNT */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 border-y border-[#E5E7EB] text-xs bg-[#F7F8F7] rounded-xl px-3 sm:px-4 text-center min-w-0">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#667085] block truncate">
                      CHIT MONTH
                    </span>
                    <div className="flex items-center justify-center min-w-0 pt-0.5">
                      <ChitMonthEditor
                        currentMonth={chitMonthInfo.currentMonth}
                        totalMonths={group.capacity || 20}
                        onSave={async (newMonth) => {
                          await chitService.updateChitGroupMonth(
                            group.groupId,
                            group.totalChitValue,
                            newMonth,
                            group.id
                          );
                          setChits((prev) =>
                            (Array.isArray(prev) ? prev : []).map((c) => {
                              const matchId = group.id && c.id === group.id;
                              const matchKey =
                                String(c.groupId).trim().toUpperCase() === String(group.groupId).trim().toUpperCase() &&
                                Number(c.totalChitValue || 100000) === Number(group.totalChitValue || 100000);
                              if (matchId || matchKey) {
                                return { ...c, currentChitMonth: newMonth };
                              }
                              return c;
                            })
                          );
                          showToast(`✓ Chit Month for Group ${group.groupId} updated to ${newMonth}/${group.capacity || 20}!`);
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 border-x border-[#E5E7EB] px-1 sm:px-2 min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#667085] block truncate">
                      MEMBERS
                    </span>
                    <span className="text-xs sm:text-sm font-black text-[#111111] block whitespace-nowrap pt-0.5">
                      {enrolledCount} / {group.capacity || 20}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#667085] block truncate">
                      MONTHLY AMOUNT
                    </span>
                    <span className="text-xs sm:text-sm font-black text-[#285F52] block whitespace-nowrap pt-0.5">
                      ₹{monthlyPremium.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* BOTTOM ROW ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl border-[#E5E7EB] text-[#111111] hover:bg-[#F7F8F7] font-bold whitespace-nowrap shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditMonthly(group);
                      }}
                    >
                      <Edit className="w-3.5 h-3.5 text-[#667085] shrink-0" />
                      <span>Edit Monthly</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl border-[#BFD8D0] bg-[#EEF6F3] text-[#285F52] hover:bg-[#285F52] hover:text-white font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddMemberForGroup(group);
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>+ Add Member</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* THREE-DOT OVERFLOW MENU */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : group.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] hover:bg-[#E5E7EB] cursor-pointer transition-colors shrink-0"
                        title="More Actions"
                      >
                        <MoreVertical className="w-4 h-4 text-[#667085] shrink-0" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-11 z-30 w-52 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-xl text-xs space-y-1 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChitLedger(group);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#111111] hover:bg-[#F7F8F7] font-bold cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5 text-[#285F52]" />
                            View Group Ledger
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditStartingMonth(group)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#111111] hover:bg-[#F7F8F7] font-bold cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5 text-[#285F52]" />
                            Edit Starting Month
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(group)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#B42318] hover:bg-[#FEF3F2] font-bold cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#B42318]" />
                            Delete Group
                          </button>
                        </div>
                      )}
                    </div>

                    {/* PRIMARY ACTION ON RIGHT: View Members → */}
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1.5 rounded-xl bg-[#285F52] hover:bg-[#214D43] text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
                      onClick={() => handleViewMembers(group)}
                    >
                      <span>View Members</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE CHIT MODAL */}
      <CreateChitModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleChitCreated} />

      {/* EDIT GROUP MONTHLY PAYMENT MODAL */}
      {isEditMonthlyModalOpen && (
        <Modal
          isOpen={isEditMonthlyModalOpen}
          onClose={() => setIsEditMonthlyModalOpen(false)}
          title="Edit Group Monthly Payment"
          subtitle={`Modifies group-level monthly payment for ${targetGroupForMonthly?.fullFormattedValue}.`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveMonthlyAmount} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Group Monthly Premium (₹)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={inputMonthlyAmount}
                onChange={(e) => setInputMonthlyAmount(e.target.value)}
                placeholder="e.g. 4900"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Note: This changes the base payment for all members in Group {targetGroupForMonthly?.groupId}. Individual pending and balance adjustments remain unchanged.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditMonthlyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSavingMonthly}>
                {isSavingMonthly ? 'Saving...' : 'Save Group Monthly Amount'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT GROUP STARTING MONTH MODAL */}
      {isEditStartingMonthModalOpen && targetGroupForStartingMonth && (() => {
        const combinedDateStr = `${inputStartingMonth} ${inputStartingYear}`;
        const calculatedPreview = getChitMonth(combinedDateStr, selectedMonth);

        return (
          <Modal
            isOpen={isEditStartingMonthModalOpen}
            onClose={() => !isSavingStartingMonth && setIsEditStartingMonthModalOpen(false)}
            title="Edit Starting Month"
            subtitle={`Set manual starting Month and Year for ${targetGroupForStartingMonth?.fullFormattedValue}.`}
            maxWidth="max-w-md"
          >
            <form onSubmit={handleSaveStartingMonth} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                    Starting Month *
                  </label>
                  <select
                    value={inputStartingMonth}
                    onChange={(e) => setInputStartingMonth(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52] cursor-pointer"
                  >
                    {FORMATTED_MONTH_NAMES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                    Starting Year *
                  </label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2040"
                    step="1"
                    placeholder="e.g. 2026"
                    value={inputStartingYear}
                    onChange={(e) => setInputStartingYear(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-[#F7F8F7] border border-[#E5E7EB] rounded-xl text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#285F52]"
                  />
                </div>
              </div>

              {/* LIVE PREVIEW SECTION */}
              <div className="p-3.5 bg-[#EEF6F3] border border-[#BFD8D0] rounded-xl space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#285F52]">
                  Preview
                </p>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#BFD8D0]">
                  <span className="text-[#667085] font-semibold">Selected Starting Date:</span>
                  <span className="font-bold text-[#111111]">{inputStartingMonth} {inputStartingYear}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#667085] font-semibold">Current Selected Month:</span>
                  <span className="font-bold text-[#111111]">{selectedMonth}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#BFD8D0]">
                  <span className="text-[#285F52] font-extrabold uppercase tracking-wider">Chit Month:</span>
                  <span className="font-black text-[#285F52] bg-white px-2.5 py-0.5 rounded-lg border border-[#BFD8D0] text-sm">
                    {calculatedPreview.display}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#667085] leading-relaxed">
                ℹ The selected starting month is Chit Month 1. The Chit Month automatically recalculates across all group cards, member tables, and WhatsApp payment reminders.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditStartingMonthModalOpen(false)}
                  disabled={isSavingStartingMonth}
                  className="rounded-xl border-[#E5E7EB]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="bg-[#285F52] hover:bg-[#214D43] text-white font-bold rounded-xl cursor-pointer"
                  disabled={isSavingStartingMonth}
                >
                  {isSavingStartingMonth ? 'Saving...' : 'Save Starting Month'}
                </Button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* SAFE DELETE GROUP MODAL */}
      {deletingGroup && (() => {
        const assignedMembers = getEnrolledMembers(deletingGroup.groupId, deletingGroup.totalChitValue);
        const hasMembers = assignedMembers.length > 0;

        return (
          <Modal
            isOpen={!!deletingGroup}
            onClose={() => !isDeletingGroup && setDeletingGroup(null)}
            title={hasMembers ? 'Cannot Delete Chit Group' : 'Delete Chit Group?'}
            subtitle={
              hasMembers
                ? `Group ${deletingGroup.groupId} (₹${(deletingGroup.totalChitValue / 100000).toFixed(0)} Lakh) currently has ${assignedMembers.length} active member(s) assigned.`
                : `Permanently delete ${deletingGroup.name} (Group ${deletingGroup.groupId}).`
            }
            maxWidth="max-w-md"
          >
            {hasMembers ? (
              <div className="space-y-4 font-sans text-xs">
                <div className="p-3.5 bg-[#FFF8E7] border border-[#FDE68A] rounded-xl flex items-start gap-3 text-[#B7791F]">
                  <AlertTriangle className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      This group cannot be deleted because members are currently assigned to it.
                    </p>
                    <p className="text-[11px] text-[#B7791F]">
                      You must remove or reassign all <strong>{assignedMembers.length} member(s)</strong> from this group before it can be deleted.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                    Assigned Members ({assignedMembers.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#E5E7EB] rounded-xl p-2 bg-[#F7F8F7]">
                    {assignedMembers.slice(0, 8).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs p-1.5 bg-white rounded-lg border border-[#E5E7EB]">
                        <span className="font-bold text-[#111111] truncate">{m.name}</span>
                        <Badge variant={m.classification === 'MULTIPLE' ? 'purple' : 'info'} className="text-[9px]">
                          {m.classification === 'MULTIPLE' ? 'Multi-Chit' : 'Single Chit'}
                        </Badge>
                      </div>
                    ))}
                    {assignedMembers.length > 8 && (
                      <p className="text-[10px] text-center text-[#667085] pt-1">
                        + {assignedMembers.length - 8} more members
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDeletingGroup(null)}
                    className="rounded-xl border-[#E5E7EB]"
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const grp = deletingGroup;
                      setDeletingGroup(null);
                      handleViewMembers(grp);
                    }}
                    className="rounded-xl bg-[#285F52] hover:bg-[#214D43] text-white font-bold"
                  >
                    View Members
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 font-sans text-xs">
                <div className="p-3.5 bg-[#FEF3F2] border border-[#FECACA] rounded-xl flex items-start gap-3 text-[#B42318]">
                  <Trash2 className="w-5 h-5 text-[#B42318] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      Are you sure you want to permanently delete Group {deletingGroup.groupId}?
                    </p>
                    <p className="text-[11px] text-[#B42318]">
                      This action cannot be undone. Historical financial records and past ledger history will remain preserved in History.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F7F8F7] rounded-xl border border-[#E5E7EB] space-y-1">
                  <p className="font-bold text-[#111111]">{deletingGroup.name}</p>
                  <p className="text-[11px] text-[#667085]">
                    Total Chit Value: ₹{(deletingGroup.totalChitValue || 100000).toLocaleString('en-IN')} • Starting Month: {deletingGroup.startingMonth || 'March 2026'}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isDeletingGroup}
                    onClick={() => setDeletingGroup(null)}
                    className="rounded-xl border-[#E5E7EB]"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isDeletingGroup}
                    onClick={handleConfirmDeleteGroup}
                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                  >
                    {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        );
      })()}

      {/* VIEW LEDGER MODAL */}
      {selectedChitLedger && (
        <Modal
          isOpen={!!selectedChitLedger}
          onClose={() => setSelectedChitLedger(null)}
          title={`Chit Ledger: ${selectedChitLedger.name}`}
          subtitle={`Group ID: ${selectedChitLedger?.groupId || 'N/A'} • Total Value: ₹${(selectedChitLedger?.totalChitValue || 100000).toLocaleString('en-IN')}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Group Monthly</span>
                <span className="font-black text-sky-700 text-sm font-sans">₹{getGroupMonthlyPremium(selectedChitLedger).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                <span className="font-bold text-slate-900 text-sm">{selectedChitLedger.duration || '20 Months'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Enrolled Members</span>
                <span className="font-bold text-slate-900 text-sm">{getEnrolledMembers(selectedChitLedger.groupId).length || 18} / {selectedChitLedger.capacity || 20}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next Auction Date</span>
                <span className="font-bold text-emerald-700 text-sm font-mono">{selectedChitLedger.nextAuctionDate || '15th of Month'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-600" />
                Enrolled Members ({getEnrolledMembers(selectedChitLedger.groupId).length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {getEnrolledMembers(selectedChitLedger.groupId).map((m) => (
                  <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{m.name}</p>
                      <p className="text-[10px] text-slate-500 font-sans">{m.phone}</p>
                    </div>
                    <Badge variant={m.status === 'active' ? 'success' : 'warning'}>
                      {m.status ? m.status.toUpperCase() : 'ACTIVE'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setSelectedChitLedger(null)}>
                Close Ledger
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
