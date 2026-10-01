import React from 'react';
import Modal from './Modal';
import Button from './Button';
import {
  ExternalLink,
  Download,
  Calendar,
  HardDrive,
  FileImage,
  Tag,
} from 'lucide-react';

export default function ViewDashboardImageModal({ isOpen, onClose, imageDoc }) {
  if (!imageDoc) return null;

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Unknown Size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return String(isoString);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={imageDoc.title || imageDoc.fileName || 'Dashboard Image'}
      subtitle={`Uploaded on ${formatDate(imageDoc.createdAt)}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 font-sans text-xs">
        {/* FULL IMAGE CONTAINER */}
        <div className="relative rounded-2xl overflow-hidden bg-[#F7F8F7] border border-[#E5E7EB] flex items-center justify-center min-h-[260px] max-h-[500px] shadow-xs">
          <img
            src={imageDoc.imageUrl}
            alt={imageDoc.title || imageDoc.fileName}
            className="w-full h-auto max-h-[500px] object-contain rounded-2xl"
            loading="lazy"
          />
        </div>

        {/* METADATA BADGES & DETAILS */}
        <div className="p-3.5 bg-[#F7F8F7] rounded-2xl border border-[#E5E7EB] space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white border border-[#E5E7EB] text-[#111111]">
              <FileImage className="w-3.5 h-3.5 text-[#285F52]" />
              <span>{imageDoc.fileType ? imageDoc.fileType.toUpperCase().replace('IMAGE/', '') : 'IMAGE'}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white border border-[#E5E7EB] text-[#111111]">
              <HardDrive className="w-3.5 h-3.5 text-[#285F52]" />
              <span>{formatFileSize(imageDoc.fileSize)}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white border border-[#E5E7EB] text-[#667085]">
              <Calendar className="w-3.5 h-3.5 text-[#285F52]" />
              <span>{formatDate(imageDoc.createdAt)}</span>
            </span>
          </div>

          {imageDoc.description && (
            <div className="pt-2 border-t border-[#E5E7EB]">
              <p className="text-[11px] font-bold text-[#667085] uppercase tracking-wider mb-0.5">Description</p>
              <p className="text-xs text-[#111111] leading-relaxed whitespace-pre-wrap">{imageDoc.description}</p>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
          <a
            href={imageDoc.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#285F52] hover:bg-[#EEF6F3] border border-[#BFD8D0] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in New Tab</span>
          </a>

          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="rounded-xl border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] hover:bg-[#E5E7EB]"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
