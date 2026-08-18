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
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants = {
    primary: 'bg-brand-navy-deep hover:bg-brand-navy-dark text-white focus:ring-brand-navy-deep',
    secondary: 'border border-brand-border bg-white text-brand-text-secondary hover:text-brand-text-main hover:bg-brand-bg focus:ring-brand-border',
    danger: 'bg-brand-danger hover:opacity-90 text-white focus:ring-brand-danger',
    gold: 'bg-brand-gold-primary hover:bg-brand-gold-light text-brand-navy-dark font-semibold focus:ring-brand-gold-primary',
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
