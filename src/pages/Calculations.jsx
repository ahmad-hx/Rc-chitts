import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator,
  Save,
  Plus,
  Trash2,
  Copy,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  FileText,
  Search,
  CornerDownLeft,
  ArrowRight,
  Clock,
  Check,
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import { calculationService } from '../services/calculationService';
import {
  evaluateExpression,
  evaluateWorkspaceContent,
  formatCurrency,
} from '../utils/mathEvaluator';

export default function Calculations() {
  // State for active calculation workspace
  const [activeId, setActiveId] = useState(null); // null if new calculation
  const [title, setTitle] = useState('New Calculation');
  const [content, setContent] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  
  // Auto-save & status tracking
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimerRef = useRef(null);

  // Firestore saved calculations list
  const [savedCalculations, setSavedCalculations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Calculator State
  const [quickExpr, setQuickExpr] = useState('5000 × 20 - 15000');
  const [quickResult, setQuickResult] = useState(null);

  // Modal & Toast states
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Preset Title Suggestions
  const titleSuggestions = [
    'August 2026 Calculation',
    'Chit Auction Calculation',
    'Monthly Collection Calculation',
    'Member Balance Calculation',
  ];

  // Load Saved Calculations from Firestore on Mount
  useEffect(() => {
    loadCalculations();
  }, []);

  const loadCalculations = async () => {
    setLoading(true);
    try {
      const data = await calculationService.getCalculations();
      setSavedCalculations(data);
    } catch (err) {
      console.error('Failed to load calculations:', err);
      showToast('Failed to load saved calculations.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Evaluate Quick Calculator on Change
  useEffect(() => {
    if (!quickExpr.trim()) {
      setQuickResult(null);
      return;
    }
    const res = evaluateExpression(quickExpr);
    setQuickResult(res);
  }, [quickExpr]);

  // Track Content/Title changes for Auto-Save status
  const handleContentChange = (newContent) => {
    setContent(newContent);
    markUnsaved();
  };

  const handleTitleChange = (newTitle) => {
    setTitle(newTitle);
    markUnsaved();
  };

  const markUnsaved = () => {
    setSaveStatus('unsaved');
    // Debounce auto-save if an existing item is active
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    
    if (activeId) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleAutoSave();
      }, 2000);
    }
  };

  // Auto-Save Execution
  const handleAutoSave = async () => {
    if (!activeId || isSaving) return;
    setSaveStatus('saving');
    try {
      const evalRes = evaluateWorkspaceContent(content);
      const resStr = evalRes.validMathCount > 0 ? evalRes.formattedGrandTotal : '';

      await calculationService.updateCalculation(activeId, {
        title,
        content,
        result: resStr,
      });

      setSaveStatus('saved');
      loadCalculations();
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSaveStatus('unsaved');
    }
  };

  // Manual Calculate Action
  const handleCalculate = () => {
    const evalRes = evaluateWorkspaceContent(content);
    setEvaluation(evalRes);
    if (evalRes.validMathCount > 0) {
      showToast(`Calculated: Grand Total ${evalRes.formattedGrandTotal}`);
    } else {
      showToast('Evaluated workspace. No mathematical expressions found.', 'info');
    }
  };

  // Manual Save Action
  const handleSave = async () => {
    if (!title.trim()) {
      showToast('Please enter a title for your calculation.', 'warning');
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const evalRes = evaluateWorkspaceContent(content);
      const resStr = evalRes.validMathCount > 0 ? evalRes.formattedGrandTotal : '';

      if (activeId) {
        // Update existing document
        await calculationService.updateCalculation(activeId, {
          title,
          content,
          result: resStr,
        });
        showToast(`Calculation "${title}" updated successfully.`);
      } else {
        // Create new document
        const created = await calculationService.createCalculation({
          title,
          content,
          result: resStr,
        });
        setActiveId(created.id);
        showToast(`Calculation "${title}" saved to Firestore.`);
      }

      setSaveStatus('saved');
      setEvaluation(evalRes);
      loadCalculations();
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('unsaved');
      showToast('Failed to save calculation. Please try again.', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  // Create New Workspace
  const handleNewCalculation = () => {
    if (saveStatus === 'unsaved' && content.trim()) {
      if (!window.confirm('You have unsaved changes in the current workspace. Open a new calculation anyway?')) {
        return;
      }
    }
    setActiveId(null);
    setTitle('New Calculation');
    setContent('5000 + 3000\n100000 - 25000\n5000 × 20');
    setEvaluation(null);
    setSaveStatus('saved');
    showToast('Created a new calculation workspace.');
  };

  // Open Saved Calculation
  const handleOpenCalculation = (calc) => {
    if (saveStatus === 'unsaved' && content.trim()) {
      if (!window.confirm('You have unsaved changes in the current workspace. Switch calculation anyway?')) {
        return;
      }
    }
    setActiveId(calc.id);
    setTitle(calc.title || 'Untitled Calculation');
    setContent(calc.content || '');
    const evalRes = evaluateWorkspaceContent(calc.content || '');
    setEvaluation(evalRes);
    setSaveStatus('saved');
    showToast(`Loaded "${calc.title}".`);
  };

  // Duplicate Saved Calculation
  const handleDuplicate = async (calc) => {
    try {
      const duplicated = await calculationService.duplicateCalculation(calc);
      showToast(`Duplicated as "${duplicated.title}".`);
      await loadCalculations();
    } catch (err) {
      console.error('Duplicate error:', err);
      showToast('Failed to duplicate calculation.', 'danger');
    }
  };

  // Confirm and Delete Calculation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await calculationService.deleteCalculation(deleteTarget.id);
      showToast(`Deleted "${deleteTarget.title}".`);
      if (activeId === deleteTarget.id) {
        handleNewCalculation();
      }
      setDeleteTarget(null);
      loadCalculations();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete calculation.', 'danger');
    }
  };

  // Insert Quick Calculation Result into Main Workspace
  const handleInsertQuickResult = () => {
    if (!quickResult || !quickResult.success) {
      showToast('No valid quick calculation to insert.', 'warning');
      return;
    }
    const insertText = `\n${quickExpr} = ${quickResult.formatted}`;
    setContent((prev) => prev + insertText);
    markUnsaved();
    showToast(`Inserted "${quickExpr} = ${quickResult.formatted}" into workspace.`);
  };

  // Filtered saved calculations
  const filteredCalculations = savedCalculations.filter((calc) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (calc.title && calc.title.toLowerCase().includes(query)) ||
      (calc.content && calc.content.toLowerCase().includes(query)) ||
      (calc.result && calc.result.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 md:space-y-8 font-sans">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E5E1] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#2F5D50] animate-pulse"></span>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2F5D50]">
              Financial Working & Calculator
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#1C1C1A]">Calculations</h1>
          <p className="text-xs font-semibold text-[#6B6B67] mt-1">
            Perform freeform financial workings, chit auction math, monthly collection calculations, and persist notes safely.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* AUTO SAVE INDICATOR */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E5E1] bg-white shadow-2xs text-xs font-bold">
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6B4F]" />
                <span className="text-[#2F6B4F]">Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#2F5D50] animate-spin" />
                <span className="text-[#2F5D50]">Saving...</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-amber-700">Unsaved changes</span>
              </>
            )}
          </div>

          <Button variant="secondary" onClick={handleNewCalculation} className="gap-2 text-xs">
            <Plus className="w-4 h-4" />
            New Calculation
          </Button>

          <Button variant="primary" onClick={handleSave} disabled={isSaving} className="gap-2 text-xs">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* QUICK CALCULATION PANEL */}
      <Card className="p-5 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2F5D50] text-white">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-[#1C1C1A] uppercase tracking-wider">Quick Calculation Panel</h3>
              <p className="text-[11px] text-[#6B6B67]">Instant mathematical evaluator utility</p>
            </div>
          </div>

          {quickResult && quickResult.success && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInsertQuickResult}
              className="gap-1.5 text-[11px] bg-white border-[#2F5D50]/30 text-[#2F5D50] hover:bg-[#2F5D50] hover:text-white"
            >
              <CornerDownLeft className="w-3 h-3" />
              Insert into Workspace
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8 flex items-center gap-2">
            <input
              type="text"
              value={quickExpr}
              onChange={(e) => setQuickExpr(e.target.value)}
              placeholder="e.g. 5000 × 20 - 15000"
              className="w-full rounded-xl border border-[#E5E5E1] bg-white px-3.5 py-2 text-xs font-mono font-bold text-[#1C1C1A] placeholder-[#959590] focus:border-[#2F5D50] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
            {/* Quick Math Character Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {['+', '-', '×', '÷', '(', ')'].map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setQuickExpr((prev) => prev + ` ${op} `)}
                  className="h-8 w-8 rounded-lg border border-[#E5E5E1] bg-white text-xs font-bold text-[#1C1C1A] hover:bg-[#2F5D50] hover:text-white transition-colors cursor-pointer"
                >
                  {op}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuickExpr('')}
                className="h-8 px-2 rounded-lg border border-[#E5E5E1] bg-white text-[10px] font-extrabold text-red-600 hover:bg-red-50 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="md:col-span-4 flex items-center justify-between bg-white border border-[#E5E5E1] rounded-xl px-4 py-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#959590]">Result:</span>
            <span className="text-base font-black text-[#2F5D50] font-mono">
              {quickResult ? (
                quickResult.success ? (
                  quickResult.formatted
                ) : (
                  <span className="text-xs text-red-500 font-sans">{quickResult.error}</span>
                )
              ) : (
                '₹0'
              )}
            </span>
          </div>
        </div>
      </Card>

      {/* MAIN CALCULATION WORKSPACE & EVALUATION BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WORKSPACE EDITOR (8 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 md:p-6 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-4">
            {/* TITLE INPUT & SUGGESTIONS */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#6B6B67] mb-1.5">
                Calculation Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. August 2026 Chit Auction Working"
                className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-4 py-2.5 text-sm font-bold text-[#1C1C1A] placeholder-[#959590] focus:border-[#2F5D50] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
              />

              {/* Title Suggestion Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[10px] font-bold text-[#959590]">Suggestions:</span>
                {titleSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleTitleChange(sug)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-[#E5E5E1] bg-[#F7F7F5] text-[#1C1C1A] hover:bg-[#2F5D50] hover:text-white transition-colors cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* WORKSPACE EDITOR TEXTAREA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#6B6B67]">
                  Calculation Workspace & Notes
                </label>
                <span className="text-[10px] font-semibold text-[#959590]">
                  Supports +, -, ×, ÷, %, parentheses and multi-line working
                </span>
              </div>

              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder={`Type calculations or working notes line-by-line:\n\nAugust 2026 Collection Working\n5000 + 3000\n100000 - 25000\n5000 × 20`}
                rows={12}
                className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] p-4 text-xs font-mono font-semibold text-[#1C1C1A] leading-relaxed placeholder-[#959590] focus:border-[#2F5D50] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F5D50] transition-all"
              />
            </div>

            {/* WORKSPACE ACTION BAR */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E1]">
              <span className="text-[11px] text-[#6B6B67]">
                {content.split('\n').length} line(s) written
              </span>

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleCalculate} className="gap-2 text-xs">
                  <Calculator className="w-3.5 h-3.5 text-[#2F5D50]" />
                  Calculate
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving} className="gap-2 text-xs">
                  <Save className="w-3.5 h-3.5" />
                  Save Calculation
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* EVALUATION RESULTS & BREAKDOWN SUMMARY (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 md:p-6 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2F5D50]" />
                <h3 className="text-sm font-black text-[#1C1C1A]">Calculation Summary</h3>
              </div>
              {evaluation && (
                <Badge variant="success" className="text-[10px]">
                  {evaluation.validMathCount} Expression(s) Evaluated
                </Badge>
              )}
            </div>

            {!evaluation ? (
              <div className="p-8 text-center text-[#6B6B67] space-y-2">
                <Calculator className="w-8 h-8 text-[#959590] mx-auto" />
                <p className="text-xs font-bold text-[#1C1C1A]">Ready to Calculate</p>
                <p className="text-[11px]">
                  Click the <strong className="text-[#2F5D50]">Calculate</strong> button to evaluate expressions in your workspace safely.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* GRAND TOTAL CARD */}
                <div className="p-4 rounded-xl border border-[#2F5D50]/30 bg-[#EDF7F0] space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#2F5D50]">Grand Total</p>
                  <p className="text-2xl font-black text-[#1C1C1A] font-mono">{evaluation.formattedGrandTotal}</p>
                  <p className="text-[10px] font-semibold text-[#2F6B4F]">{evaluation.summaryMessage}</p>
                </div>

                {/* LINE-BY-LINE BREAKDOWN */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-[#1C1C1A] uppercase tracking-wider">Line Breakdown</h4>
                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {evaluation.lines.map((line, idx) => {
                      if (!line.raw.trim()) return null;
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-mono ${
                            line.isMath
                              ? 'bg-white border-[#2F5D50]/30 text-[#1C1C1A]'
                              : 'bg-[#F7F7F5] border-[#E5E5E1] text-[#6B6B67] font-sans'
                          }`}
                        >
                          <span className="truncate max-w-[65%]">
                            {line.isMath ? line.expression : line.text}
                          </span>
                          {line.isMath ? (
                            <span className="font-bold text-[#2F5D50] shrink-0">{line.formatted}</span>
                          ) : (
                            <span className="text-[9px] text-[#959590] font-sans italic shrink-0">Text note</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* SAVED CALCULATIONS SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E1] pb-3">
          <div>
            <h2 className="text-lg font-black text-[#1C1C1A]">Saved Calculations ({savedCalculations.length})</h2>
            <p className="text-xs font-semibold text-[#6B6B67]">
              Stored securely in Firestore collection <code className="bg-[#E5E5E1] px-1.5 py-0.5 rounded text-[11px] font-mono text-[#1C1C1A]">calculations</code>
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#959590]" />
            <input
              type="text"
              placeholder="Search saved calculations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E1] bg-white pl-9 pr-3 py-2 text-xs font-semibold text-[#1C1C1A] placeholder-[#959590] focus:border-[#2F5D50] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
          </div>
        </div>

        {loading ? (
          <Card className="p-10 text-center text-[#6B6B67] font-bold text-xs bg-white border border-[#E5E5E1] rounded-2xl">
            Loading saved calculations...
          </Card>
        ) : filteredCalculations.length === 0 ? (
          <Card className="p-10 text-center text-[#6B6B67] font-bold text-xs bg-white border border-[#E5E5E1] rounded-2xl space-y-2">
            <FileText className="w-8 h-8 text-[#959590] mx-auto" />
            <p>No saved calculations found.</p>
            <p className="text-[11px] font-normal text-[#959590]">
              Create a calculation above and click <strong className="text-[#2F5D50]">Save</strong> to persist your records.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCalculations.map((calc) => {
              const isActive = activeId === calc.id;
              return (
                <Card
                  key={calc.id}
                  className={`p-4 border rounded-2xl transition-all space-y-3 flex flex-col justify-between ${
                    isActive
                      ? 'border-[#2F5D50] bg-[#EDF7F0]/40 ring-1 ring-[#2F5D50]/30'
                      : 'border-[#E5E5E1] bg-white hover:border-[#2F5D50]/50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-extrabold text-[#1C1C1A] line-clamp-1">{calc.title}</h3>
                      {calc.result && (
                        <span className="text-xs font-black text-[#2F5D50] bg-[#EDF7F0] px-2 py-0.5 rounded-lg border border-[#2F5D50]/20 font-mono shrink-0">
                          {calc.result}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-[#6B6B67] line-clamp-3 bg-[#F7F7F5] p-2.5 rounded-xl border border-[#E5E5E1]">
                      {calc.content || '(No text content)'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#E5E5E1] flex items-center justify-between text-[11px] text-[#959590]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#959590]" />
                      <span>{new Date(calc.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenCalculation(calc)}
                        className="p-1.5 rounded-lg text-[#2F5D50] hover:bg-[#EDF7F0] transition-colors cursor-pointer"
                        title="Open & Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDuplicate(calc)}
                        className="p-1.5 rounded-lg text-[#6B6B67] hover:bg-[#F2F2EF] hover:text-[#1C1C1A] transition-colors cursor-pointer"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteTarget(calc)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      {deleteTarget && (
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Calculation">
          <div className="space-y-4">
            <p className="text-xs text-[#6B6B67] leading-relaxed">
              Are you sure you want to delete the saved calculation <strong className="text-[#1C1C1A]">"{deleteTarget.title}"</strong>?
              This document will be permanently removed from Firestore.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
