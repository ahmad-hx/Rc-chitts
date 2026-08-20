import React from 'react';

export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white border border-[#E5E5E1] rounded-2xl p-6 text-[#1C1C1A] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

