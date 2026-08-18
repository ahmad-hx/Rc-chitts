import React from 'react';

export default function StatCard({ title, value, icon: Icon, description, badgeText, badgeColor = 'info', className = '' }) {
  const badgeStyles = {
    success: 'bg-green-50 text-brand-success border border-green-200',
    warning: 'bg-amber-50 text-brand-warning border border-amber-200',
    danger: 'bg-red-50 text-brand-danger border border-red-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
  };

  return (
    <div className={`bg-white border border-brand-border rounded-xl p-6 shadow-xs flex items-center justify-between ${className}`}>
      <div>
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
          {title}
        </span>
        <h3 className="text-3xl font-bold text-brand-navy-deep tracking-tight font-sans">
          {value}
        </h3>
        {description && (
          <p className="text-xs text-brand-text-secondary mt-1">
            {description}
          </p>
        )}
        {badgeText && (
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 ${badgeStyles[badgeColor]}`}>
            {badgeText}
          </span>
        )}
      </div>
      {Icon && (
        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-brand-navy-deep flex items-center justify-center">
          <Icon className="w-6 h-6 stroke-[1.5]" />
        </div>
      )}
    </div>
  );
}
