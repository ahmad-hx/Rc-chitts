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
 * Covers previous year, current year, and next 3 years.
 */
export function getStandardMonthOptions() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const options = [];

  years.forEach((yr) => {
    FORMATTED_MONTH_NAMES.forEach((m) => {
      options.push(`${m} ${yr}`);
    });
  });

  return options;
}

/**
 * Safely parses a month string or timestamp into { year, month } (0-indexed month)
 * Handles:
 * - "March 2026", "Aug 2026", "August, 2026"
 * - "2026-03", "2026-3", "2026/03"
 * - "03/2026", "3/2026"
 * - Date objects
 * - Firestore Timestamp objects (.toDate() or .seconds)
 * Returns { year, month } or null
 */
export function parseMonthYear(input) {
  if (!input) return null;

  // JS Date instance
  if (typeof input === 'object' && input instanceof Date && !isNaN(input.getTime())) {
    return { year: input.getFullYear(), month: input.getMonth() };
  }

  // Firestore Timestamp instance
  if (typeof input === 'object') {
    if (typeof input.toDate === 'function') {
      try {
        const d = input.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) {
          return { year: d.getFullYear(), month: d.getMonth() };
        }
      } catch (_) {}
    }
    if (typeof input.seconds === 'number') {
      const d = new Date(input.seconds * 1000);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth() };
      }
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // Format: "YYYY-MM" or "YYYY-MM-DD" or "YYYY/MM"
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

  // Format: "YYYY" alone
  const yearOnlyMatch = str.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1], 10);
    if (!isNaN(year)) {
      return { year, month: 0 };
    }
  }

  return null;
}

/**
 * Format any parsed month/year into a clean standard string like "March 2026"
 */
export function formatMonthYearDisplay(input) {
  if (!input) return 'March 2026';
  const parsed = parseMonthYear(input);
  if (!parsed) return String(input);
  return `${FORMATTED_MONTH_NAMES[parsed.month]} ${parsed.year}`;
}

/**
 * Calculates Chit Month number (from 1 up to 20 max).
 * Formula: Chit Month = min(max(monthDifference + 1, 1), 20)
 *
 * @param {string|object} groupStartMonth - e.g. "March 2026" or "2026-03"
 * @param {string|object} activeBillingMonth - e.g. "August 2026" or "2026-08"
 * @returns {{ currentMonth: number, totalMonths: number, display: string, formatted: string, isDefault: boolean }}
 */
export function getChitMonth(groupStartMonth, activeBillingMonth) {
  const TOTAL_MONTHS = 20;

  const defaultResult = {
    currentMonth: 1,
    totalMonths: TOTAL_MONTHS,
    display: `1 / ${TOTAL_MONTHS}`,
    formatted: `Chit Month: 1 / ${TOTAL_MONTHS}`,
    isDefault: true,
  };

  if (!groupStartMonth || !activeBillingMonth) {
    return defaultResult;
  }

  const start = parseMonthYear(groupStartMonth);
  const active = parseMonthYear(activeBillingMonth);

  if (!start || !active) {
    return defaultResult;
  }

  // Calculate calendar month difference: (yearDiff * 12) + monthDiff
  const monthDifference = (active.year - start.year) * 12 + (active.month - start.month);

  const rawMonthNumber = monthDifference + 1;
  // Month Difference + 1, bounded strictly between 1 and 20
  const currentMonth = Math.min(Math.max(rawMonthNumber, 1), TOTAL_MONTHS);
  const isCompleted = rawMonthNumber > TOTAL_MONTHS;

  return {
    currentMonth,
    rawMonthNumber,
    monthDifference,
    isCompleted,
    totalMonths: TOTAL_MONTHS,
    display: `${currentMonth} / ${TOTAL_MONTHS}`,
    formatted: `Chit Month: ${currentMonth} / ${TOTAL_MONTHS}`,
    isDefault: false,
  };
}

function safePositiveInt(val) {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : parseInt(String(val).trim(), 10);
  return !isNaN(num) && isFinite(num) && num > 0 ? Math.floor(num) : null;
}

/**
 * Helper to get Chit Month for a specific chit group or subscription object
 * Checks group's startingMonth, or looks up in allGroupsList if provided.
 */
