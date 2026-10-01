import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose}></div>
      <div className={`relative w-full ${maxWidth} max-h-[92vh] overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-xl z-10 flex flex-col`}>
        <div className="px-4 sm:px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F7F8F7] shrink-0">
          <div className="pr-2 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-[#111111] font-sans truncate">{title}</h3>
            {subtitle && <p className="text-xs text-[#667085] mt-0.5 line-clamp-2">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#E5E7EB] text-[#98A2B3] hover:text-[#111111] transition-colors shrink-0 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 max-h-[calc(92vh-70px)]">{children}</div>
      </div>
    </div>
  );
}
