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
    primary: 'bg-[#285F52] hover:bg-[#214D43] text-white font-bold focus:ring-[#285F52]',
    secondary: 'border border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F7F8F7] font-bold focus:ring-[#285F52]',
    outline: 'border border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F7F8F7] font-bold focus:ring-[#285F52]',
    ghost: 'bg-transparent text-[#667085] hover:bg-[#F7F8F7] hover:text-[#111111] font-bold',
    success: 'bg-[#285F52] hover:bg-[#214D43] text-white font-bold focus:ring-[#285F52]',
    danger: 'border border-[#FECACA] bg-[#FEF3F2] text-[#B42318] hover:bg-[#FEE4E2] font-bold focus:ring-[#B42318]',
    gold: 'bg-[#285F52] hover:bg-[#214D43] text-white font-bold focus:ring-[#285F52]',
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

