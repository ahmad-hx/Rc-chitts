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
          <div className="p-3 bg-[#FEF3F2] border border-[#FECACA] rounded-xl flex items-center gap-2 text-[#B42318] font-semibold text-xs">
            <AlertCircle className="w-4 h-4 text-[#B42318] shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
            Image Title
          </label>
          <input
            type="text"
            placeholder="Image title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSaving}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#111111] focus:outline-hidden focus:border-[#285F52] focus:ring-1 focus:ring-[#285F52] transition-colors"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
            Description / Notes
          </label>
          <textarea
            rows="3"
            placeholder="Image description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSaving}
            className="w-full px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#111111] focus:outline-hidden focus:border-[#285F52] focus:ring-1 focus:ring-[#285F52] transition-colors resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] hover:bg-[#E5E7EB]"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className="gap-1.5 rounded-xl bg-[#285F52] hover:bg-[#214D43] text-white font-bold shadow-xs cursor-pointer"
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
