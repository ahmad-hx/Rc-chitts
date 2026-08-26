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
    success: 'bg-[#EDF7F0] text-[#2F6B4F] border-[#D7EBDD]',
    warning: 'bg-[#FFF7E6] text-[#8A5A12] border-[#F3E1B7]',
    danger: 'bg-[#FCEEEE] text-[#A33A3A] border-[#F2D4D4]',
    info: 'bg-[#F2F2EF] text-[#1C1C1A] border-[#E5E5E1]',
    purple: 'bg-[#F5F0FF] text-[#6B3FA0] border-[#E9DBFF]',
  };

  return (
    <div
      className={`bg-white border border-[#E5E5E1] rounded-2xl p-5 shadow-xs flex items-start justify-between gap-3 transition-all duration-200 hover:border-[#D8D8D3] ${className}`}
    >
      <div className="space-y-1 min-w-0 flex-1">
        <span className="text-[10px] font-extrabold text-[#6B6B67] uppercase tracking-[0.16em] block">
          {title}
        </span>
        <h3 className="text-2xl sm:text-3xl font-black text-[#1C1C1A] tracking-tight font-sans truncate">
          {value}
        </h3>
        {description && (
          <p className="text-[11px] font-medium text-[#6B6B67] truncate">
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
        <div className="h-10 w-10 rounded-xl bg-[#F7F7F5] border border-[#E5E5E1] text-[#2F5D50] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 stroke-[2]" />
        </div>
      )}
    </div>
  );
}


