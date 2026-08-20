import React from 'react';

export default function Badge({ children, variant = 'info', className = '' }) {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border';

  const variants = {
    success: 'bg-[#EDF7F0] text-[#2F6B4F] border-[#D7EBDD]',
    warning: 'bg-[#FFF7E6] text-[#8A5A12] border-[#F3E1B7]',
    danger: 'bg-[#FCEEEE] text-[#A33A3A] border-[#F2D4D4]',
    error: 'bg-[#FCEEEE] text-[#A33A3A] border-[#F2D4D4]',
    info: 'bg-[#F2F2EF] text-[#1C1C1A] border-[#E5E5E1]',
    neutral: 'bg-[#F2F2EF] text-[#6B6B67] border-[#E5E5E1]',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
