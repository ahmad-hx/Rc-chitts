import React, { useState } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

export default function ChitMonthEditor({
  currentMonth = 1,
  totalMonths = 20,
  onSave,
  className = '',
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(String(currentMonth));
  const [saving, setSaving] = useState(false);

  const startEdit = (e) => {
    e.stopPropagation();
    setVal(String(currentMonth));
    setIsEditing(true);
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setVal(String(currentMonth));
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    const num = parseInt(val, 10);
    const maxVal = Number(totalMonths || 20);

    if (isNaN(num) || num < 1 || num > maxVal) {
      alert(`Please enter a valid month between 1 and ${maxVal}.`);
      return;
    }

    setSaving(true);
    try {
      if (onSave) {
        await onSave(num);
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save chit month:', err);
      alert(`Failed to save chit month: ${err?.message || 'Error occurred'}`);
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-white border border-emerald-500/40 rounded-lg px-1.5 py-0.5 shadow-xs ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] text-slate-400 font-sans font-medium">Chit Month:</span>
        <input
          type="number"
          min="1"
          max={totalMonths}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave(e);
            if (e.key === 'Escape') cancelEdit(e);
          }}
          className="w-9 rounded border border-slate-300 bg-slate-50 px-1 py-0.2 text-center text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          autoFocus
          disabled={saving}
        />
        <span className="text-slate-400 text-xs font-bold">/ {totalMonths}</span>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          title="Save Chit Month"
          className="p-0.5 hover:bg-emerald-100 text-emerald-700 rounded cursor-pointer transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={cancelEdit}
          disabled={saving}
          title="Cancel"
          className="p-0.5 hover:bg-rose-100 text-rose-600 rounded cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 group/month text-slate-700 font-medium ${className}`}
      title="Click pencil to edit chit month"
    >
      <span className="font-mono font-extrabold text-slate-900">
        {currentMonth}/{totalMonths}
      </span>
      <button
        type="button"
        onClick={startEdit}
        className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer transition-colors"
        title="Edit chit month"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </span>
  );
}
