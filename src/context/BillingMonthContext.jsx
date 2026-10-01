import React, { createContext, useContext, useState, useEffect } from 'react';
import { FORMATTED_MONTH_NAMES, getStandardMonthOptions } from '../utils/chitMonthUtils.js';

const BillingMonthContext = createContext();

/**
 * Returns the current calendar month and year formatted as "Month YYYY"
 * e.g., "September 2026", "October 2026", "January 2027"
 */
export function getCurrentCalendarMonthStr(date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const monthName = FORMATTED_MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${monthName} ${year}`;
}

export function BillingMonthProvider({ children }) {
  // Real system/browser calendar month (e.g. "September 2026")
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => getCurrentCalendarMonthStr());

  // Track if admin manually selected a specific month in the current session
  const [isManuallySelected, setIsManuallySelected] = useState(() => {
    return localStorage.getItem('raghavendra_is_manual_billing_month') === 'true';
  });

  // Selected Month state
  const [selectedMonth, setSelectedMonthState] = useState(() => {
    const nowMonth = getCurrentCalendarMonthStr();
    const savedManual = localStorage.getItem('raghavendra_selected_billing_month');
    const isManual = localStorage.getItem('raghavendra_is_manual_billing_month') === 'true';

    if (isManual && savedManual) {
      return savedManual;
    }
    return nowMonth;
  });

  // Dynamic Available Months List
  const [availableMonths, setAvailableMonths] = useState(() => {
    const standard = getStandardMonthOptions();
    const nowMonth = getCurrentCalendarMonthStr();
    const saved = localStorage.getItem('raghavendra_available_billing_months');
    let list = standard;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = Array.from(new Set([...standard, ...parsed]));
        }
      } catch (_) {}
    }

    if (!list.includes(nowMonth)) {
      list.unshift(nowMonth);
    }
    return list;
  });

  // Keep current calendar month updated automatically (e.g. across midnight / month changes)
  useEffect(() => {
    const updateCalendarMonth = () => {
      const latestCalMonth = getCurrentCalendarMonthStr();

      setCurrentCalendarMonth((prevCal) => {
        if (prevCal !== latestCalMonth) {
          // Calendar month changed!
          if (!isManuallySelected) {
            setSelectedMonthState(latestCalMonth);
            localStorage.setItem('raghavendra_selected_billing_month', latestCalMonth);
          }
          return latestCalMonth;
        }
        return prevCal;
      });
    };

    // Check on mount
    updateCalendarMonth();

    // Check periodically (every 30 seconds) for date/month change across midnight
    const timerId = setInterval(updateCalendarMonth, 30000);

    return () => clearInterval(timerId);
  }, [isManuallySelected]);

  // Ensure current calendar month is always present in availableMonths
  useEffect(() => {
    if (!availableMonths.includes(currentCalendarMonth)) {
      setAvailableMonths((prev) => [currentCalendarMonth, ...prev.filter((m) => m !== currentCalendarMonth)]);
    }
  }, [currentCalendarMonth, availableMonths]);

  // Set selected month handler (Manual Selection)
  const setSelectedMonth = (month) => {
    if (!month) return;
    const clean = month.trim();
    const realNow = getCurrentCalendarMonthStr();

    setSelectedMonthState(clean);
    localStorage.setItem('raghavendra_selected_billing_month', clean);

    if (clean === realNow) {
      setIsManuallySelected(false);
      localStorage.setItem('raghavendra_is_manual_billing_month', 'false');
    } else {
      setIsManuallySelected(true);
      localStorage.setItem('raghavendra_is_manual_billing_month', 'true');
    }
  };

  // Reset to Current Real Calendar Month
  const resetToCurrentMonth = () => {
    const realNow = getCurrentCalendarMonthStr();
    setSelectedMonthState(realNow);
    setIsManuallySelected(false);
    localStorage.setItem('raghavendra_selected_billing_month', realNow);
    localStorage.setItem('raghavendra_is_manual_billing_month', 'false');
  };

  // Add Custom New Month
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
        currentCalendarMonth,
        isManuallySelected,
        resetToCurrentMonth,
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

