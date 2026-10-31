import React from 'react';

/**
 * Calculates a member's aggregate pending and balance amounts across active subscriptions.
 *
 * @param {Object} member - The member object
 * @returns {{ pending: number, balance: number, hasPending: boolean, hasBalance: boolean }}
 */
export function getMemberPaymentStatus(member) {
  if (!member) {
    return { pending: 0, balance: 0, hasPending: false, hasBalance: false };
  }

  const activeChits = Array.isArray(member.chits) && member.chits.length > 0
    ? member.chits.filter((c) => !c.status || c.status === 'ACTIVE')
    : Array.isArray(member.holdings) && member.holdings.length > 0
    ? member.holdings.filter((c) => !c.status || c.status === 'ACTIVE')
    : [];

  let totalPending = 0;
  let totalBalance = 0;

  if (activeChits.length > 0) {
    activeChits.forEach((c) => {
      totalPending += Math.max(Number(c?.pending || 0), 0);
      totalBalance += Math.max(Number(c?.balance || 0), 0);
    });
  } else {
    totalPending = Math.max(Number(member?.pending ?? member?.pendingAmount ?? 0), 0);
    totalBalance = Math.max(Number(member?.balance ?? member?.balanceAmount ?? 0), 0);
  }

  // Handle fractional amounts / floating point decimals accurately
  totalPending = Math.round(totalPending * 100) / 100;
  totalBalance = Math.round(totalBalance * 100) / 100;

  return {
    pending: totalPending,
    balance: totalBalance,
    hasPending: totalPending > 0,
    hasBalance: totalBalance > 0,
  };
}

/**
 * Professional, accessible payment status indicator component.
 * Displays:
 * - 🔴 Red indicator when member has outstanding pending amount > 0
 * - 🟢 Green indicator when member has advance/credit balance > 0
 * - Both indicators if member has both pending and balance
 * - Disappears when amounts are 0 or cleared.
 */
export default function PaymentStatusBadge({
  member = null,
  pending = null,
  balance = null,
  showLabel = true,
  className = '',
  size = 'sm', // 'xs' | 'sm' | 'md'
}) {
  let hasPending = false;
  let hasBalance = false;
  let pendingAmt = 0;
  let balanceAmt = 0;

  if (member) {
    const status = getMemberPaymentStatus(member);
    hasPending = status.hasPending;
    hasBalance = status.hasBalance;
    pendingAmt = status.pending;
    balanceAmt = status.balance;
  } else {
    pendingAmt = Math.max(Number(pending || 0), 0);
    balanceAmt = Math.max(Number(balance || 0), 0);
    pendingAmt = Math.round(pendingAmt * 100) / 100;
    balanceAmt = Math.round(balanceAmt * 100) / 100;
    hasPending = pendingAmt > 0;
    hasBalance = balanceAmt > 0;
  }

  // If neither pending nor balance is positive, render nothing
  if (!hasPending && !hasBalance) {
    return null;
  }

  const dotSize = size === 'xs' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const textSize = size === 'xs' ? 'text-[9px] px-1 py-0.2' : size === 'md' ? 'text-xs px-2 py-1' : 'text-[10px] px-1.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* 🔴 RED INDICATOR — Outstanding Pending */}
      {hasPending && (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs ${textSize}`}
          title={`🔴 Outstanding Pending: ₹${pendingAmt.toLocaleString('en-IN')}`}
          aria-label={`Outstanding Pending: ₹${pendingAmt}`}
        >
          <span className={`${dotSize} rounded-full bg-rose-600 animate-pulse shrink-0`} />
          {showLabel && <span>Pending</span>}
        </span>
      )}

      {/* 🟢 GREEN INDICATOR — Advance Balance */}
      {hasBalance && (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs ${textSize}`}
          title={`🟢 Advance Balance: ₹${balanceAmt.toLocaleString('en-IN')}`}
          aria-label={`Advance Balance: ₹${balanceAmt}`}
        >
          <span className={`${dotSize} rounded-full bg-emerald-600 shrink-0`} />
          {showLabel && <span>Balance</span>}
        </span>
      )}
    </span>
  );
}
