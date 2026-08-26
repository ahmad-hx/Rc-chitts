import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Edit3, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { dashboardImageService } from '../services/dashboardImageService';

export default function EditDashboardImageModal({ isOpen, onClose, imageDoc, onImageUpdated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (imageDoc) {
      setTitle(imageDoc.title || '');
      setDescription(imageDoc.description || '');
      setError('');
    }
  }, [imageDoc, isOpen]);

  if (!imageDoc) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      await dashboardImageService.updateDashboardImage(imageDoc.id, {
        title,
        description,
      });

      onImageUpdated?.({
        ...imageDoc,
        title: title.trim(),
        description: description.trim(),
      });
      onClose?.();
    } catch (err) {
      console.error('Update image error:', err);
      setError(err.message || 'Failed to update image details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Image Information"
      subtitle="Update title and description for this saved image."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 font-semibold text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
            Image Title
          </label>
          <input
            type="text"
            placeholder="Image title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSaving}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E5E1] bg-white text-xs text-[#1C1C1A] focus:outline-hidden focus:border-[#2F5D50] focus:ring-1 focus:ring-[#2F5D50] transition-colors"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#1C1C1A] uppercase tracking-wider mb-1">
            Description / Notes
          </label>
          <textarea
            rows="3"
            placeholder="Image description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSaving}
            className="w-full px-3.5 py-2 rounded-xl border border-[#E5E5E1] bg-white text-xs text-[#1C1C1A] focus:outline-hidden focus:border-[#2F5D50] focus:ring-1 focus:ring-[#2F5D50] transition-colors resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E5E1]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border-[#E5E5E1] bg-[#F7F7F5] text-[#1C1C1A] hover:bg-[#E5E5E1]"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className="gap-1.5 rounded-xl bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold shadow-xs cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
