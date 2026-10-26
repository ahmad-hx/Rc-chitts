import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Layers,
  Users,
  IndianRupee,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Save,
  Download,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Table,
  RotateCcw,
} from 'lucide-react';

import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import Modal from '../components/Modal';

import {
  memberService,
  chitService,
  groupPaymentSettingsService,
  groupRecordService,
} from '../services/dbService';
import { getEffectiveMonthlyAmount, normalizeGroupId } from '../utils/amountUtils';
import { getChitMonthForGroup } from '../utils/chitMonthUtils';
import { useBillingMonth } from '../context/BillingMonthContext';

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

export default function ChitRecords() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedMonth } = useBillingMonth();

  // Core Data
  const [members, setMembers] = useState([]);
  const [chits, setChits] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Spreadsheet state for active group sheet
  const [groupRecordData, setGroupRecordData] = useState(null);
  const [sheetRows, setSheetRows] = useState({});
  const [columnHeaders, setColumnHeaders] = useState({
    notes: 'Notes / Remarks',
    custom1: 'Custom 1',
    custom2: 'Custom 2',
    custom3: 'Custom 3',
    custom4: 'Custom 4',
  });
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');

  // Column header rename modal state
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [editingHeaders, setEditingHeaders] = useState({ ...columnHeaders });

  // Unsaved changes confirm modal
  const [pendingNavigationAction, setPendingNavigationAction] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // URL query parameter synchronization
  const paramCategory = searchParams.get('category');
  const paramGroupId = searchParams.get('groupId');

  const selectedCategory = paramCategory ? Number(paramCategory) : null;
  const selectedGroupId = paramGroupId ? String(paramGroupId).trim() : null;

  // Active view: 'categories' | 'groups' | 'sheet'
  const currentView = useMemo(() => {
    if (selectedCategory && selectedGroupId) return 'sheet';
    if (selectedCategory) return 'groups';
    return 'categories';
  }, [selectedCategory, selectedGroupId]);

  // Load database records on mount
  const loadDatabaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedMembers, fetchedChits, settingsRes] = await Promise.all([
        memberService.getMembers().catch(() => []),
        chitService.getChits().catch(() => []),
        groupPaymentSettingsService.getGroupPaymentSettings().catch(() => ({ settingsMap: {} })),
      ]);

      setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
      setChits(Array.isArray(fetchedChits) ? fetchedChits : []);
      setGroupPaymentSettings(settingsRes?.settingsMap || {});
    } catch (err) {
      console.error('Failed to load database records:', err);
      showToast('Unable to load chit records from Firebase.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Discover all unique categories dynamically from both 'chits' and 'members'
  const availableCategories = useMemo(() => {
    const valueMap = new Map();

    // From explicit chits collection
    (chits || []).forEach((c) => {
      const val = Number(c.totalChitValue || c.totalValue || c.chitValue || 100000);
      if (val > 0) {
        if (!valueMap.has(val)) {
          valueMap.set(val, {
            totalChitValue: val,
            label: val >= 100000 ? `₹${(val / 100000).toFixed(0)} Lakh Chits` : `₹${val.toLocaleString('en-IN')} Chits`,
            groupsSet: new Set(),
            enrolledCount: 0,
          });
        }
        if (c.groupId) {
          valueMap.get(val).groupsSet.add(normalizeGroupId(c.groupId));
        }
      }
    });

    // From members holdings
    (members || []).forEach((m) => {
      if (m.status === 'archived') return;
      const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
      activeChits.forEach((c) => {
        const val = Number(c.totalChitValue || c.totalValue || c.chitValue || m.totalChitValue || 100000);
        const grp = normalizeGroupId(c.groupId || c.group || m.groupId || m.group || 'I');
        if (val > 0) {
          if (!valueMap.has(val)) {
            valueMap.set(val, {
              totalChitValue: val,
              label: val >= 100000 ? `₹${(val / 100000).toFixed(0)} Lakh Chits` : `₹${val.toLocaleString('en-IN')} Chits`,
              groupsSet: new Set(),
              enrolledCount: 0,
            });
          }
          valueMap.get(val).groupsSet.add(grp);
          valueMap.get(val).enrolledCount += Number(c.quantity || 1);
        }
      });
    });

    const categoriesList = Array.from(valueMap.values()).map((cat) => ({
      ...cat,
      groupCount: cat.groupsSet.size,
    }));

    return categoriesList.sort((a, b) => a.totalChitValue - b.totalChitValue);
  }, [chits, members]);

  // Extract groups belonging to the selected chit category
  const categoryGroups = useMemo(() => {
    if (!selectedCategory) return [];

    const groupMap = new Map();

    // From chits collection
    (chits || []).forEach((c) => {
      const val = Number(c.totalChitValue || c.totalValue || c.chitValue || 100000);
      if (val === selectedCategory) {
        const rawGrp = String(c.groupId || 'I').trim();
        const cleanGrp = normalizeGroupId(rawGrp);
        const docId = c.id || `group_${cleanGrp}_${val}`;

        if (!groupMap.has(cleanGrp)) {
          groupMap.set(cleanGrp, {
            id: docId,
            groupId: cleanGrp,
            displayGroupId: rawGrp.toUpperCase(),
            name: c.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${cleanGrp})`,
            totalChitValue: val,
            startingMonth: c.startingMonth || c.startMonth || 'March 2026',
            capacity: Number(c.capacity || 20),
            status: c.status || 'ACTIVE',
            enrolledMembers: 0,
          });
        }
      }
    });

    // Populate enrolled members and discover groups referenced across members
    (members || []).forEach((m) => {
      if (m.status === 'archived') return;
      const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
      activeChits.forEach((c) => {
        const val = Number(c.totalChitValue || c.totalValue || c.chitValue || m.totalChitValue || 100000);
        if (val === selectedCategory) {
          const rawGrp = String(c.groupId || c.group || m.groupId || m.group || 'I').trim();
          const cleanGrp = normalizeGroupId(rawGrp);
          const docId = `group_${cleanGrp}_${val}`;

          if (!groupMap.has(cleanGrp)) {
            groupMap.set(cleanGrp, {
              id: docId,
              groupId: cleanGrp,
              displayGroupId: rawGrp.toUpperCase(),
              name: c.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${cleanGrp})`,
              totalChitValue: val,
              startingMonth: 'March 2026',
              capacity: 20,
              status: 'ACTIVE',
              enrolledMembers: 0,
            });
          }
          groupMap.get(cleanGrp).enrolledMembers += Number(c.quantity || 1);
        }
      });
    });

    const list = Array.from(groupMap.values());
    return list.sort((a, b) => compareGroupIds(a.groupId, b.groupId));
  }, [selectedCategory, chits, members]);

  // Selected group object details
  const activeGroup = useMemo(() => {
    if (!selectedGroupId || !selectedCategory) return null;
    const cleanTarget = normalizeGroupId(selectedGroupId);
    return categoryGroups.find((g) => g.groupId === cleanTarget) || {
      id: `group_${cleanTarget}_${selectedCategory}`,
      groupId: cleanTarget,
      displayGroupId: selectedGroupId,
      name: `₹${(selectedCategory / 100000).toFixed(0)} Lakh Chit (Group ${cleanTarget})`,
      totalChitValue: selectedCategory,
    };
  }, [categoryGroups, selectedGroupId, selectedCategory]);

  // Load Group Records Spreadsheet data when Screen 3 (sheet) opens
  useEffect(() => {
    let mounted = true;
    async function loadSpreadsheetRecord() {
      if (!selectedCategory || !selectedGroupId) {
        setGroupRecordData(null);
        setSheetRows({});
        setIsDirty(false);
        return;
      }

      try {
        const cleanGrp = normalizeGroupId(selectedGroupId);
        const record = await groupRecordService.getGroupRecord(selectedCategory, cleanGrp);
        if (mounted) {
          setGroupRecordData(record);
          setColumnHeaders(
            record.columnHeaders || {
              notes: 'Notes / Remarks',
              custom1: 'Custom 1',
              custom2: 'Custom 2',
              custom3: 'Custom 3',
              custom4: 'Custom 4',
            }
          );
          setSheetRows(record.records || {});
          setIsDirty(false);
        }
      } catch (err) {
        console.error('Failed to load group sheet record:', err);
        if (mounted) {
          showToast('Failed to load group spreadsheet data.', 'error');
        }
      }
    }

    loadSpreadsheetRecord();
    return () => {
      mounted = false;
    };
  }, [selectedCategory, selectedGroupId]);

  // Compute members belonging to the active group
  const groupMembersRoster = useMemo(() => {
    if (!selectedCategory || !selectedGroupId) return [];
    const cleanGrp = normalizeGroupId(selectedGroupId);

    const roster = [];
    (members || []).forEach((m) => {
      if (m.status === 'archived') return;

      const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
      activeChits.forEach((c) => {
        const cVal = Number(c.totalChitValue || c.totalValue || c.chitValue || m.totalChitValue || 100000);
        const cGrp = normalizeGroupId(c.groupId || c.group || m.groupId || m.group);

        if (cVal === selectedCategory && cGrp === cleanGrp) {
          const subId = c.id || `sub_${m.id}_${cleanGrp}`;
          const effectiveMonthly = getEffectiveMonthlyAmount(m, c, groupPaymentSettings);

          roster.push({
            rowKey: subId,
            memberId: m.id,
            memberName: m.name,
            phone: m.phone || m.whatsapp || '',
            whatsapp: m.whatsapp || m.phone || '',
            classification: m.classification || (activeChits.length > 1 ? 'MULTIPLE' : 'SINGLE'),
            subscription: c,
            monthlyAmount: effectiveMonthly,
            quantity: Number(c.quantity || 1),
          });
        }
      });
    });

    // Stable sort by member name
    return roster.sort((a, b) => a.memberName.localeCompare(b.memberName));
  }, [members, selectedCategory, selectedGroupId, groupPaymentSettings]);

  // Filtered rows for Excel sheet based on in-sheet search
  const filteredRoster = useMemo(() => {
    const q = sheetSearchQuery.toLowerCase().trim();
    if (!q) return groupMembersRoster;
    return groupMembersRoster.filter(
      (r) =>
        r.memberName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (sheetRows[r.rowKey]?.notes && sheetRows[r.rowKey].notes.toLowerCase().includes(q)) ||
        (sheetRows[r.rowKey]?.custom1 && sheetRows[r.rowKey].custom1.toLowerCase().includes(q)) ||
        (sheetRows[r.rowKey]?.custom2 && sheetRows[r.rowKey].custom2.toLowerCase().includes(q)) ||
        (sheetRows[r.rowKey]?.custom3 && sheetRows[r.rowKey].custom3.toLowerCase().includes(q)) ||
        (sheetRows[r.rowKey]?.custom4 && sheetRows[r.rowKey].custom4.toLowerCase().includes(q))
    );
  }, [groupMembersRoster, sheetSearchQuery, sheetRows]);

  // Cell change handler
  const handleCellChange = (rowKey, field, value) => {
    setSheetRows((prev) => {
      const existingRow = prev[rowKey] || {};
      return {
        ...prev,
        [rowKey]: {
          ...existingRow,
          [field]: value,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    setIsDirty(true);
  };

  // Save spreadsheet custom records & headers to Firebase
  const handleSaveSpreadsheet = async () => {
    if (!selectedCategory || !selectedGroupId) return;

    setIsSavingRecord(true);
    try {
      const cleanGrp = normalizeGroupId(selectedGroupId);
      await groupRecordService.saveGroupRecord({
        chitValue: selectedCategory,
        groupId: cleanGrp,
        columnHeaders,
        records: sheetRows,
      });

      setIsDirty(false);
      showToast(`✓ Spreadsheet records for Group ${cleanGrp} saved to Firebase!`, 'success');
    } catch (err) {
      console.error('Failed to save spreadsheet record:', err);
      showToast(`Failed to save spreadsheet: ${err.message}`, 'error');
    } finally {
      setIsSavingRecord(false);
    }
  };

  // Save custom column header renames
  const handleSaveHeaders = () => {
    setColumnHeaders({ ...editingHeaders });
    setIsDirty(true);
    setIsHeaderModalOpen(false);
    showToast('Column headers updated! Click "Save Changes" to persist in Firebase.', 'info');
  };

  // Export genuine .xlsx workbook
  const handleExportExcel = () => {
    if (!groupMembersRoster.length) {
      showToast('No member records to export for this group.', 'error');
      return;
    }

    try {
      const cleanGrp = normalizeGroupId(selectedGroupId);
      const categoryLakh = (selectedCategory / 100000).toFixed(0);
      const titleBanner = `Raghavendra Chitts — ₹${categoryLakh} Lakh Chit (Group ${cleanGrp}) Member Sheet`;
      const exportDate = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Prepare worksheet rows
      const worksheetData = [
        [titleBanner],
        [`Export Date: ${exportDate} | Active Members: ${groupMembersRoster.length}`],
        [], // empty separator row
        [
          'S.No',
          'Member Name',
          'Phone Number',
          'Monthly Amount (₹)',
          columnHeaders.notes || 'Notes / Remarks',
          columnHeaders.custom1 || 'Custom 1',
          columnHeaders.custom2 || 'Custom 2',
          columnHeaders.custom3 || 'Custom 3',
          columnHeaders.custom4 || 'Custom 4',
        ],
      ];

      let totalMonthlySum = 0;

      groupMembersRoster.forEach((row, idx) => {
        const rowData = sheetRows[row.rowKey] || {};
        totalMonthlySum += Number(row.monthlyAmount || 0);

        worksheetData.push([
          idx + 1,
          row.memberName,
          row.phone || '',
          row.monthlyAmount,
          rowData.notes || '',
          rowData.custom1 || '',
          rowData.custom2 || '',
          rowData.custom3 || '',
          rowData.custom4 || '',
        ]);
      });

      // Summary row
      worksheetData.push([]);
      worksheetData.push([
        'TOTAL',
        `${groupMembersRoster.length} Members`,
        '',
        totalMonthlySum,
        '',
        '',
        '',
        '',
        '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Define clear column widths for Excel readability
      ws['!cols'] = [
        { wch: 8 },  // S.No
        { wch: 28 }, // Member Name
        { wch: 16 }, // Phone Number
        { wch: 20 }, // Monthly Amount
        { wch: 28 }, // Notes / Remarks
        { wch: 22 }, // Custom 1
        { wch: 22 }, // Custom 2
        { wch: 22 }, // Custom 3
        { wch: 22 }, // Custom 4
      ];

      const wb = XLSX.utils.book_new();
      const validSheetName = `Group_${cleanGrp}_${categoryLakh}L`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, validSheetName);

      const fileName = `Raghavendra_Chitts_${categoryLakh}L_Group_${cleanGrp}_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showToast(`✓ Genuine Excel workbook downloaded: ${fileName}!`, 'success');
    } catch (err) {
      console.error('Failed to export Excel file:', err);
      showToast(`Excel export failed: ${err.message}`, 'error');
    }
  };

  // Safe navigation handler that checks for unsaved changes
  const handleNavigateSafely = (action) => {
    if (isDirty) {
      setPendingNavigationAction(() => action);
    } else {
      action();
    }
  };

  const handleSelectCategory = (val) => {
    handleNavigateSafely(() => {
      setSearchParams({ category: String(val) });
    });
  };

  const handleSelectGroup = (groupId) => {
    handleNavigateSafely(() => {
      setSearchParams({ category: String(selectedCategory), groupId });
    });
  };

  const handleBackToCategories = () => {
    handleNavigateSafely(() => {
      setSearchParams({});
    });
  };

  const handleBackToGroups = () => {
    handleNavigateSafely(() => {
      setSearchParams({ category: String(selectedCategory) });
    });
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans max-w-7xl mx-auto pb-16">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─── NAVIGATION BREADCRUMBS & TOP HEADER ───────────────────────────────── */}
      <div className="border-b border-[#E5E7EB] pb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#667085]">
          <button
            onClick={handleBackToCategories}
            className={`flex items-center gap-1.5 hover:text-[#285F52] cursor-pointer transition-colors ${
              currentView === 'categories' ? 'text-[#285F52] font-black' : ''
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Chit Records</span>
          </button>

          {selectedCategory && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#E5E7EB]" />
              <button
                onClick={handleBackToGroups}
                className={`hover:text-[#285F52] cursor-pointer transition-colors ${
                  currentView === 'groups' ? 'text-[#285F52] font-black' : ''
                }`}
              >
                ₹{(selectedCategory / 100000).toFixed(0)} Lakh Chits
              </button>
            </>
          )}

          {selectedGroupId && activeGroup && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#E5E7EB]" />
              <span className="text-[#285F52] font-black">
                Group {activeGroup.groupId} Sheet
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight flex items-center gap-2.5">
              <FileSpreadsheet className="w-7 h-7 text-[#285F52]" />
              {currentView === 'categories' && 'All Chit Categories'}
              {currentView === 'groups' && `₹${(selectedCategory / 100000).toFixed(0)} Lakh Chit Groups`}
              {currentView === 'sheet' && `Group ${activeGroup?.groupId} Member Spreadsheet`}
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              {currentView === 'categories' && 'Select a chit category to explore its groups and manage Excel-style member records.'}
              {currentView === 'groups' && 'Select a specific chit group below to view and edit its live Excel member sheet.'}
              {currentView === 'sheet' && `Live editable worksheet for Group ${activeGroup?.groupId} (${groupMembersRoster.length} enrolled members). Changes persist in Firebase.`}
            </p>
          </div>

          {/* TOP ACTIONS */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {currentView === 'groups' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToCategories}
                className="rounded-xl gap-2 cursor-pointer font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Chits</span>
              </Button>
            )}

            {currentView === 'sheet' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToGroups}
                  className="rounded-xl gap-2 cursor-pointer font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Groups</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingHeaders({ ...columnHeaders });
                    setIsHeaderModalOpen(true);
                  }}
                  className="rounded-xl gap-2 cursor-pointer font-bold border-[#E5E7EB]"
                  title="Rename custom column headers"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename Columns</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="rounded-xl gap-2 cursor-pointer font-bold text-[#285F52] border-[#BFD8D0] bg-[#EEF6F3] hover:bg-[#E2F0EB]"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Excel (.xlsx)</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSpreadsheet}
                  disabled={isSavingRecord || !isDirty}
                  className="rounded-xl gap-2 cursor-pointer font-bold shadow-xs"
                >
                  <Save className={`w-4 h-4 ${isSavingRecord ? 'animate-spin' : ''}`} />
                  <span>{isSavingRecord ? 'Saving...' : isDirty ? 'Save Changes *' : 'Saved'}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── SCREEN 1: ALL CHITS (CATEGORIES HIERARCHY) ────────────────────────── */}
      {currentView === 'categories' && (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 bg-white border border-[#E5E7EB] rounded-2xl animate-pulse h-48" />
              ))}
            </div>
          ) : availableCategories.length === 0 ? (
            <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white rounded-2xl">
              No chit categories found in the database.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableCategories.map((cat) => {
                const lakhVal = (cat.totalChitValue / 100000).toFixed(0);
                const defaultMonthly = Math.floor(cat.totalChitValue / 20);

                return (
                  <Card
                    key={cat.totalChitValue}
                    onClick={() => handleSelectCategory(cat.totalChitValue)}
                    className="p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs hover:border-[#285F52] hover:shadow-md transition-all cursor-pointer group space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#EEF6F3] text-[#285F52] flex items-center justify-center font-black text-lg border border-[#BFD8D0] group-hover:scale-105 transition-transform">
                          ₹{lakhVal}L
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-[#111111] group-hover:text-[#285F52] transition-colors">
                            ₹{lakhVal} Lakh Chits
                          </h3>
                          <p className="text-xs text-[#667085] font-mono">
                            Pool Value: ₹{cat.totalChitValue.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>

                      <span className="w-8 h-8 rounded-full bg-[#F7F8F7] flex items-center justify-center text-[#667085] group-hover:bg-[#285F52] group-hover:text-white transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-[#E5E7EB] bg-[#F7F8F7] rounded-xl p-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Total Groups
                        </span>
                        <span className="text-base font-black text-[#111111] font-mono">
                          {cat.groupCount} {cat.groupCount === 1 ? 'Group' : 'Groups'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Enrolled Members
                        </span>
                        <span className="text-base font-black text-[#285F52] font-mono">
                          {cat.enrolledCount} Subscriptions
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[11px] font-bold text-[#667085]">
                        Base Premium: <span className="font-mono text-[#111111]">₹{defaultMonthly.toLocaleString('en-IN')}/mo</span>
                      </span>
                      <span className="text-xs font-black text-[#285F52] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>View Groups</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── SCREEN 2: GROUPS OF SELECTED CHIT ─────────────────────────────────── */}
      {currentView === 'groups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#F7F8F7] p-4 rounded-2xl border border-[#E5E7EB]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">Selected Category</span>
              <span className="text-base font-black text-[#111111]">
                ₹{(selectedCategory / 100000).toFixed(0)} Lakh Chit Groups ({categoryGroups.length} Groups)
              </span>
            </div>
            <Badge variant="neutral" className="text-xs font-bold font-mono">
              20 Months • 20 Seats per Group
            </Badge>
          </div>

          {categoryGroups.length === 0 ? (
            <Card className="p-12 text-center text-[#667085] font-bold text-sm bg-white rounded-2xl">
              No groups found under this chit category.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryGroups.map((group) => {
                const cleanGId = group.groupId;
                const monthlyPrem = getEffectiveMonthlyAmount(null, {
                  totalChitValue: selectedCategory,
                  groupId: cleanGId,
                }, groupPaymentSettings);

                return (
                  <Card
                    key={group.id || group.groupId}
                    onClick={() => handleSelectGroup(cleanGId)}
                    className="p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs hover:border-[#285F52] hover:shadow-md transition-all cursor-pointer group space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-[#EEF6F3] text-[#285F52] font-black text-sm flex items-center justify-center border border-[#BFD8D0] group-hover:scale-105 transition-transform">
                          {cleanGId}
                        </span>
                        <div>
                          <h3 className="text-base font-black text-[#111111] group-hover:text-[#285F52] transition-colors">
                            Group {cleanGId}
                          </h3>
                          <p className="text-[11px] text-[#667085] truncate max-w-[180px]">
                            {group.name}
                          </p>
                        </div>
                      </div>

                      <Badge variant="success" dot>ACTIVE</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-[#E5E7EB] bg-[#F7F8F7] rounded-xl p-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Monthly Amount
                        </span>
                        <span className="text-sm font-black text-[#285F52] font-mono">
                          ₹{monthlyPrem.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
                          Enrolled Seats
                        </span>
                        <span className="text-sm font-black text-[#111111] font-mono">
                          {group.enrolledMembers} / {group.capacity || 20}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[11px] font-medium text-[#667085]">
                        Cycle: {group.startingMonth}
                      </span>
                      <span className="text-xs font-black text-[#285F52] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Open Excel Sheet</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── SCREEN 3: EXCEL-STYLE GROUP MEMBER SHEET ──────────────────────────── */}
      {currentView === 'sheet' && activeGroup && (
        <div className="space-y-4">
          {/* SHEET CONTROLS & SEARCH */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-[#EEF6F3] text-[#285F52] font-black text-sm flex items-center justify-center border border-[#BFD8D0]">
                {activeGroup.groupId}
              </span>
              <div>
                <h2 className="text-sm font-black text-[#111111]">
                  ₹{(selectedCategory / 100000).toFixed(0)} Lakh Chit • Group {activeGroup.groupId} Roster
                </h2>
                <p className="text-[11px] text-[#667085]">
                  {groupMembersRoster.length} Total Subscriptions • Inline editable cells auto-mark sheet as modified
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter sheet members / remarks..."
                  value={sheetSearchQuery}
                  onChange={(e) => setSheetSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] focus:outline-none focus:border-[#285F52] w-60"
                />
              </div>

              {isDirty && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FFF8E7] text-[#B7791F] font-bold text-xs border border-[#FDE68A]">
                  <span className="w-2 h-2 rounded-full bg-[#B7791F] animate-pulse"></span>
                  Unsaved Edits
                </span>
              )}
            </div>
          </div>

          {/* EXCEL SPREADSHEET TABLE */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                {/* STICKY EXCEL-STYLE TABLE HEADER */}
                <thead className="bg-[#F7F8F7] sticky top-0 z-10 border-b border-[#E5E7EB] shadow-xs text-[#111111]">
                  <tr>
                    <th className="p-3 font-black text-center w-14 border-r border-[#E5E7EB] text-[#667085] uppercase tracking-wider text-[10px]">
                      S.No
                    </th>
                    <th className="p-3 font-black min-w-[200px] border-r border-[#E5E7EB] uppercase tracking-wider text-[10px]">
                      Member Name
                    </th>
                    <th className="p-3 font-black min-w-[130px] border-r border-[#E5E7EB] text-right uppercase tracking-wider text-[10px]">
                      Monthly Amount
                    </th>
                    <th className="p-3 font-black min-w-[220px] border-r border-[#E5E7EB] uppercase tracking-wider text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>{columnHeaders.notes || 'Notes / Remarks'}</span>
                      </div>
                    </th>
                    <th className="p-3 font-black min-w-[170px] border-r border-[#E5E7EB] uppercase tracking-wider text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>{columnHeaders.custom1 || 'Custom 1'}</span>
                      </div>
                    </th>
                    <th className="p-3 font-black min-w-[170px] border-r border-[#E5E7EB] uppercase tracking-wider text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>{columnHeaders.custom2 || 'Custom 2'}</span>
                      </div>
                    </th>
                    <th className="p-3 font-black min-w-[170px] border-r border-[#E5E7EB] uppercase tracking-wider text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>{columnHeaders.custom3 || 'Custom 3'}</span>
                      </div>
                    </th>
                    <th className="p-3 font-black min-w-[170px] uppercase tracking-wider text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>{columnHeaders.custom4 || 'Custom 4'}</span>
                      </div>
                    </th>
                  </tr>
                </thead>

                {/* SPREADSHEET ROWS */}
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-[#667085] font-bold text-xs">
                        {sheetSearchQuery
                          ? 'No member records match the search filter.'
                          : 'No active member subscriptions found for this group.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((row, idx) => {
                      const rowData = sheetRows[row.rowKey] || {};

                      return (
                        <tr
                          key={row.rowKey}
                          className="hover:bg-[#F9FAFB] transition-colors group"
                        >
                          {/* S.No */}
                          <td className="p-3 text-center font-mono font-bold text-[#667085] bg-[#F7F8F7]/50 border-r border-[#E5E7EB]">
                            {idx + 1}
                          </td>

                          {/* Member Name */}
                          <td className="p-3 border-r border-[#E5E7EB]">
                            <div className="font-bold text-[#111111]">{row.memberName}</div>
                            <div className="text-[11px] font-mono text-[#667085]">
                              {row.phone ? `+${row.phone}` : 'No phone'} •{' '}
                              <span className="text-[10px] font-bold text-[#285F52]">
                                {row.classification}
                              </span>
                            </div>
                          </td>

                          {/* Monthly Amount (Effective resolved amount) */}
                          <td className="p-3 border-r border-[#E5E7EB] text-right font-mono font-black text-[#285F52]">
                            ₹{Number(row.monthlyAmount || 0).toLocaleString('en-IN')}
                          </td>

                          {/* Notes / Remarks (Editable cell) */}
                          <td className="p-2 border-r border-[#E5E7EB]">
                            <input
                              type="text"
                              value={rowData.notes || ''}
                              onChange={(e) => handleCellChange(row.rowKey, 'notes', e.target.value)}
                              placeholder="Enter remarks..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-transparent hover:border-[#E5E7EB] focus:border-[#285F52] focus:bg-white focus:outline-none transition-all font-medium text-[#111111] bg-transparent"
                            />
                          </td>

                          {/* Custom Column 1 (Editable cell) */}
                          <td className="p-2 border-r border-[#E5E7EB]">
                            <input
                              type="text"
                              value={rowData.custom1 || ''}
                              onChange={(e) => handleCellChange(row.rowKey, 'custom1', e.target.value)}
                              placeholder="Enter value..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-transparent hover:border-[#E5E7EB] focus:border-[#285F52] focus:bg-white focus:outline-none transition-all font-medium text-[#111111] bg-transparent"
                            />
                          </td>

                          {/* Custom Column 2 (Editable cell) */}
                          <td className="p-2 border-r border-[#E5E7EB]">
                            <input
                              type="text"
                              value={rowData.custom2 || ''}
                              onChange={(e) => handleCellChange(row.rowKey, 'custom2', e.target.value)}
                              placeholder="Enter value..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-transparent hover:border-[#E5E7EB] focus:border-[#285F52] focus:bg-white focus:outline-none transition-all font-medium text-[#111111] bg-transparent"
                            />
                          </td>

                          {/* Custom Column 3 (Editable cell) */}
                          <td className="p-2 border-r border-[#E5E7EB]">
                            <input
                              type="text"
                              value={rowData.custom3 || ''}
                              onChange={(e) => handleCellChange(row.rowKey, 'custom3', e.target.value)}
                              placeholder="Enter value..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-transparent hover:border-[#E5E7EB] focus:border-[#285F52] focus:bg-white focus:outline-none transition-all font-medium text-[#111111] bg-transparent"
                            />
                          </td>

                          {/* Custom Column 4 (Editable cell) */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={rowData.custom4 || ''}
                              onChange={(e) => handleCellChange(row.rowKey, 'custom4', e.target.value)}
                              placeholder="Enter value..."
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-transparent hover:border-[#E5E7EB] focus:border-[#285F52] focus:bg-white focus:outline-none transition-all font-medium text-[#111111] bg-transparent"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SPREADSHEET FOOTER BAR */}
            <div className="bg-[#F7F8F7] border-t border-[#E5E7EB] p-3 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[#667085]">
              <div className="flex items-center gap-4">
                <span>Total Members: <strong className="text-[#111111]">{groupMembersRoster.length}</strong></span>
                <span>•</span>
                <span>
                  Total Group Monthly Pool:{' '}
                  <strong className="text-[#285F52] font-mono">
                    ₹{groupMembersRoster.reduce((sum, r) => sum + Number(r.monthlyAmount || 0), 0).toLocaleString('en-IN')}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSpreadsheet}
                  disabled={isSavingRecord || !isDirty}
                  className="rounded-xl text-xs gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingRecord ? 'Saving Records...' : isDirty ? 'Save Changes *' : 'All Changes Saved ✓'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: RENAME CUSTOM COLUMN HEADERS ──────────────────────────────── */}
      {isHeaderModalOpen && (
        <Modal
          isOpen={isHeaderModalOpen}
          onClose={() => setIsHeaderModalOpen(false)}
          title="Rename Spreadsheet Column Headers"
          subtitle={`Configure custom headers for Group ${activeGroup?.groupId} Excel records.`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs font-sans">
            <div>
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">
                Notes / Remarks Header
              </label>
              <input
                type="text"
                value={editingHeaders.notes}
                onChange={(e) => setEditingHeaders({ ...editingHeaders, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] font-bold text-[#111111] focus:outline-none focus:border-[#285F52]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">
                Custom Column 1 Name
              </label>
              <input
                type="text"
                value={editingHeaders.custom1}
                onChange={(e) => setEditingHeaders({ ...editingHeaders, custom1: e.target.value })}
                placeholder="e.g. Token No"
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] font-bold text-[#111111] focus:outline-none focus:border-[#285F52]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">
                Custom Column 2 Name
              </label>
              <input
                type="text"
                value={editingHeaders.custom2}
                onChange={(e) => setEditingHeaders({ ...editingHeaders, custom2: e.target.value })}
                placeholder="e.g. Passbook No"
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] font-bold text-[#111111] focus:outline-none focus:border-[#285F52]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">
                Custom Column 3 Name
              </label>
              <input
                type="text"
                value={editingHeaders.custom3}
                onChange={(e) => setEditingHeaders({ ...editingHeaders, custom3: e.target.value })}
                placeholder="e.g. Guarantor"
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] font-bold text-[#111111] focus:outline-none focus:border-[#285F52]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-1">
                Custom Column 4 Name
              </label>
              <input
                type="text"
                value={editingHeaders.custom4}
                onChange={(e) => setEditingHeaders({ ...editingHeaders, custom4: e.target.value })}
                placeholder="e.g. Remark 2"
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] font-bold text-[#111111] focus:outline-none focus:border-[#285F52]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHeaderModalOpen(false)}
                className="rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveHeaders}
                className="rounded-xl font-bold cursor-pointer shadow-xs"
              >
                Apply Headers
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── MODAL: CONFIRM UNSAVED EDITS ─────────────────────────────────────── */}
      {pendingNavigationAction && (
        <Modal
          isOpen={Boolean(pendingNavigationAction)}
          onClose={() => setPendingNavigationAction(null)}
          title="Unsaved Spreadsheet Changes"
          subtitle="You have unsaved changes in this group sheet."
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs font-sans">
            <p className="text-[#667085] leading-relaxed">
              If you leave this group sheet without saving, your recent edits to notes or custom columns will be discarded.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingNavigationAction(null)}
                className="rounded-xl font-bold cursor-pointer"
              >
                Stay on Sheet
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const act = pendingNavigationAction;
                  setIsDirty(false);
                  setPendingNavigationAction(null);
                  if (act) act();
                }}
                className="rounded-xl font-bold cursor-pointer"
              >
                Discard & Leave
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  await handleSaveSpreadsheet();
                  const act = pendingNavigationAction;
                  setPendingNavigationAction(null);
                  if (act) act();
                }}
                className="rounded-xl font-bold cursor-pointer shadow-xs"
              >
                Save & Continue
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
