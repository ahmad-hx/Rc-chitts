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
 * Normalizes group identifiers (e.g. 'Group I', 'group_I', 'GROUP I', 'I' -> 'I')
 */
export function normalizeGroupId(raw = '') {
  if (!raw) return 'I';
  const clean = String(raw)
    .trim()
    .toUpperCase()
    .replace(/^GROUP[_\s-]*/i, '')
    .replace(/^[_\s-]+/, '')
    .trim();
  return clean || 'I';
}

/**
 * Determines whether a subscription or member has an explicitly configured custom monthly amount
 * rather than an inherited default value.
 *
 * @param {Object} member - The member object
 * @param {Object} subscription - The specific chit holding/subscription object
 * @returns {boolean} True if explicitly customized with a valid positive number
 */
export function hasExplicitCustomMonthlyAmount(member = null, subscription = null) {
  // Check explicit flags and positive custom amount on subscription
  if (subscription) {
    const isFlagged =
      subscription.hasCustomMonthlyAmount === true ||
      subscription.isCustomMonthly === true ||
      subscription.isCustomAmount === true;
    const hasCustomVal = typeof subscription.customMonthlyAmount === 'number' && subscription.customMonthlyAmount > 0;
    if (isFlagged && hasCustomVal) {
      return true;
    }
  }

  // Check explicit flags and positive custom amount on root member object
  if (member) {
    const isFlagged =
      member.hasCustomMonthlyAmount === true ||
      member.isCustomMonthly === true ||
      member.isCustomAmount === true;
    const hasCustomVal = typeof member.customMonthlyAmount === 'number' && member.customMonthlyAmount > 0;
    if (isFlagged && hasCustomVal) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve the effective base monthly payable amount for a member's specific chit subscription.
 *
 * Consistent Business Rule:
 * 1. If subscription/member has an explicit, valid custom monthly amount, use it.
 * 2. Otherwise, use current monthly amount configured for the assigned chit group.
 * 3. Fallback to chit group definition, legacy stored amount, or Math.floor(val / 20) / 5000.
 *
 * @param {Object} member - The member object
 * @param {Object} subscription - The specific chit holding/subscription object
 * @param {Object} groupPaymentSettings - Map or object of group payment settings
 * @param {Object} [chitGroup] - Optional chit group definition
 * @param {Object} [monthlyAdjustment] - Optional monthly adjustment record
 * @returns {number} The resolved base monthly amount
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
  const rawGrp = String(
    subscription?.groupId ??
    subscription?.group ??
    subscription?.chitGroup ??
    member?.groupId ??
    member?.group ??
    chitGroup?.groupId ??
    'I'
  ).trim();
  const grpUpper = rawGrp.toUpperCase();
  const cleanGrp = normalizeGroupId(rawGrp);

  // 1. Explicit individual subscription custom amount (only if explicitly configured with valid amount)
  if (subscription && hasExplicitCustomMonthlyAmount(null, subscription)) {
    const customAmt = Number(subscription.customMonthlyAmount);
    if (!isNaN(customAmt) && customAmt > 0) {
      return customAmt;
    }
  }

  // 2. Explicit member custom amount (only if explicitly configured with valid amount)
  if (member && hasExplicitCustomMonthlyAmount(member, null)) {
    const customAmt = Number(member.customMonthlyAmount);
    if (!isNaN(customAmt) && customAmt > 0) {
      return customAmt;
    }
  }

  // 3. Current monthly amount configured for the assigned chit group (check normalized & raw keys)
  if (groupPaymentSettings) {
    const rawMap = groupPaymentSettings.settingsMap || groupPaymentSettings;
    const candidateKeys = [
      `${val}_${cleanGrp}`,
      `${val}_${grpUpper}`,
      `${val}_${rawGrp}`,
      `group_${cleanGrp}_${val}`,
      `group_${grpUpper}_${val}`,
      `${cleanGrp}_${val}`,
      `${grpUpper}_${val}`,
    ];

    for (const key of candidateKeys) {
      const entry = rawMap[key];
      if (typeof entry === 'number' && entry > 0) {
        return entry;
      }
      if (entry && typeof entry === 'object') {
        const amt = Number(entry.monthlyAmount ?? entry.monthlyPayment ?? entry.baseAmount ?? entry.amount);
        if (!isNaN(amt) && amt > 0) {
          return amt;
        }
      }
    }
  }

  // 4. Existing monthly adjustment record if passed
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

  // 5. Chit group default definition
  if (chitGroup) {
    const grpMonthly = Number(chitGroup.monthlyPremium ?? chitGroup.monthlyAmount ?? chitGroup.baseGroupMonthly);
    if (!isNaN(grpMonthly) && grpMonthly > 0) {
      return grpMonthly;
    }
  }

  // 6. Legacy stored subscription or member amount
  const legacyStored = Number(
    subscription?.monthlyAmount ??
    subscription?.amountToPay ??
    member?.monthlyAmount ??
    member?.amountToPay
  );
  if (!isNaN(legacyStored) && legacyStored > 0) {
    return legacyStored;
  }

  // 7. Mathematical fallback
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
