import React from 'react';
import logoImg from '../assets/logo.jpg';

export default function Logo({ 
  size = 'md', 
  showText = true, 
  className = '',
  href = '/'
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const containerClasses = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3',
    xl: 'gap-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-2xl',
  };

  return (
    <a 
      href={href}
      className={`flex items-center ${containerClasses[size]} no-underline ${className}`}
    >
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-white shadow-sm`}>
        <img 
          src={logoImg} 
          alt="Raghavendra Chitts Logo" 
          className="w-full h-full object-cover"
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`${textSizeClasses[size]} font-bold text-white leading-tight`}>
            Raghavendra
          </span>
          <span className={`${textSizeClasses[size]} font-semibold text-slate-200 leading-tight`}>
            Chitts
          </span>
        </div>
      )}
    </a>
  );
}
