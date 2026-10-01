import React from 'react';

export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white border border-[#E5E7EB] rounded-2xl p-6 text-[#111111] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

