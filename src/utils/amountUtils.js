/**
 * Raghavendra Chitts — Centralized Global Monthly Payment Resolution Utility
 *
 * Implements the global resolution priority for member monthly subscription amounts:
 * 1. Explicit individual subscription custom amount (intentionally configured by admin)
 * 2. Explicit member custom amount (intentionally configured by admin)
 * 3. Current monthly amount configured for the assigned chit group (groupPaymentSettings[`${val}_${grp}`])
 * 4. Legacy stored amount / mathematical fallback as safe default (Math.floor(val / 20), 5000)
 */

/**
 * Determines whether a subscription or member has an explicitly configured custom monthly amount
 * rather than an inherited default value.
 *
 * @param {Object} member - The member object
 * @param {Object} subscription - The specific chit holding/subscription object
 * @returns {boolean} True if explicitly customized
 */
export function hasExplicitCustomMonthlyAmount(member = null, subscription = null) {
  // Check explicit flags on subscription
  if (subscription) {
    if (
      subscription.hasCustomMonthlyAmount === true ||
      subscription.isCustomMonthly === true ||
      subscription.isCustomAmount === true
    ) {
      return true;
    }
    if (typeof subscription.customMonthlyAmount === 'number' && subscription.customMonthlyAmount > 0) {
      return true;
    }
  }

  // Check explicit flags on root member object
  if (member) {
    if (
      member.hasCustomMonthlyAmount === true ||
      member.isCustomMonthly === true ||
      member.isCustomAmount === true
    ) {
      return true;
    }
    if (typeof member.customMonthlyAmount === 'number' && member.customMonthlyAmount > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve the effective base monthly payable amount for a member's specific chit subscription.
 *
 * @param {Object} member - The member object
 * @param {Object} subscription - The specific chit holding/subscription object
 * @param {Object} groupPaymentSettings - Map or object of group payment settings (`${val}_${grp}`)
 * @param {Object} [chitGroup] - Optional chit group definition
 * @param {Object} [monthlyAdjustment] - Optional monthly adjustment record
 * @returns {number} The resolved base monthly amount (e.g. 4560, 9250, 22500, 47000, 10000, etc.)
 */
export function getEffectiveMonthlyAmount(
  member = null,
  subscription = null,
  groupPaymentSettings = {},
  chitGroup = null,
  monthlyAdjustment = null
) {
  const val = Number(
    subscription?.totalChitValue ??
    subscription?.totalValue ??
    subscription?.chitValue ??
    member?.calculatedTotalChitValue ??
    chitGroup?.totalChitValue ??
    100000
  );
  const grp = String(
    subscription?.groupId ??
    subscription?.group ??
    subscription?.chitGroup ??
    member?.groupId ??
    member?.group ??
    chitGroup?.groupId ??
    'I'
  ).trim().toUpperCase();

  // 1. Explicit individual subscription custom amount (only if explicitly flagged as custom)
  if (subscription) {
    if (
      subscription.hasCustomMonthlyAmount === true ||
      subscription.isCustomMonthly === true ||
      subscription.isCustomAmount === true
    ) {
      const explicitAmt = Number(subscription.customMonthlyAmount ?? subscription.monthlyAmount ?? subscription.amountToPay);
      if (!isNaN(explicitAmt) && explicitAmt > 0) {
        return explicitAmt;
      }
    }
    if (typeof subscription.customMonthlyAmount === 'number' && subscription.customMonthlyAmount > 0) {
      return subscription.customMonthlyAmount;
    }
  }

  // 2. Explicit member custom amount (only if explicitly flagged as custom)
  if (member) {
    if (
      member.hasCustomMonthlyAmount === true ||
      member.isCustomMonthly === true ||
      member.isCustomAmount === true
    ) {
      const explicitAmt = Number(member.customMonthlyAmount ?? member.monthlyAmount ?? member.amountToPay);
      if (!isNaN(explicitAmt) && explicitAmt > 0) {
        return explicitAmt;
      }
    }
    if (typeof member.customMonthlyAmount === 'number' && member.customMonthlyAmount > 0) {
      return member.customMonthlyAmount;
    }
  }

  // 3. Existing monthly adjustment record if passed
  if (monthlyAdjustment) {
    const adjMonthly = Number(
      monthlyAdjustment.chitAmount ??
      monthlyAdjustment.monthlyAmount ??
      monthlyAdjustment.reqChitAmount
    );
    if (!isNaN(adjMonthly) && adjMonthly > 0) {
      return adjMonthly;
    }
  }

  // 4. Current monthly amount configured for the assigned chit group
  const settingKey = `${val}_${grp}`;
  if (groupPaymentSettings) {
    const rawMap = groupPaymentSettings.settingsMap || groupPaymentSettings;
    if (typeof rawMap[settingKey] === 'number' && rawMap[settingKey] > 0) {
      return rawMap[settingKey];
    }
  }

  // 5. Chit group default or mathematical fallback
  if (chitGroup) {
    const grpMonthly = Number(chitGroup.monthlyPremium ?? chitGroup.monthlyAmount ?? chitGroup.baseGroupMonthly);
    if (!isNaN(grpMonthly) && grpMonthly > 0) {
      return grpMonthly;
    }
  }

  const legacyStored = Number(
    subscription?.monthlyAmount ??
    subscription?.amountToPay ??
    member?.monthlyAmount ??
    member?.amountToPay
  );
  if (!isNaN(legacyStored) && legacyStored > 0) {
    return legacyStored;
  }

  if (val > 0) {
    return Math.floor(val / 20);
  }

  return 5000;
}

/**
 * Check if the effective monthly amount originates from a member-specific custom amount.
 */
export function isMemberSpecificMonthlyAmount(member = null, subscription = null, groupPaymentSettings = {}) {
  return hasExplicitCustomMonthlyAmount(member, subscription);
}

/**
 * Calculate the total payable amount for a single holding/subscription.
 * Formula: Math.max((effectiveMonthly * quantity) + pending - balance, 0)
 */
export function calculateHoldingPayable(
  subscription,
  member = null,
  groupPaymentSettings = {},
  chitGroup = null,
  monthlyAdjustment = null
) {
  if (!subscription) return 0;
  if (subscription.status && subscription.status !== 'ACTIVE') return 0;

  const baseMonthly = getEffectiveMonthlyAmount(member, subscription, groupPaymentSettings, chitGroup, monthlyAdjustment);
  const quantity = Number(subscription.quantity || 1);
  const pending = Number(subscription.pending || 0);
  const balance = Number(subscription.balance || 0);

  return Math.max((baseMonthly * quantity) + pending - balance, 0);
}

/**
 * Calculate the aggregate payable amount across all active subscriptions for a member.
 */
export function calculateMemberAggregatePayable(member, groupPaymentSettings = {}) {
  if (!member || !Array.isArray(member.chits) || member.chits.length === 0) return 0;

  const activeChits = member.chits.filter((c) => !c.status || c.status === 'ACTIVE');
  return activeChits.reduce((total, chit) => {
    return total + calculateHoldingPayable(chit, member, groupPaymentSettings);
  }, 0);
}
