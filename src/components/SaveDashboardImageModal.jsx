import React, { useState, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import {
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Loader2,
} from 'lucide-react';
import { dashboardImageService } from '../services/dashboardImageService';

export default function SaveDashboardImageModal({ isOpen, onClose, onImageSaved }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);

  const resetForm = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTitle('');
    setDescription('');
    setError('');
    setIsUploading(false);
    setUploadStatus('');
    setUploadPercent(0);
    setIsDragOver(false);
  };

  const handleClose = () => {
    if (isUploading) return;
    resetForm();
    onClose?.();
  };

  const handleFileSelection = (file) => {
    setError('');
    if (!file) return;

    const validation = dashboardImageService.validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Default title from filename if title is empty
    if (!title.trim()) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanTitle);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelection(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelection(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) return;
    if (!selectedFile) {
      setError('Please select an image file to upload.');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadStatus('Optimizing image...');
    setUploadPercent(0);

    try {
      const savedDoc = await dashboardImageService.uploadDashboardImage({
        file: selectedFile,
        title,
        description,
        onProgress: (prog) => {
          setUploadStatus(prog.message);
          if (typeof prog.percent === 'number') {
            setUploadPercent(prog.percent);
          }
        },
      });

      onImageSaved?.(savedDoc);
      handleClose();
    } catch (err) {
      console.error('Upload dashboard image error:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Save Dashboard Image"
      subtitle="Upload image to Firebase Storage and save persistent record in Firestore."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 font-semibold text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* IMAGE UPLOAD / DROPZONE */}
        <div>
          <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1.5">
            Select Image <span className="text-[#B42318]">*</span>
          </label>

          {!previewUrl ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-[#285F52] bg-[#EEF6F3]'
                  : 'border-[#E5E7EB] bg-[#F7F8F7] hover:border-[#BFD8D0] hover:bg-[#EEF6F3]/50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5E7EB] flex items-center justify-center text-[#285F52] mb-3 shadow-xs">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-[#111111]">Click to browse or drag and drop image here</p>
              <p className="text-[10px] font-medium text-[#667085] mt-1">Supported formats: JPG, JPEG, PNG, WEBP (Max 15 MB)</p>
            </div>
          ) : (
            <div className="relative rounded-2xl border border-[#E5E7EB] bg-[#F7F8F7] overflow-hidden p-2.5 space-y-2.5">
              <div className="relative max-h-56 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Selected Preview"
                  className="max-h-56 w-full object-contain rounded-xl"
                />
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
                    title="Remove selected image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#667085] px-1">
                  <span className="truncate max-w-[200px] text-[#111111] font-bold">{selectedFile.name}</span>
                  <span className="font-mono text-[#285F52] font-bold">{formatFileSize(selectedFile.size)}</span>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={isUploading}
          />
        </div>

        {/* IMAGE TITLE */}
        <div>
          <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
            Image Title <span className="text-[#667085] font-normal lowercase">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Auction Banner August 2026, Office Meeting, Member Notice"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isUploading}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#111111] focus:outline-hidden focus:border-[#285F52] focus:ring-1 focus:ring-[#285F52] transition-colors"
          />
        </div>

        {/* IMAGE DESCRIPTION */}
        <div>
          <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
            Description / Notes <span className="text-[#667085] font-normal lowercase">(optional)</span>
          </label>
          <textarea
            rows="2"
            placeholder="Add optional notes, chit reference, or context about this image..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isUploading}
            className="w-full px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#111111] focus:outline-hidden focus:border-[#285F52] focus:ring-1 focus:ring-[#285F52] transition-colors resize-none"
          />
        </div>

        {/* UPLOAD STATUS BANNER WITH PROGRESS BAR */}
        {isUploading && (
          <div className="p-3 bg-[#EEF6F3] border border-[#BFD8D0] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[#285F52] font-bold text-xs">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#285F52]" />
                <span>{uploadStatus || 'Saving image...'}</span>
              </span>
              <span className="font-mono text-xs font-black">{uploadPercent}%</span>
            </div>
            <div className="w-full bg-[#BFD8D0]/40 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#285F52] h-full rounded-full transition-all duration-150"
                style={{ width: `${Math.min(100, Math.max(0, uploadPercent))}%` }}
              />
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isUploading}
            className="rounded-xl border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] hover:bg-[#E5E7EB]"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!selectedFile || isUploading}
            className="gap-1.5 rounded-xl bg-[#285F52] hover:bg-[#214D43] text-white font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Image</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
