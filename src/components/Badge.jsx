import React from 'react';

export default function Badge({ children, variant = 'info', className = '' }) {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';

  const variants = {
    success: 'bg-green-50 text-brand-success border-green-200',
    warning: 'bg-amber-50 text-brand-warning border-amber-200',
    danger: 'bg-red-50 text-brand-danger border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
