import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Toast from '../components/Toast';
import CreateChitModal from '../components/CreateChitModal';
import Modal from '../components/Modal';
import { Calendar, Users, ArrowRight, Plus, Layers, Gavel, CheckCircle2, Archive, Edit, MoreVertical, Clock } from 'lucide-react';
import { chitService, memberService, groupPaymentSettingsService } from '../services/dbService';
import { useNavigate } from 'react-router-dom';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getChitMonth, getStandardMonthOptions } from '../utils/chitMonthUtils';

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
  const [inputStartingMonth, setInputStartingMonth] = useState('March 2026');
  const [isSavingStartingMonth, setIsSavingStartingMonth] = useState(false);

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
    const val = group?.totalChitValue || 100000;
    const grp = group?.groupId || 'I';
    const key = `${val}_${grp}`;
    if (typeof groupPaymentSettings[key] === 'number' && groupPaymentSettings[key] > 0) {
      return groupPaymentSettings[key];
    }
    return group?.monthlyPremium || Math.floor(val / 20);
  };

  const handleChitCreated = async (newGroup) => {
    try {
      const saved = await chitService.createChit(newGroup);
      setChits((prev) => [saved, ...prev.filter((c) => c.groupId !== saved.groupId || c.totalChitValue !== saved.totalChitValue)]);
      showToast(`✓ Chit Group ${newGroup.groupId} (${newGroup.name}) created and saved to Firebase!`, 'success');
      // Reload chits to ensure complete synchronization
      const fetched = await chitService.getChits().catch(() => null);
      if (fetched) setChits(fetched);
    } catch (err) {
      showToast(`Failed to save chit group: ${err.message}`, 'error');
      throw err;
    }
  };

  const getEnrolledMembers = (groupId) => {
    return members.filter((m) =>
      (m.chits || []).some((c) => c.groupId === groupId || (c.name && c.name.includes(groupId)))
    );
  };

  const handleOpenEditMonthly = (group) => {
    const val = group?.totalChitValue || 100000;
    const grp = group?.groupId || 'I';
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
    const val = group?.totalChitValue || 100000;
    const grp = group?.groupId || 'I';
    const currentStart = group?.startingMonth || 'March 2026';

    setTargetGroupForStartingMonth({
      id: group?.id,
      chitValue: val,
      groupId: grp,
      fullFormattedValue: `₹${(val / 100000).toFixed(0)} Lakh Group ${grp}`,
      startingMonth: currentStart,
    });
    setInputStartingMonth(currentStart);
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

    setIsSavingStartingMonth(true);
    try {
      await chitService.updateChitGroupStartingMonth(
        targetGroupForStartingMonth.groupId,
        targetGroupForStartingMonth.chitValue,
        inputStartingMonth
      );

      setChits((prev) =>
        prev.map((c) => {
          if (
            String(c.groupId).toLowerCase() === String(targetGroupForStartingMonth.groupId).toLowerCase() &&
            Number(c.totalChitValue || 100000) === Number(targetGroupForStartingMonth.chitValue)
          ) {
            return { ...c, startingMonth: inputStartingMonth };
          }
          return c;
        })
      );

      setIsEditStartingMonthModalOpen(false);
      showToast(`✓ Starting month for Group ${targetGroupForStartingMonth.groupId} updated to ${inputStartingMonth}!`);
    } catch (err) {
      showToast(`Failed to save starting month: ${err.message}`, 'error');
    } finally {
      setIsSavingStartingMonth(false);
    }
  };

  const handleArchiveGroup = async (group) => {
    setActiveMenuId(null);
    if (!group) return;
    const val = group.totalChitValue || 100000;
    const grp = group.groupId || 'I';

    if (window.confirm(`Archive Group ${grp} (₹${(val / 100000).toFixed(0)} Lakh)?\n\nAll historical payment records will remain safely preserved in History.`)) {
      try {
        await chitService.archiveGroup(grp, val, group);
        setChits((prev) => prev.filter((c) => c.id !== group.id));
        showToast(`Group ${grp} archived and preserved in History.`);
      } catch (err) {
        showToast(`Failed to archive group: ${err.message}`, 'error');
      }
    }
  };

  // Sort and filter chits
  const filteredChits = useMemo(() => {
    let list = chits.filter((c) => c.status !== 'ARCHIVED');

    if (selectedChitCategory !== 'all') {
      list = list.filter((c) => String(c.totalChitValue || 100000) === String(selectedChitCategory));
    }

    return list.sort((a, b) => compareGroupIds(a.groupId, b.groupId));
  }, [chits, selectedChitCategory]);

  return (
    <div className="space-y-6 md:space-y-8 font-sans" onClick={() => setActiveMenuId(null)}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E1] pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2F5D50]">Portfolio</p>
          <h1 className="text-2xl md:text-3xl font-black text-[#1C1C1A]">Chit Fund Groups</h1>
          <p className="text-xs text-[#6B6B67] mt-1">
            Ordered group navigation, dynamic Chit Month calculation ({selectedMonth}), capacity tracking, and audit ledgers.
          </p>
        </div>
        <Button variant="primary" className="gap-2 rounded-xl cursor-pointer bg-[#2F5D50] hover:bg-[#24493F] text-white" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Create Chit Group
        </Button>
      </div>

      {/* CATEGORY TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { value: 'all', label: 'All Chit Groups' },
          { value: '100000', label: '₹1 Lakh Chits' },
          { value: '200000', label: '₹2 Lakh Chits' },
          { value: '500000', label: '₹5 Lakh Chits' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedChitCategory(tab.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              selectedChitCategory === tab.value
                ? 'bg-[#2F5D50] text-white border-[#2F5D50] shadow-xs'
                : 'bg-white text-[#1C1C1A] border-[#E5E5E1] hover:bg-[#F7F7F5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CHIT GROUP CARDS GRID */}
      {loading ? (
        <Card className="p-12 text-center text-[#6B6B67] font-bold text-sm bg-white border border-[#E5E5E1] rounded-2xl">
          Loading chit fund groups...
        </Card>
      ) : filteredChits.length === 0 ? (
        <Card className="p-12 text-center text-[#6B6B67] font-bold text-sm bg-white border border-[#E5E5E1] rounded-2xl">
          No chit groups found for the selected category.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredChits.map((group) => {
            const enrolled = getEnrolledMembers(group.groupId);
            const enrolledCount = enrolled.length || group.currentMembers || 18;
            const monthlyPremium = getGroupMonthlyPremium(group);
            const isMenuOpen = activeMenuId === group.id;
            const chitMonthInfo = getChitMonth(group.startingMonth || 'March 2026', selectedMonth);

            return (
              <Card key={group.id} className="border border-[#E5E5E1] bg-white rounded-2xl p-6 shadow-xs space-y-4 relative">
                {/* TOP ROW: Group Name, Roman Numeral, Capacity Badge, Chit Month Badge & Status */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold font-mono text-[#2F5D50] bg-[#DDE8E2] px-2 py-0.5 rounded-lg border border-[#2F5D50]/20">
                        Group {group.groupId || 'I'}
                      </span>
                      <h3 className="text-base font-black text-[#1C1C1A]">{group.name}</h3>
                    </div>
                    <p className="text-xs text-[#6B6B67] mt-1 font-medium">
                      Duration: {group.duration || '20 Months'} • Starts: {group.startingMonth || 'March 2026'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <span className="text-xs font-black text-[#2F5D50] bg-[#EDF7F0] px-2.5 py-1 rounded-full border border-[#2F5D50]/20 flex items-center gap-1.5 shadow-xs">
                      <Calendar className="w-3.5 h-3.5 text-[#2F5D50]" />
                      <span>Chit Month {chitMonthInfo.display}</span>
                    </span>
                    <span className="text-xs font-bold text-[#1C1C1A] bg-[#F2F2EF] px-2.5 py-1 rounded-full border border-[#E5E5E1] flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#6B6B67]" />
                      {enrolledCount} / {group.capacity || 20}
                    </span>
                    <Badge variant="success">ACTIVE</Badge>
                  </div>
                </div>

                {/* MIDDLE 2-COLUMN STRUCTURED INFORMATION SECTION */}
                <div className="grid grid-cols-2 gap-4 py-3.5 border-y border-[#E5E5E1] text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6B6B67]">Monthly Premium</span>
                    <span className="text-base font-black text-[#2F5D50] font-sans block">
                      ₹{monthlyPremium.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6B6B67]">Total Chit Value</span>
                    <span className="text-base font-black text-[#1C1C1A] font-sans block">
                      ₹{(group?.totalChitValue || 100000).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* BOTTOM ROW ACTION BAR: [ Edit Monthly ] [ ⋮ ] [ View Members → ] */}
                <div className="flex items-center justify-between gap-3 text-xs pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl border-[#E5E5E1] text-[#1C1C1A] hover:bg-[#F7F7F5] font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditMonthly(group);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5 text-[#6B6B67]" />
                    Edit Monthly
                  </Button>

                  <div className="flex items-center gap-2.5">
                    {/* THREE-DOT OVERFLOW MENU (Section 5) */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : group.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] text-[#1C1C1A] hover:bg-[#E5E5E1] cursor-pointer transition-colors"
                        title="More Actions"
                      >
                        <MoreVertical className="w-4 h-4 text-[#6B6B67]" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-11 z-30 w-52 rounded-xl border border-[#E5E5E1] bg-white p-1.5 shadow-xl text-xs space-y-1 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChitLedger(group);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#1C1C1A] hover:bg-[#F2F2EF] font-bold cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5 text-[#2F5D50]" />
                            View Group Ledger
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditStartingMonth(group)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#1C1C1A] hover:bg-[#F2F2EF] font-bold cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5 text-[#2F5D50]" />
                            Edit Starting Month
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchiveGroup(group)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#A33A3A] hover:bg-[#FCEEEE] font-bold cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5 text-[#A33A3A]" />
                            Archive Group
                          </button>
                        </div>
                      )}
                    </div>

                    {/* PRIMARY ACTION ON RIGHT: View Members → */}
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1.5 rounded-xl bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold cursor-pointer"
                      onClick={() => navigate(`/members?group=${group.groupId}`)}
                    >
                      <span>View Members</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
                min="100"
                step="100"
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
      {isEditStartingMonthModalOpen && targetGroupForStartingMonth && (
        <Modal
          isOpen={isEditStartingMonthModalOpen}
          onClose={() => setIsEditStartingMonthModalOpen(false)}
          title="Edit Group Starting Month"
          subtitle={`Configure the starting month (Chit Month 1) for ${targetGroupForStartingMonth?.fullFormattedValue}.`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveStartingMonth} className="space-y-4 text-xs font-sans">
            <div className="p-3.5 bg-[#EDF7F0] border border-[#2F5D50]/20 rounded-xl space-y-2">
              <label className="block text-[11px] font-extrabold text-[#2F5D50] uppercase tracking-wider">
                Select Starting Month (Chit Month 1)
              </label>
              <select
                value={inputStartingMonth}
                onChange={(e) => setInputStartingMonth(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-[#E5E5E1] rounded-xl text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
              >
                {getStandardMonthOptions().map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <div className="pt-2 border-t border-[#2F5D50]/20 flex items-center justify-between text-xs">
                <span className="text-[#6B6B67] font-semibold">Active Billing Month:</span>
                <span className="font-bold text-[#1C1C1A]">{selectedMonth}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B6B67] font-semibold">Calculated Chit Month:</span>
                <span className="font-black text-[#2F5D50] bg-white px-2 py-0.5 rounded-md border border-[#2F5D50]/20">
                  {getChitMonth(inputStartingMonth, selectedMonth).display}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#6B6B67] leading-relaxed">
              ℹ Changing the starting month recalculates the active Chit Month dynamically across all group dashboards, member views, and WhatsApp message previews. Historical financial ledger entries remain intact.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E1]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditStartingMonthModalOpen(false)}
                disabled={isSavingStartingMonth}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold"
                disabled={isSavingStartingMonth}
              >
                {isSavingStartingMonth ? 'Saving...' : 'Save Starting Month'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

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
