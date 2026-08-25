/**
 * Raghavendra Chitts — Automatic Chit Month Tracking Utility
 *
 * Core Concept:
 *   Every chit group has a starting month (Chit Month 1).
 *   The chit month increments every calendar month up to a maximum of 20/20.
 *   Formula: Chit Month = min(max(monthDifference + 1, 1), 20)
 *
 * Reusable across:
 *   - Dashboard
 *   - Chit Groups
 *   - Members directory & modals
 *   - Payments & Record Payment
 *   - Pending Payments
 *   - WhatsApp message compilation & preview
 */

export const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export const FORMATTED_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Generate standard list of selectable month-year options (e.g. for dropdowns)
 * Covers current year, previous year, and next 2 years.
 */
export function getStandardMonthOptions() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const options = [];

  years.forEach((yr) => {
    FORMATTED_MONTH_NAMES.forEach((m) => {
      options.push(`${m} ${yr}`);
    });
  });

  return options;
}

/**
 * Safely parses a month string like "March 2026", "2026-03", "Aug 2026", "08/2026"
 * Returns { year: 2026, month: 2 } (0-indexed month) or null
 */
export function parseMonthYear(input) {
  if (!input) return null;
  if (typeof input === 'object' && input instanceof Date && !isNaN(input.getTime())) {
    return { year: input.getFullYear(), month: input.getMonth() };
  }

  const str = String(input).trim();
  if (!str) return null;

  // Format: "YYYY-MM" or "YYYY-MM-DD"
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1; // 0-indexed
    if (!isNaN(year) && month >= 0 && month <= 11) {
      return { year, month };
    }
  }

  // Format: "Month YYYY" e.g. "March 2026", "Aug 2026", "August, 2026"
  const monthYearMatch = str.match(/([a-zA-Z]+)[,\s]+(\d{4})/);
  if (monthYearMatch) {
    const monthStr = monthYearMatch[1].toLowerCase();
    const year = parseInt(monthYearMatch[2], 10);
    const monthIdx = MONTH_NAMES.findIndex(
      (m) => m.startsWith(monthStr) || monthStr.startsWith(m.slice(0, 3))
    );
    if (monthIdx !== -1 && !isNaN(year)) {
      return { year, month: monthIdx };
    }
  }

  // Format: "MM/YYYY" e.g. "03/2026"
  const slashMatch = str.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const year = parseInt(slashMatch[2], 10);
    if (!isNaN(year) && month >= 0 && month <= 11) {
      return { year, month };
    }
  }

  return null;
}

/**
 * Calculates Chit Month number (from 1 up to 20 max).
 * Formula: Chit Month = min(max(monthDifference + 1, 1), 20)
 *
 * @param {string|object} groupStartMonth - e.g. "March 2026"
 * @param {string|object} activeBillingMonth - e.g. "May 2026"
 * @returns {{ currentMonth: number, totalMonths: number, display: string, formatted: string, isDefault: boolean }}
 */
export function getChitMonth(groupStartMonth, activeBillingMonth) {
  const TOTAL_MONTHS = 20;

  if (!groupStartMonth || !activeBillingMonth) {
    return {
      currentMonth: 1,
      totalMonths: TOTAL_MONTHS,
      display: `1 / ${TOTAL_MONTHS}`,
      formatted: `Chit Month: 1`,
      isDefault: true,
    };
  }

  const start = parseMonthYear(groupStartMonth);
  const active = parseMonthYear(activeBillingMonth);

  if (!start || !active) {
    return {
      currentMonth: 1,
      totalMonths: TOTAL_MONTHS,
      display: `1 / ${TOTAL_MONTHS}`,
      formatted: `Chit Month: 1`,
      isDefault: true,
    };
  }

  // Calculate calendar month difference
  const monthDifference = (active.year - start.year) * 12 + (active.month - start.month);

  // Starting month is Month 1. Max capped at 20.
  const currentMonth = Math.min(Math.max(monthDifference + 1, 1), TOTAL_MONTHS);

  return {
    currentMonth,
    totalMonths: TOTAL_MONTHS,
    display: `${currentMonth} / ${TOTAL_MONTHS}`,
    formatted: `Chit Month: ${currentMonth}`,
    isDefault: false,
  };
}

/**
 * Helper to get Chit Month for a specific chit group or subscription object
 * Checks group's startingMonth, or looks up in allGroupsList if provided.
 */
export function getChitMonthForGroup(groupOrChit, activeBillingMonth, allGroupsList = []) {
  if (!groupOrChit) {
    return getChitMonth(null, activeBillingMonth);
  }

  // Direct startingMonth or startMonth property
  let startMonth =
    groupOrChit.startingMonth ||
    groupOrChit.startMonth ||
    groupOrChit.firstMonth ||
    null;

  // If not on the object directly, look up the group in allGroupsList
  if (!startMonth && Array.isArray(allGroupsList) && allGroupsList.length > 0) {
    const gId = String(groupOrChit.groupId || groupOrChit.group || '').toLowerCase();
    const gVal = Number(groupOrChit.totalChitValue || groupOrChit.chitValue || 0);

    const matched =
      allGroupsList.find((g) => {
        const matchId = String(g.groupId || g.id || '').toLowerCase() === gId;
        const matchVal = gVal > 0 ? Number(g.totalChitValue || 0) === gVal : true;
        return matchId && matchVal;
      }) ||
      allGroupsList.find(
        (g) => String(g.groupId || g.id || '').toLowerCase() === gId
      );

    if (matched) {
      startMonth = matched.startingMonth || matched.startMonth;
    }
  }

  // Safe default fallback if not yet configured
  return getChitMonth(startMonth || 'March 2026', activeBillingMonth);
}
