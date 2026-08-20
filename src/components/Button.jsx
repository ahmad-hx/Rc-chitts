import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer h-10 px-4 text-xs tracking-tight';

  const variants = {
    primary: 'bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold focus:ring-[#2F5D50]',
    secondary: 'border border-[#E5E5E1] bg-white text-[#1C1C1A] hover:bg-[#F7F7F5] font-bold focus:ring-[#E5E5E1]',
    outline: 'border border-[#E5E5E1] bg-white text-[#1C1C1A] hover:bg-[#F7F7F5] font-bold focus:ring-[#E5E5E1]',
    ghost: 'bg-transparent text-[#6B6B67] hover:bg-[#F2F2EF] hover:text-[#1C1C1A] font-bold',
    success: 'bg-[#2F6B4F] hover:bg-[#24553E] text-white font-bold focus:ring-[#2F6B4F]',
    danger: 'bg-[#A33A3A] hover:bg-[#852E2E] text-white font-bold focus:ring-[#A33A3A]',
    gold: 'bg-[#8A5A12] hover:bg-[#6D460E] text-white font-bold focus:ring-[#8A5A12]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
