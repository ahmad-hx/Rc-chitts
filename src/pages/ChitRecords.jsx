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
  Plus,
  Trash2,
  X,
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
  groupSpreadsheetService,
} from '../services/dbService';
import { getEffectiveMonthlyAmount, normalizeGroupId } from '../utils/amountUtils';
import { useBillingMonth } from '../context/BillingMonthContext';

// Roman numeral parsing helper for sorting Groups (I, II, III, IV, etc.)
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

  // Blank Spreadsheet State for Active Group Sheet
  const [spreadsheetColumns, setSpreadsheetColumns] = useState([
    { id: 'col_sno', name: 'S.No', width: 70 },
    { id: 'col_1', name: 'Column 1', width: 180 },
    { id: 'col_2', name: 'Column 2', width: 180 },
    { id: 'col_3', name: 'Column 3', width: 180 },
    { id: 'col_4', name: 'Column 4', width: 180 },
  ]);
  const [spreadsheetRows, setSpreadsheetRows] = useState([]);
  const [isSavingSpreadsheet, setIsSavingSpreadsheet] = useState(false);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');

  // Column Management Modal State
  const [isManageColumnsModalOpen, setIsManageColumnsModalOpen] = useState(false);
  const [editingColumns, setEditingColumns] = useState([]);
  const [newColumnName, setNewColumnName] = useState('');

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

  // Load database records on mount (for Category and Group list statistics)
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

  // Load Group's Independent Spreadsheet when Screen 3 (sheet) opens
  useEffect(() => {
    let mounted = true;
    async function loadSpreadsheet() {
      if (!selectedCategory || !selectedGroupId || !activeGroup) {
        setSpreadsheetRows([]);
        setIsDirty(false);
        return;
      }

      setIsLoadingSpreadsheet(true);
      try {
        const cleanGrp = normalizeGroupId(selectedGroupId);
        const data = await groupSpreadsheetService.getSpreadsheet(
          activeGroup.id,
          selectedCategory,
          cleanGrp
        );

        if (mounted) {
          setSpreadsheetColumns(
            Array.isArray(data.columns) && data.columns.length > 0
              ? data.columns
              : [
                  { id: 'col_sno', name: 'S.No', width: 70 },
                  { id: 'col_1', name: 'Column 1', width: 180 },
                  { id: 'col_2', name: 'Column 2', width: 180 },
                  { id: 'col_3', name: 'Column 3', width: 180 },
                  { id: 'col_4', name: 'Column 4', width: 180 },
                ]
          );

          setSpreadsheetRows(
            Array.isArray(data.rows) && data.rows.length > 0
              ? data.rows
              : [
                  { id: 'row_1', cells: { col_sno: '1', col_1: '', col_2: '', col_3: '', col_4: '' } },
                  { id: 'row_2', cells: { col_sno: '2', col_1: '', col_2: '', col_3: '', col_4: '' } },
                  { id: 'row_3', cells: { col_sno: '3', col_1: '', col_2: '', col_3: '', col_4: '' } },
                  { id: 'row_4', cells: { col_sno: '4', col_1: '', col_2: '', col_3: '', col_4: '' } },
                  { id: 'row_5', cells: { col_sno: '5', col_1: '', col_2: '', col_3: '', col_4: '' } },
                ]
          );
          setIsDirty(false);
        }
      } catch (err) {
        console.error('Failed to load group spreadsheet:', err);
        if (mounted) {
          showToast('Failed to load group spreadsheet from Firebase.', 'error');
        }
      } finally {
        if (mounted) {
          setIsLoadingSpreadsheet(false);
        }
      }
    }

    loadSpreadsheet();
    return () => {
      mounted = false;
    };
  }, [selectedCategory, selectedGroupId, activeGroup?.id]);

  // Filtered rows for Excel sheet based on in-sheet search
  const filteredRows = useMemo(() => {
    const q = sheetSearchQuery.toLowerCase().trim();
    if (!q) return spreadsheetRows;
    return spreadsheetRows.filter((row) => {
      const cells = row.cells || {};
      return Object.values(cells).some((val) =>
        String(val || '').toLowerCase().includes(q)
      );
    });
  }, [spreadsheetRows, sheetSearchQuery]);

  // Cell change handler
  const handleCellChange = (rowId, colId, value) => {
    setSpreadsheetRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              cells: {
                ...(r.cells || {}),
                [colId]: value,
              },
            }
          : r
      )
    );
    setIsDirty(true);
  };

  // Add 1 Row
  const handleAddRow = () => {
    const nextSNo = spreadsheetRows.length + 1;
    const newRowId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const initialCells = {};
    spreadsheetColumns.forEach((col) => {
      initialCells[col.id] = col.id === 'col_sno' ? String(nextSNo) : '';
    });

    setSpreadsheetRows((prev) => [...prev, { id: newRowId, cells: initialCells }]);
    setIsDirty(true);
  };

  // Add 5 Rows at once
  const handleAdd5Rows = () => {
    const newRows = [];
    const baseLen = spreadsheetRows.length;
    for (let i = 0; i < 5; i++) {
      const nextSNo = baseLen + i + 1;
      const newRowId = `row_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`;
      const initialCells = {};
      spreadsheetColumns.forEach((col) => {
        initialCells[col.id] = col.id === 'col_sno' ? String(nextSNo) : '';
      });
      newRows.push({ id: newRowId, cells: initialCells });
    }

    setSpreadsheetRows((prev) => [...prev, ...newRows]);
    setIsDirty(true);
  };

  // Delete Row
  const handleDeleteRow = (rowId) => {
    setSpreadsheetRows((prev) => {
      const filtered = prev.filter((r) => r.id !== rowId);
      // Auto-renumber col_sno if present
      return filtered.map((r, idx) => ({
        ...r,
        cells: {
          ...(r.cells || {}),
          ...(r.cells?.col_sno !== undefined ? { col_sno: String(idx + 1) } : {}),
        },
      }));
    });
    setIsDirty(true);
  };

  // Add Column
  const handleAddColumn = (name) => {
    const colCount = spreadsheetColumns.length;
    const colName = name && name.trim() ? name.trim() : `Column ${colCount}`;
    const newColId = `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const newCol = { id: newColId, name: colName, width: 180 };
    setSpreadsheetColumns((prev) => [...prev, newCol]);

    // Ensure all existing rows have the cell initialized
    setSpreadsheetRows((prev) =>
      prev.map((r) => ({
        ...r,
        cells: {
          ...(r.cells || {}),
          [newColId]: '',
        },
      }))
    );

    setIsDirty(true);
    showToast(`Added column "${colName}".`, 'success');
  };

  // Delete Column
  const handleDeleteColumn = (colId) => {
    if (spreadsheetColumns.length <= 1) {
      showToast('Cannot delete all columns. At least one column must remain.', 'error');
      return;
    }
    const targetCol = spreadsheetColumns.find((c) => c.id === colId);
    setSpreadsheetColumns((prev) => prev.filter((c) => c.id !== colId));

    // Remove key from cell rows
    setSpreadsheetRows((prev) =>
      prev.map((r) => {
        const cells = { ...(r.cells || {}) };
        delete cells[colId];
        return { ...r, cells };
      })
    );

    setIsDirty(true);
    showToast(`Column "${targetCol?.name || 'Column'}" removed.`, 'info');
  };

  // Save Spreadsheet to Firebase (Document ID: groupSpreadsheets/{activeGroup.id})
  const handleSaveSpreadsheet = async () => {
    if (!selectedCategory || !selectedGroupId || !activeGroup) return;

    setIsSavingSpreadsheet(true);
    try {
      const cleanGrp = normalizeGroupId(selectedGroupId);
      await groupSpreadsheetService.saveSpreadsheet({
        groupDocId: activeGroup.id,
        chitValue: selectedCategory,
        groupId: cleanGrp,
        columns: spreadsheetColumns,
        rows: spreadsheetRows,
      });

      setIsDirty(false);
      showToast(`✓ Blank spreadsheet for Group ${cleanGrp} saved to Firebase!`, 'success');
    } catch (err) {
      console.error('Failed to save spreadsheet:', err);
      showToast(`Failed to save spreadsheet: ${err.message}`, 'error');
    } finally {
      setIsSavingSpreadsheet(false);
    }
  };

  // Export genuine .xlsx workbook
  const handleExportExcel = () => {
    if (!spreadsheetRows.length) {
      showToast('No rows to export for this group spreadsheet.', 'error');
      return;
    }

    try {
      const cleanGrp = normalizeGroupId(selectedGroupId);
      const categoryLakh = (selectedCategory / 100000).toFixed(0);
      const titleBanner = `Raghavendra Chitts — ₹${categoryLakh} Lakh Chit (Group ${cleanGrp}) Spreadsheet`;
      const exportDate = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const headerNames = spreadsheetColumns.map((col) => col.name);
      const dataRows = spreadsheetRows.map((row) =>
        spreadsheetColumns.map((col) => row.cells?.[col.id] || '')
      );

      const worksheetData = [
        [titleBanner],
        [`Export Date: ${exportDate} | Rows: ${spreadsheetRows.length} | Columns: ${spreadsheetColumns.length}`],
        [], // empty separator row
        headerNames,
        ...dataRows,
      ];

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Compute dynamic column widths
      ws['!cols'] = spreadsheetColumns.map((col, idx) => {
        const headerLen = String(col.name || '').length;
        const maxCellLen = Math.max(
          ...dataRows.map((r) => String(r[idx] || '').length),
          0
        );
        return { wch: Math.max(12, Math.min(Math.max(headerLen, maxCellLen) + 4, 45)) };
      });

      const wb = XLSX.utils.book_new();
      const validSheetName = `Group_${cleanGrp}_${categoryLakh}L`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, validSheetName);

      const fileName = `Raghavendra_Chitts_${categoryLakh}L_Group_${cleanGrp}_Sheet_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showToast(`✓ Genuine Excel spreadsheet exported: ${fileName}!`, 'success');
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

  // Manage Columns Modal Handlers
  const handleOpenManageColumns = () => {
    setEditingColumns(spreadsheetColumns.map((col) => ({ ...col })));
    setNewColumnName('');
    setIsManageColumnsModalOpen(true);
  };

  const handleSaveColumnChanges = () => {
    setSpreadsheetColumns([...editingColumns]);
    setIsDirty(true);
    setIsManageColumnsModalOpen(false);
    showToast('Spreadsheet columns updated! Click "Save Changes" to persist in Firebase.', 'info');
  };

  const handleModalAddColumn = () => {
    const trimmed = newColumnName.trim();
    const colName = trimmed || `Column ${editingColumns.length}`;
    const newColId = `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setEditingColumns([...editingColumns, { id: newColId, name: colName, width: 180 }]);
    setNewColumnName('');
  };

  const handleModalDeleteColumn = (colId) => {
    if (editingColumns.length <= 1) {
      showToast('Cannot delete all columns. At least one column must remain.', 'error');
      return;
    }
    setEditingColumns(editingColumns.filter((c) => c.id !== colId));
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
              {currentView === 'sheet' && `Group ${activeGroup?.groupId} Spreadsheet`}
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              {currentView === 'categories' && 'Select a chit category to explore its groups and open their independent Excel spreadsheets.'}
              {currentView === 'groups' && 'Select a specific chit group below to view and edit its blank custom Excel spreadsheet.'}
              {currentView === 'sheet' && `Blank, editable spreadsheet for Group ${activeGroup?.groupId}. Add custom rows, columns, and remarks. Changes persist in Firebase.`}
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
                  onClick={handleOpenManageColumns}
                  className="rounded-xl gap-2 cursor-pointer font-bold border-[#E5E7EB]"
                  title="Rename, add, or delete column headers"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Manage Columns</span>
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
                  disabled={isSavingSpreadsheet || !isDirty}
                  className="rounded-xl gap-2 cursor-pointer font-bold shadow-xs"
                >
                  <Save className={`w-4 h-4 ${isSavingSpreadsheet ? 'animate-spin' : ''}`} />
                  <span>{isSavingSpreadsheet ? 'Saving...' : isDirty ? 'Save Changes *' : 'Saved'}</span>
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

      {/* ─── SCREEN 3: BLANK EDITABLE EXCEL-STYLE GROUP SPREADSHEET ────────────── */}
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
                  ₹{(selectedCategory / 100000).toFixed(0)} Lakh Chit • Group {activeGroup.groupId} Spreadsheet
                </h2>
                <p className="text-[11px] text-[#667085]">
                  {spreadsheetRows.length} Rows • {spreadsheetColumns.length} Columns • Independent sheet saved to Firebase
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search inside sheet..."
                  value={sheetSearchQuery}
                  onChange={(e) => setSheetSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] focus:outline-none focus:border-[#285F52] w-52"
                />
              </div>

              {/* QUICK ROW & COLUMN ADD ACTIONS */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="rounded-xl text-xs gap-1 font-bold cursor-pointer"
                title="Add a new row at the bottom"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAdd5Rows}
                className="rounded-xl text-xs gap-1 font-bold cursor-pointer"
                title="Add 5 empty rows at once"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+5 Rows</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddColumn()}
                className="rounded-xl text-xs gap-1 font-bold cursor-pointer"
                title="Add a new custom column"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Column</span>
              </Button>

              {isDirty && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FFF8E7] text-[#B7791F] font-bold text-xs border border-[#FDE68A]">
                  <span className="w-2 h-2 rounded-full bg-[#B7791F] animate-pulse"></span>
                  Unsaved Edits
                </span>
              )}
            </div>
          </div>

          {/* SPREADSHEET GRID TABLE */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
            {isLoadingSpreadsheet ? (
              <div className="p-16 text-center text-xs font-bold text-[#667085]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#285F52] mb-2" />
                Loading group spreadsheet...
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  {/* STICKY EXCEL-STYLE TABLE HEADER */}
                  <thead className="bg-[#F7F8F7] sticky top-0 z-10 border-b border-[#E5E7EB] shadow-xs text-[#111111]">
                    <tr>
                      {spreadsheetColumns.map((col, cIdx) => (
                        <th
                          key={col.id}
                          style={{ minWidth: col.width || 160 }}
                          className={`p-3 font-black border-r border-[#E5E7EB] uppercase tracking-wider text-[11px] ${
                            col.id === 'col_sno' ? 'text-center w-14 min-w-[60px] text-[#667085]' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between group">
                            <span>{col.name}</span>
                            {col.id !== 'col_sno' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(col.id)}
                                title={`Delete ${col.name}`}
                                className="opacity-0 group-hover:opacity-100 text-[#98A2B3] hover:text-[#B42318] p-0.5 rounded cursor-pointer transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="p-3 w-12 text-center text-[#667085] uppercase tracking-wider text-[10px]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  {/* SPREADSHEET ROWS */}
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={spreadsheetColumns.length + 1}
                          className="p-12 text-center text-[#667085] font-bold text-xs"
                        >
                          {sheetSearchQuery
                            ? 'No rows match the search query.'
                            : 'This spreadsheet is currently blank. Click "+ Add Row" above to begin entering data.'}
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, rIdx) => {
                        const cells = row.cells || {};

                        return (
                          <tr
                            key={row.id}
                            className="hover:bg-[#F9FAFB] transition-colors group"
                          >
                            {spreadsheetColumns.map((col) => {
                              const isSNo = col.id === 'col_sno';
                              const cellValue = cells[col.id] !== undefined ? cells[col.id] : '';

                              return (
                                <td
                                  key={col.id}
                                  className={`p-1.5 border-r border-[#E5E7EB] ${
                                    isSNo ? 'bg-[#F7F8F7]/40 text-center font-bold text-[#667085]' : ''
                                  }`}
                                >
                                  {isSNo ? (
                                    <span className="font-mono text-xs">{cellValue || rIdx + 1}</span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={cellValue}
                                      onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                                      placeholder="—"
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-transparent hover:border-[#E5E7EB] focus:border-[#285F52] focus:bg-white focus:outline-none transition-all font-medium text-[#111111] bg-transparent"
                                    />
                                  )}
                                </td>
                              );
                            })}

                            {/* ROW ACTION: DELETE ROW */}
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                title="Delete this row"
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2] rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SPREADSHEET FOOTER BAR */}
            <div className="bg-[#F7F8F7] border-t border-[#E5E7EB] p-3 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[#667085]">
              <div className="flex items-center gap-4">
                <span>Total Rows: <strong className="text-[#111111] font-mono">{spreadsheetRows.length}</strong></span>
                <span>•</span>
                <span>Total Columns: <strong className="text-[#111111] font-mono">{spreadsheetColumns.length}</strong></span>
                <span>•</span>
                <span className="text-[11px] text-[#667085]">
                  Dedicated Firestore sheet: <code className="font-mono text-[#285F52]">groupSpreadsheets/{activeGroup.id}</code>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="rounded-xl text-xs gap-1 font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSpreadsheet}
                  disabled={isSavingSpreadsheet || !isDirty}
                  className="rounded-xl text-xs gap-1.5 shadow-xs font-bold cursor-pointer"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingSpreadsheet ? 'animate-spin' : ''}`} />
                  <span>{isSavingSpreadsheet ? 'Saving...' : isDirty ? 'Save Changes *' : 'All Changes Saved ✓'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: MANAGE SPREADSHEET COLUMNS ─────────────────────────────────── */}
      {isManageColumnsModalOpen && (
        <Modal
          isOpen={isManageColumnsModalOpen}
          onClose={() => setIsManageColumnsModalOpen(false)}
          title="Manage Spreadsheet Columns"
          subtitle={`Configure custom headers and columns for Group ${activeGroup?.groupId}.`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                Existing Columns
              </label>

              {editingColumns.map((col, idx) => (
                <div key={col.id} className="flex items-center gap-2">
                  <span className="w-6 text-center font-mono font-bold text-[#667085]">{idx + 1}.</span>
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingColumns((prev) =>
                        prev.map((c) => (c.id === col.id ? { ...c, name: val } : c))
                      );
                    }}
                    disabled={col.id === 'col_sno'}
                    className={`flex-1 px-3 py-1.5 rounded-xl border border-[#E5E7EB] font-bold text-[#111111] focus:outline-none focus:border-[#285F52] ${
                      col.id === 'col_sno' ? 'bg-[#F7F8F7] text-[#667085] cursor-not-allowed' : ''
                    }`}
                  />
                  {col.id !== 'col_sno' && (
                    <button
                      type="button"
                      onClick={() => handleModalDeleteColumn(col.id)}
                      className="p-2 text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2] rounded-xl transition-colors cursor-pointer"
                      title="Remove column"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ADD NEW COLUMN SECTION INSIDE MODAL */}
            <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
              <label className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                Add New Column
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Receipt No, Chit Month, Token..."
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleModalAddColumn();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[#E5E7EB] font-medium text-[#111111] focus:outline-none focus:border-[#285F52]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleModalAddColumn}
                  className="rounded-xl font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsManageColumnsModalOpen(false)}
                className="rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveColumnChanges}
                className="rounded-xl font-bold cursor-pointer shadow-xs"
              >
                Apply Columns
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
          subtitle="You have unsaved changes in this group spreadsheet."
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs font-sans">
            <p className="text-[#667085] leading-relaxed">
              If you leave this group spreadsheet without saving, your recent edits will be lost.
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
