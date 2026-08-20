import React from 'react';

export default function StatCard({ title, value, icon: Icon, description, badgeText, badgeColor = 'info', className = '' }) {
  const badgeStyles = {
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/30',
    info: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
  };

  return (
    <div className={`bg-[#111625]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl flex items-center justify-between transition-all duration-200 hover:border-slate-700 ${className}`}>
      <div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          {title}
        </span>
        <h3 className="text-3xl font-black text-white tracking-tight font-sans">
          {value}
        </h3>
        {description && (
          <p className="text-xs font-semibold text-slate-400 mt-1.5">
            {description}
          </p>
        )}
        {badgeText && (
          <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-2.5 ${badgeStyles[badgeColor] || badgeStyles.info}`}>
            {badgeText}
          </span>
        )}
      </div>
      {Icon && (
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl text-sky-400 flex items-center justify-center shrink-0 shadow-inner">
          <Icon className="w-6 h-6 stroke-[1.75]" />
        </div>
      )}
    </div>
  );
}

