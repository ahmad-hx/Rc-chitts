import React from 'react';

export default function Badge({ children, variant = 'info', className = '', dot = false }) {
  const baseStyles = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border';

  const variants = {
    success: 'bg-[#EDF7F0] text-[#2F6B4F] border-[#D7EBDD]',
    paid: 'bg-[#EDF7F0] text-[#2F6B4F] border-[#D7EBDD]',
    warning: 'bg-[#FFF7E6] text-[#8A5A12] border-[#F3E1B7]',
    pending: 'bg-[#FFF7E6] text-[#8A5A12] border-[#F3E1B7]',
    partial: 'bg-[#FFF7E6] text-[#B86B14] border-[#FCD34D]',
    danger: 'bg-[#FCEEEE] text-[#A33A3A] border-[#F2D4D4]',
    error: 'bg-[#FCEEEE] text-[#A33A3A] border-[#F2D4D4]',
    overdue: 'bg-[#FCEEEE] text-[#A33A3A] border-[#F2D4D4]',
    purple: 'bg-[#F5F0FF] text-[#6B3FA0] border-[#E9DBFF]',
    multiple: 'bg-[#F5F0FF] text-[#6B3FA0] border-[#E9DBFF]',
    single: 'bg-[#F2F2EF] text-[#1C1C1A] border-[#E5E5E1]',
    info: 'bg-[#F2F2EF] text-[#1C1C1A] border-[#E5E5E1]',
    neutral: 'bg-[#F2F2EF] text-[#6B6B67] border-[#E5E5E1]',
    active: 'bg-[#EDF7F0] text-[#2F6B4F] border-[#D7EBDD]',
  };

  const dotColors = {
    success: 'bg-[#2F6B4F]',
    paid: 'bg-[#2F6B4F]',
    warning: 'bg-[#8A5A12]',
    pending: 'bg-[#8A5A12]',
    partial: 'bg-[#B86B14]',
    danger: 'bg-[#A33A3A]',
    error: 'bg-[#A33A3A]',
    overdue: 'bg-[#A33A3A]',
    purple: 'bg-[#6B3FA0]',
    multiple: 'bg-[#6B3FA0]',
    single: 'bg-[#6B6B67]',
    info: 'bg-[#6B6B67]',
    neutral: 'bg-[#959590]',
    active: 'bg-[#2F6B4F]',
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