export function getChitMonthForGroup(groupOrChit, activeBillingMonth, allGroupsList = []) {
  if (!groupOrChit) {
    return getChitMonth(null, activeBillingMonth);
  }

  const totalMonths = safePositiveInt(
    groupOrChit.totalMonths ??
    groupOrChit.capacity ??
    groupOrChit.duration
  ) || 20;

  // 1. Direct currentChitMonth property on groupOrChit
  const directMonth = safePositiveInt(
    groupOrChit.currentChitMonth ??
    groupOrChit.currentMonth ??
    groupOrChit.chitMonth ??
    groupOrChit.month
  );

  if (directMonth) {
    const clamped = Math.min(Math.max(directMonth, 1), totalMonths);
    return {
      currentMonth: clamped,
      totalMonths,
      display: `${clamped}/${totalMonths}`,
      formatted: `Chit Month: ${clamped}/${totalMonths}`,
      isDefault: false,
    };
  }

  // 2. Lookup parent group in allGroupsList by UNIQUE MATCH (id OR (groupId AND totalChitValue))
  let matchedGroup = null;
  if (Array.isArray(allGroupsList) && allGroupsList.length > 0) {
    const targetId = String(groupOrChit.id || groupOrChit.docId || '').trim();
    const gId = String(groupOrChit.groupId || groupOrChit.group || groupOrChit.chitGroup || '').trim().toUpperCase();
    const gVal = Number(groupOrChit.totalChitValue || groupOrChit.chitValue || groupOrChit.totalValue || groupOrChit.calculatedTotalChitValue || 0);

    matchedGroup =
      (targetId ? allGroupsList.find((g) => g.id === targetId) : null) ||
      allGroupsList.find((g) => {
        const matchGId = String(g.groupId || g.id || '').trim().toUpperCase() === gId;
        const matchVal = gVal > 0 ? Number(g.totalChitValue || g.chitValue || 0) === gVal : true;
        return matchGId && matchVal;
      }) ||
      allGroupsList.find((g) => String(g.groupId || g.id || '').trim().toUpperCase() === gId);
  }

  if (matchedGroup) {
    const groupMonth = safePositiveInt(
      matchedGroup.currentChitMonth ??
      matchedGroup.currentMonth ??
      matchedGroup.chitMonth
    );
    const groupTotal = safePositiveInt(
      matchedGroup.totalMonths ??
      matchedGroup.capacity ??
      matchedGroup.duration
    ) || totalMonths;

    if (groupMonth) {
      const clamped = Math.min(Math.max(groupMonth, 1), groupTotal);
      return {
        currentMonth: clamped,
        totalMonths: groupTotal,
        display: `${clamped}/${groupTotal}`,
        formatted: `Chit Month: ${clamped}/${groupTotal}`,
        isDefault: false,
      };
    }
  }

  // 3. Fallback: derive from startingMonth if currentChitMonth is not explicitly set
  const startMonth =
    groupOrChit.startingMonth ||
    groupOrChit.startMonth ||
    groupOrChit.firstMonth ||
    matchedGroup?.startingMonth ||
    matchedGroup?.startMonth ||
    'March 2026';

  return getChitMonth(startMonth, activeBillingMonth);
}

/**
 * Converts a Month Name and Year (e.g. "March", 2026) to standard "YYYY-MM" string (e.g. "2026-03")
 */
export function toYearMonthString(monthNameOrIdx, year) {
  let monthIdx = 0;
  if (typeof monthNameOrIdx === 'number') {
    monthIdx = Math.max(0, Math.min(11, monthNameOrIdx));
  } else if (typeof monthNameOrIdx === 'string') {
    const clean = monthNameOrIdx.trim();
    const idx = FORMATTED_MONTH_NAMES.findIndex(
      (m) => m.toLowerCase() === clean.toLowerCase()
    );
    if (idx !== -1) {
      monthIdx = idx;
    } else {
      const parsed = parseMonthYear(clean);
      if (parsed) monthIdx = parsed.month;
    }
  }
  const cleanYear = parseInt(year, 10) || new Date().getFullYear();
  return `${cleanYear}-${String(monthIdx + 1).padStart(2, '0')}`;
}

