import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const variants = {
    success: {
      bg: 'bg-emerald-900/90 border-emerald-700 text-emerald-100',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
    },
    error: {
      bg: 'bg-red-900/90 border-red-700 text-red-100',
      icon: AlertCircle,
      iconColor: 'text-red-400',
    },
    info: {
      bg: 'bg-sky-900/90 border-sky-700 text-sky-100',
      icon: Info,
      iconColor: 'text-sky-400',
    },
  };

  const style = variants[type] || variants.info;
  const Icon = style.icon;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300">
      <div className={`flex items-center gap-3 ${style.bg} rounded-xl px-4 py-3 border`}>
        <Icon className={`h-5 w-5 ${style.iconColor} shrink-0`} />
        <span className="text-sm font-semibold">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
