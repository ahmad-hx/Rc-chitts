import React, { createContext, useContext, useState, useEffect } from 'react';

const BillingMonthContext = createContext();

export const DEFAULT_MONTHS = [
  'August 2026',
  'September 2026',
  'October 2026',
  'November 2026',
  'December 2026',
  'January 2027',
];

export function BillingMonthProvider({ children }) {
  const [selectedMonth, setSelectedMonthState] = useState(() => {
    return localStorage.getItem('raghavendra_selected_billing_month') || 'August 2026';
  });

  const [availableMonths, setAvailableMonths] = useState(() => {
    const saved = localStorage.getItem('raghavendra_available_billing_months');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    return DEFAULT_MONTHS;
  });

  const setSelectedMonth = (month) => {
    if (!month) return;
    setSelectedMonthState(month);
    localStorage.setItem('raghavendra_selected_billing_month', month);
  };

  const addNewMonth = (newMonthName) => {
    if (!newMonthName || typeof newMonthName !== 'string') return;
    const clean = newMonthName.trim();
    if (!availableMonths.includes(clean)) {
      const updated = [...availableMonths, clean];
      setAvailableMonths(updated);
      localStorage.setItem('raghavendra_available_billing_months', JSON.stringify(updated));
    }
    setSelectedMonth(clean);
  };

  return (
    <BillingMonthContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth,
        availableMonths,
        addNewMonth,
      }}
    >
      {children}
    </BillingMonthContext.Provider>
  );
}

export function useBillingMonth() {
  const context = useContext(BillingMonthContext);
  if (!context) {
    throw new Error('useBillingMonth must be used within a BillingMonthProvider');
  }
  return context;
}
