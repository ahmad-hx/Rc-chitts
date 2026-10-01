import React from 'react';

export default function StatCard({
  title,
  value,
  icon: Icon,
  description,
  badgeText,
  badgeColor = 'info',
  className = '',
}) {
  const badgeStyles = {
    success: 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]',
    warning: 'bg-[#FFF8E7] text-[#B7791F] border-[#FDE68A]',
    danger: 'bg-[#FEF3F2] text-[#B42318] border-[#FECACA]',
    info: 'bg-[#F7F8F7] text-[#111111] border-[#E5E7EB]',
    purple: 'bg-[#EEF6F3] text-[#285F52] border-[#BFD8D0]',
  };

  return (
    <div
      className={`bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs flex items-start justify-between gap-3 transition-all duration-200 hover:border-[#98A2B3] ${className}`}
    >
      <div className="space-y-1 min-w-0 flex-1">
        <span className="text-[10px] font-extrabold text-[#667085] uppercase tracking-[0.16em] block">
          {title}
        </span>
        <h3 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight font-sans truncate">
          {value}
        </h3>
        {description && (
          <p className="text-[11px] font-medium text-[#667085] truncate">
            {description}
          </p>
        )}
        {badgeText && (
          <span
            className={`inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border mt-1 ${
              badgeStyles[badgeColor] || badgeStyles.info
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {Icon && (
        <div className="h-10 w-10 rounded-xl bg-[#F7F8F7] border border-[#E5E7EB] text-[#285F52] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 stroke-[2]" />
        </div>
      )}
    </div>
  );
}



