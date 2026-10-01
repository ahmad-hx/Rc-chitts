import React from 'react';

export default function Badge({ children, variant = 'info', className = '', dot = false }) {
  const baseStyles = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border';

  const variants = {
    success: 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]',
    paid: 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]',
    active: 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]',
    warning: 'bg-[#FFF8E7] text-[#B7791F] border-[#FDE68A]',
    pending: 'bg-[#FFF8E7] text-[#B7791F] border-[#FDE68A]',
    partial: 'bg-[#FFF8E7] text-[#B7791F] border-[#FDE68A]',
    danger: 'bg-[#FEF3F2] text-[#B42318] border-[#FECACA]',
    error: 'bg-[#FEF3F2] text-[#B42318] border-[#FECACA]',
    overdue: 'bg-[#FEF3F2] text-[#B42318] border-[#FECACA]',
    purple: 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]',
    multiple: 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]',
    single: 'bg-[#F7F8F7] text-[#111111] border-[#E5E7EB]',
    info: 'bg-[#F7F8F7] text-[#111111] border-[#E5E7EB]',
    neutral: 'bg-[#F7F8F7] text-[#111111] border-[#E5E7EB]',
  };

  const dotColors = {
    success: 'bg-[#285F52]',
    paid: 'bg-[#285F52]',
    warning: 'bg-[#B7791F]',
    pending: 'bg-[#B7791F]',
    partial: 'bg-[#B7791F]',
    danger: 'bg-[#B42318]',
    error: 'bg-[#B42318]',
    overdue: 'bg-[#B42318]',
    purple: 'bg-[#285F52]',
    multiple: 'bg-[#285F52]',
    single: 'bg-[#667085]',
    info: 'bg-[#667085]',
    neutral: 'bg-[#98A2B3]',
    active: 'bg-[#285F52]',
  };

  const selectedVariant = variants[variant] || variants.info;
  const selectedDotColor = dotColors[variant] || dotColors.info;

  return (
    <span className={`${baseStyles} ${selectedVariant} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${selectedDotColor}`} />}
      {children}
    </span>
  );
}


