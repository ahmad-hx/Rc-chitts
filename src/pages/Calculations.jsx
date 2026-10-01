import React, { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Clock,
  BookOpen,
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import { calculationService } from '../services/calculationService';

export default function Calculations() {
  // Active Note Editor State
  const [activeId, setActiveId] = useState(null); // null = new note
  const [title, setTitle] = useState('New Note');
  const [content, setContent] = useState('');

  // Status & Loading Tracking
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [isSaving, setIsSaving] = useState(false);

  // Firestore Saved Notes List
  const [savedNotes, setSavedNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete Modal & Toast Feedback
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Load Saved Notes from Firestore on Mount
  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await calculationService.getCalculations();
      setSavedNotes(data);
    } catch (err) {
      console.error('Failed to load notes from Firestore:', err);
      showToast('Failed to load saved notes from Firebase.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Text/Title Edits
  const handleTitleChange = (newTitle) => {
    setTitle(newTitle);
    setSaveStatus('unsaved');
  };

  const handleContentChange = (newContent) => {
    setContent(newContent);
    setSaveStatus('unsaved');
  };

  // Create New Unsaved Note Workspace
  const handleNewNote = () => {
    setActiveId(null);
    setTitle('New Note');
    setContent('');
    setSaveStatus('saved');
    showToast('Created a new working note editor.', 'info');
  };

  // Open an Existing Note
  const handleOpenNote = (note) => {
    if (!note) return;
    setActiveId(note.id);
    setTitle(note.title || 'New Note');
    setContent(note.content || '');
    setSaveStatus('saved');
    showToast(`Opened "${note.title || 'New Note'}".`, 'info');
  };

  // Explicit Save Action to Firestore
  const handleSaveNote = async () => {
    const finalTitle = title.trim() || 'New Note';
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      if (activeId) {
        // Update existing document in Firestore
        await calculationService.updateCalculation(activeId, {
          title: finalTitle,
          content,
        });
        showToast(`Saved changes to "${finalTitle}".`, 'success');
      } else {
        // Create new document in Firestore
        const created = await calculationService.createCalculation({
          title: finalTitle,
          content,
        });
        setActiveId(created.id);
        showToast(`Note "${finalTitle}" saved to Firebase.`, 'success');
      }

      setSaveStatus('saved');
      await loadNotes();
    } catch (err) {
      console.error('Firestore save error:', err);
      setSaveStatus('error');
      showToast('Unable to save note. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Note Confirmation & Execution
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const targetTitle = deleteTarget.title || 'Note';

    try {
      await calculationService.deleteCalculation(targetId);
      showToast(`Deleted note "${targetTitle}".`, 'success');
      
      if (activeId === targetId) {
        handleNewNote();
      }
      setDeleteTarget(null);
      await loadNotes();
    } catch (err) {
      console.error('Firestore delete error:', err);
      showToast('Unable to delete note. Please try again.', 'error');
    }
  };

  // Filter Saved Notes
  const filteredNotes = savedNotes.filter((note) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (note.title && note.title.toLowerCase().includes(q)) ||
      (note.content && note.content.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 md:space-y-8 font-sans max-w-7xl mx-auto pb-16">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#285F52] animate-pulse"></span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#285F52]">
              Financial Working Notes
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight">Calculations</h1>
          <p className="text-xs font-semibold text-[#667085] mt-1">
            Write, save and manage your financial working notes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleNewNote}
            className="gap-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer border-[#E5E7EB] bg-white text-[#111111]"
          >
            <Plus className="w-4 h-4 text-[#285F52]" />
            New Note
          </Button>

          <Button
            variant="primary"
            onClick={handleSaveNote}
            disabled={isSaving}
            className="gap-2 rounded-xl text-xs font-bold bg-[#285F52] hover:bg-[#214D43] text-white shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {activeId ? 'Save Changes' : 'Save Note'}
          </Button>
        </div>
      </div>

      {/* MAIN WORKSPACE: EDITOR & SAVED NOTES ROSTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: FREE-FORM NOTEPAD EDITOR (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 md:p-6 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs space-y-4">
            {/* TITLE INPUT */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#667085]">
                  Note Title
                </label>
                {activeId && (
                  <span className="text-[10px] font-bold text-[#285F52] bg-[#EEF6F3] px-2 py-0.5 rounded-md border border-[#BFD8D0]">
                    Editing Existing Note
                  </span>
                )}
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. August 2026 Collection"
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-4 py-2.5 text-sm font-bold text-[#111111] placeholder-[#98A2B3] focus:border-[#285F52] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#285F52] transition-all"
              />
            </div>

            {/* FREE-FORM NOTEPAD TEXTAREA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#667085]">
                  Workspace & Working Notes
                </label>
                <span className="text-[10px] font-semibold text-[#98A2B3]">
                  Free-form text area
                </span>
              </div>

              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder={`August 2026 Collection\n\n5000 × 20 = 100000\nPaid = 85000\nBalance = 15000\n\nGroup I pending verification.`}
                rows={14}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] p-4 text-xs font-mono font-medium text-[#111111] leading-relaxed placeholder-[#98A2B3] focus:border-[#285F52] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#285F52] transition-all resize-y min-h-[300px]"
              />
            </div>

            {/* EDITOR FOOTER ACTION BAR */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
              {/* SAVE STATUS BADGE */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] text-xs font-bold">
                {saveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#285F52]" />
                    <span className="text-[#285F52]">Saved</span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-[#285F52] animate-spin" />
                    <span className="text-[#285F52]">Saving...</span>
                  </>
                )}
                {saveStatus === 'unsaved' && (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-[#B7791F]" />
                    <span className="text-[#B7791F]">Unsaved changes</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-[#B42318]" />
                    <span className="text-[#B42318]">Save failed</span>
                  </>
                )}
              </div>

              {/* EDITOR BUTTONS */}
              <div className="flex items-center gap-2">
                {activeId && (
                  <Button
                    variant="outline"
                    onClick={() => setDeleteTarget(savedNotes.find((n) => n.id === activeId) || { id: activeId, title })}
                    className="gap-1.5 text-xs text-[#B42318] border-[#FECACA] bg-[#FEF3F2] hover:bg-[#FEE4E2] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Note
                  </Button>
                )}

                <Button
                  variant="primary"
                  onClick={handleSaveNote}
                  disabled={isSaving}
                  className="gap-2 text-xs bg-[#285F52] hover:bg-[#214D43] text-white cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {activeId ? 'Save Changes' : 'Save Note'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: SAVED NOTES LIST (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 md:p-6 border border-[#E5E7EB] bg-white rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#285F52]" />
                <h2 className="text-sm font-black text-[#111111]">Saved Notes ({savedNotes.length})</h2>
              </div>

              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] pl-8 pr-3 py-1.5 text-xs font-semibold text-[#111111] placeholder-[#98A2B3] focus:border-[#285F52] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#285F52]"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-[#667085] font-bold text-xs bg-[#F7F8F7] rounded-xl border border-[#E5E7EB]">
                Loading notes from Firebase...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-[#667085] bg-[#F7F8F7] rounded-xl border border-[#E5E7EB] space-y-2">
                <FileText className="w-8 h-8 text-[#98A2B3] mx-auto" />
                <p className="text-xs font-bold text-[#111111]">No working notes found.</p>
                <p className="text-[11px] text-[#98A2B3]">
                  Click <strong className="text-[#285F52]">+ New Note</strong> to write and save working notes.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredNotes.map((note) => {
                  const isActive = activeId === note.id;
                  const updatedDateStr = note.updatedAt
                    ? new Date(note.updatedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';

                  return (
                    <div
                      key={note.id}
                      className={`p-4 rounded-xl border transition-all space-y-2 cursor-pointer ${
                        isActive
                          ? 'border-[#285F52] bg-[#EEF6F3] ring-1 ring-[#285F52]/30'
                          : 'border-[#E5E7EB] bg-white hover:border-[#BFD8D0] hover:bg-[#F7F8F7]'
                      }`}
                      onClick={() => handleOpenNote(note)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-black text-[#111111] truncate max-w-[75%]">
                          {note.title || 'New Note'}
                        </h3>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenNote(note);
                            }}
                            className="p-1 rounded-lg text-[#285F52] hover:bg-[#EEF6F3] transition-colors cursor-pointer"
                            title="Open Note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(note);
                            }}
                            className="p-1 rounded-lg text-[#B42318] hover:bg-[#FEF3F2] transition-colors cursor-pointer"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] font-mono text-[#667085] line-clamp-3 bg-[#F7F8F7] p-2.5 rounded-lg border border-[#E5E7EB] whitespace-pre-wrap">
                        {note.content || '(Empty note)'}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-[#98A2B3] pt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#98A2B3]" />
                          <span>Last updated: {updatedDateStr}</span>
                        </div>
                        <span className="font-bold text-[#285F52]">Open →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* CONFIRM DELETE MODAL */}
      {deleteTarget && (
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Note">
          <div className="space-y-4 font-sans">
            <div className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF3F2] space-y-1">
              <p className="text-xs font-bold text-[#B42318]">Delete this note?</p>
              <p className="text-xs text-[#B42318]">This note will be permanently deleted.</p>
            </div>

            <p className="text-xs text-[#667085]">
              Note title: <strong className="text-[#111111]">"{deleteTarget.title || 'New Note'}"</strong>
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
              <Button
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl text-xs cursor-pointer border-[#E5E7EB] bg-white text-[#111111]"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                className="rounded-xl text-xs bg-[#B42318] hover:bg-[#911E15] text-white cursor-pointer"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
