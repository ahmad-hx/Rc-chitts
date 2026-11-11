/**
 * Raghavendra Chitts — Centralized Global Monthly Payment Resolution Utility
 *
 * Implements the global resolution priority for member monthly subscription amounts:
 * 1. Explicit individual subscription custom amount (intentionally configured by admin)
 * 2. Explicit member custom amount (for single-chit members only)
 * 3. Current monthly amount configured for the assigned chit group (groupPaymentSettings[`${val}_${grp}`])
 * 4. Chit group definition premium (chitGroup.monthlyPremium / matchedGroup.monthlyPremium)
 * 5. Monthly adjustment record (if active for current billing cycle)
 * 6. Subscription stored monthly amount (from Firestore subscription document)
 * 7. Mathematical default fallback (Math.floor(val / 20), 5000)
 */

/**
 * Normalizes group identifiers into clean, stable codes (e.g. 'Group I', 'group_I', 'GROUP I', 'I', 'group_I_100000' -> 'I')
 */
export function normalizeGroupId(raw = '') {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // If raw is in Firestore doc format like 'group_I_100000' or 'group_A_200000'
  const docMatch = str.match(/^group[_\s-]+([A-Za-z0-9]+)[_\s-]+(\d+)$/i);
  if (docMatch && docMatch[1]) {
    return docMatch[1].toUpperCase();
  }

  // Remove prefixes like 'GROUP', 'group_', 'Group-'
  const clean = str
    .toUpperCase()
    .replace(/^GROUP[_\s-]*/i, '')
    .replace(/^[_\s-]+/, '')
    .replace(/[_\s-]+(\d{5,7})$/, '') // Strip trailing chit values if joined with underscore (e.g. 'I_100000' -> 'I')
    .trim();

  return clean;
}

/**
 * Extracts normalized group ID, chit value, and stable Firestore document ID from various group references.
 */
export function extractGroupDocInfo(rawGroupIdOrDocId, chitValue = 100000) {
  const str = String(rawGroupIdOrDocId || '').trim();
  const docMatch = str.match(/^group[_\s-]+([A-Za-z0-9]+)[_\s-]+(\d+)$/i);
  if (docMatch) {
    const groupId = docMatch[1].toUpperCase();
    const val = Number(docMatch[2]) || Number(chitValue) || 100000;
    return {
      groupId,
      chitValue: val,
      groupDocId: `group_${groupId}_${val}`,
    };
  }

  const groupId = normalizeGroupId(str) || 'I';
  const val = Number(chitValue) || 100000;
  return {
    groupId,
    chitValue: val,
    groupDocId: `group_${groupId}_${val}`,
  };
}

/**
 * Determines whether a subscription belongs to a specific target chit group using stable IDs and references.
 * Never misidentifies unrelated subscriptions or groups.
 *
 * @param {Object} subscription - Member subscription/holding object
 * @param {string} targetGroupId - Normalized or raw target group ID (e.g. 'I', 'Group I')
 * @param {number} targetChitValue - Total chit value of target group (e.g. 100000)
 * @param {string} [targetGroupDocId] - Firestore group document ID (e.g. 'group_I_100000')
 * @returns {boolean} True if subscription belongs to the target group
 */
export function isSubscriptionBelongingToGroup(
  subscription,
  targetGroupId,
  targetChitValue = 100000,
  targetGroupDocId = null
) {
  if (!subscription) return false;

  const targetCleanGrp = normalizeGroupId(targetGroupId);
  const targetVal = Number(targetChitValue || 100000);
  const targetDocId = targetGroupDocId || (targetCleanGrp ? `group_${targetCleanGrp}_${targetVal}` : null);

  // 1. Direct document ID match if present
  const subDocId = subscription.groupDocId || subscription.chitDocId;
  if (subDocId && (subDocId === targetDocId || subDocId === targetGroupDocId)) {
    return true;
  }

  const subChitId = subscription.chitId || subscription.id;
  if (subChitId && (subChitId === targetDocId || subChitId === targetGroupDocId)) {
    return true;
  }

  // 2. Normalized group and value comparison
  const rawSubGrp = subscription.groupId || subscription.group || subscription.chitGroup || '';
  const cleanSubGrp = normalizeGroupId(rawSubGrp);

  if (!cleanSubGrp || !targetCleanGrp) {
    return false;
  }

  const subVal = Number(
    subscription.totalChitValue ??
    subscription.totalValue ??
    subscription.chitValue ??
    subscription.value ??
    0
  );

  const grpMatches = cleanSubGrp.toUpperCase() === targetCleanGrp.toUpperCase();
  const valMatches = subVal > 0 ? subVal === targetVal : true;

  return grpMatches && valMatches;
}

/**
 * Resolves the parent chit group for a subscription from a given groups array.
 * Uses stable identifiers (document IDs, normalized group code, and chit value).
 *
 * @param {Object} subscription - Member subscription object
 * @param {Array} allGroupsList - Array of chit group definitions
 * @returns {Object|null} The matched chit group object or null
 */
export function findAssociatedGroupForSubscription(subscription, allGroupsList = []) {
  if (!subscription || !Array.isArray(allGroupsList) || allGroupsList.length === 0) {
    return null;
  }

  const subDocId = String(subscription.groupDocId || subscription.chitDocId || subscription.chitId || '').trim();
  const subId = String(subscription.id || '').trim();
  const rawSubGrp = String(subscription.groupId || subscription.group || subscription.chitGroup || '').trim();
  const cleanSubGrp = normalizeGroupId(rawSubGrp);
  const subVal = Number(subscription.totalChitValue ?? subscription.totalValue ?? subscription.chitValue ?? 0);

  // 1. Direct document ID match
  if (subDocId) {
    const matched = allGroupsList.find((g) => g.id === subDocId);
    if (matched) return matched;
  }

  if (subId && subId.startsWith('group_')) {
    const matched = allGroupsList.find((g) => g.id === subId);
    if (matched) return matched;
  }

  // 2. Match by normalized groupId AND totalChitValue
  if (cleanSubGrp) {
    const matched = allGroupsList.find((g) => {
      const gClean = normalizeGroupId(g.groupId || g.group || g.id);
      const gVal = Number(g.totalChitValue ?? g.totalValue ?? g.chitValue ?? 0);
      const grpMatch = gClean.toUpperCase() === cleanSubGrp.toUpperCase();
      const valMatch = subVal > 0 ? (gVal > 0 ? gVal === subVal : true) : true;
      return grpMatch && valMatch;
    });
    if (matched) return matched;
  }

  // 3. Fallback to isSubscriptionBelongingToGroup
  for (const g of allGroupsList) {
    if (isSubscriptionBelongingToGroup(subscription, g.groupId, g.totalChitValue, g.id)) {
      return g;
    }
  }

  return null;
}

/**
 * Determines whether a subscription or member has an explicitly configured custom monthly amount
 * rather than an inherited or legacy default value.
 *
 * Business Rules:
 * - An amount is custom ONLY if the admin explicitly enabled it (hasCustomMonthlyAmount === true).
 * - An old group amount stored in monthlyAmount or customMonthlyAmount is NOT considered custom
 *   if it equals the current group amount or if the custom flag is disabled.
 * - For Multiple Chit members, root member custom fields NEVER apply to individual subscriptions.
 * - When custom amount is cleared/removed, this returns false so the subscription falls back to the group amount.
 *
 * @param {Object} member - The member object
 * @param {Object} subscription - The specific chit holding/subscription object
 * @param {number} [groupMonthlyAmount] - Optional current group monthly amount for validation
 * @returns {boolean} True if explicitly customized with a valid positive number
 */
export function hasExplicitCustomMonthlyAmount(member = null, subscription = null, groupMonthlyAmount = null) {
  // Check subscription object
  if (subscription) {
    const isExplicitlyDisabled = subscription.hasCustomMonthlyAmount === false;
    if (isExplicitlyDisabled) {
      return false;
    }

    const isFlagged =
      subscription.hasCustomMonthlyAmount === true ||
      subscription.isCustomMonthly === true ||
      subscription.isCustomAmount === true;

    const customAmt = typeof subscription.customMonthlyAmount === 'number'
      ? subscription.customMonthlyAmount
      : Number(subscription.customMonthlyAmount);

    const hasValidCustomNumber = !isNaN(customAmt) && customAmt > 0;

    if (isFlagged && hasValidCustomNumber) {
      // If custom amount equals current group monthly amount, do not mistake it for a divergent custom override
      if (typeof groupMonthlyAmount === 'number' && groupMonthlyAmount > 0 && customAmt === groupMonthlyAmount) {
        return false;
      }
      return true;
    }

    // Also support custom monthly amount set without flag if positive and not equal to group amount
    if (!isExplicitlyDisabled && hasValidCustomNumber) {
      if (typeof groupMonthlyAmount === 'number' && groupMonthlyAmount > 0 && customAmt === groupMonthlyAmount) {
        return false;
      }
      if (typeof groupMonthlyAmount === 'number' && groupMonthlyAmount > 0 && customAmt !== groupMonthlyAmount) {
        return true;
      }
    }

    // Subscription does not have its own explicit custom amount
    // If member has multiple chits, do NOT leak root member fields to this subscription
    const isMultiChit =
      member?.classification === 'MULTIPLE' ||
      (Array.isArray(member?.chits) && member.chits.length > 1) ||
      (Array.isArray(member?.holdings) && member.holdings.length > 1);

    if (isMultiChit) {
      return false;
    }
  }

  // Check root member object (only for single chit members without subscription-level overrides)
  if (member) {
    const isMultiChit =
      member.classification === 'MULTIPLE' ||
      (Array.isArray(member.chits) && member.chits.length > 1) ||
      (Array.isArray(member.holdings) && member.holdings.length > 1);

    if (isMultiChit) {
      return false;
    }

    const isExplicitlyDisabled = member.hasCustomMonthlyAmount === false;
    if (isExplicitlyDisabled) {
      return false;
    }

    const isFlagged =
      member.hasCustomMonthlyAmount === true ||
      member.isCustomMonthly === true ||
      member.isCustomAmount === true;

    const customAmt = typeof member.customMonthlyAmount === 'number'
      ? member.customMonthlyAmount
      : Number(member.customMonthlyAmount);

    const hasValidCustomNumber = !isNaN(customAmt) && customAmt > 0;

    if (isFlagged && hasValidCustomNumber) {
      if (typeof groupMonthlyAmount === 'number' && groupMonthlyAmount > 0 && customAmt === groupMonthlyAmount) {
        return false;
      }
      return true;
    }

    if (!isExplicitlyDisabled && hasValidCustomNumber) {
      if (typeof groupMonthlyAmount === 'number' && groupMonthlyAmount > 0 && customAmt === groupMonthlyAmount) {
        return false;
      }
      if (typeof groupMonthlyAmount === 'number' && groupMonthlyAmount > 0 && customAmt !== groupMonthlyAmount) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolve the effective base monthly payable amount for a member's specific chit subscription.
 *
 * Consistent Global Business Rule:
 * 1. If subscription/member has an explicit, valid custom monthly amount, use it.
 * 2. Otherwise, use current monthly amount configured for the assigned chit group (from groupPaymentSettings).
 * 3. Fallback to chit group definition (chitGroup.monthlyPremium / matchedGroup.monthlyPremium).
 * 4. Fallback to active monthly adjustment record if passed.
 * 5. Fallback to subscription stored monthly amount from Firestore (subscription.monthlyAmount / amountToPay).
 * 6. Fallback to mathematical default Math.floor(val / 20) or 5000.
 *
 * NEVER falls back to an old stored amount if the group has a configured monthly amount.
 * NEVER reuses one subscription's amount for the next subscription.
 *
 * @param {Object} member - The member object
 * @param {Object} subscription - The specific chit holding/subscription object
 * @param {Object} [groupPaymentSettings] - Map or object of group payment settings
 * @param {Object} [chitGroup] - Optional chit group definition
 * @param {Object} [monthlyAdjustment] - Optional monthly adjustment record
 * @param {Array} [allGroupsList] - Optional list of chit groups for automatic group resolution
 * @returns {number} The resolved base monthly amount
 */
export function getEffectiveMonthlyAmount(
  member = null,
  subscription = null,
  groupPaymentSettings = {},
  chitGroup = null,
  monthlyAdjustment = null,
  allGroupsList = []
) {
  // Resolve associated group if chitGroup not provided or provided as list
  const groupsArray = Array.isArray(allGroupsList) && allGroupsList.length > 0
    ? allGroupsList
    : (Array.isArray(chitGroup) && chitGroup.length > 0 ? chitGroup : []);

  const resolvedGroup = (chitGroup && !Array.isArray(chitGroup))
    ? chitGroup
    : (groupsArray.length > 0 ? findAssociatedGroupForSubscription(subscription, groupsArray) : null);

  const val = Number(
    subscription?.totalChitValue ??
    subscription?.totalValue ??
    subscription?.chitValue ??
    resolvedGroup?.totalChitValue ??
    member?.calculatedTotalChitValue ??
    100000
  );

  const rawGrp = String(
    subscription?.groupId ??
    subscription?.group ??
    subscription?.chitGroup ??
    resolvedGroup?.groupId ??
    member?.groupId ??
    member?.group ??
    'I'
  ).trim();

  const cleanGrp = normalizeGroupId(rawGrp) || 'I';
  const grpUpper = cleanGrp.toUpperCase();
  const targetDocId = subscription?.groupDocId || subscription?.chitDocId || resolvedGroup?.id || `group_${cleanGrp}_${val}`;

  // Find current group monthly amount from groupPaymentSettings first to check against custom overrides
  let groupSettingAmt = null;
  if (groupPaymentSettings) {
    const rawMap = groupPaymentSettings.settingsMap || groupPaymentSettings;
    const candidateKeys = [
      `${val}_${cleanGrp}`,
      `${val}_${grpUpper}`,
      `${val}_GROUP ${cleanGrp}`,
      `${val}_Group ${cleanGrp}`,
      `${val}_${rawGrp}`,
      `group_${cleanGrp}_${val}`,
      `group_${cleanGrp.toLowerCase()}_${val}`,
      `group_${grpUpper}_${val}`,
      targetDocId,
      resolvedGroup?.id,
      resolvedGroup?.totalChitValue ? `${resolvedGroup.totalChitValue}_${normalizeGroupId(resolvedGroup.groupId)}` : null,
      `${cleanGrp}_${val}`,
      `${grpUpper}_${val}`,
    ].filter(Boolean);

    for (const key of candidateKeys) {
      const entry = rawMap[key];
      if (typeof entry === 'number' && entry > 0) {
        groupSettingAmt = entry;
        break;
      }
      if (entry && typeof entry === 'object') {
        const amt = Number(entry.monthlyAmount ?? entry.monthlyPayment ?? entry.baseAmount ?? entry.amount);
        if (!isNaN(amt) && amt > 0) {
          groupSettingAmt = amt;
          break;
        }
      }
    }

    if (groupSettingAmt === null && Array.isArray(groupPaymentSettings.settingsList)) {
      const found = groupPaymentSettings.settingsList.find(
        (s) => Number(s.chitValue) === val && normalizeGroupId(s.groupId || s.cleanGroupId) === cleanGrp
      );
      if (found && typeof found.monthlyAmount === 'number' && found.monthlyAmount > 0) {
        groupSettingAmt = found.monthlyAmount;
      }
    }
  }

  // If not found in groupPaymentSettings, check resolvedGroup definition
  if (groupSettingAmt === null && resolvedGroup) {
    const grpMonthly = Number(
      resolvedGroup.monthlyPremium ??
      resolvedGroup.monthlyAmount ??
      resolvedGroup.baseGroupMonthly
    );
    if (!isNaN(grpMonthly) && grpMonthly > 0) {
      groupSettingAmt = grpMonthly;
    }
  }

  // 1. Explicit individual subscription custom amount (only if explicitly enabled with a valid amount)
  if (subscription && hasExplicitCustomMonthlyAmount(null, subscription, groupSettingAmt)) {
    const customAmt = Number(subscription.customMonthlyAmount ?? subscription.monthlyAmount);
    if (!isNaN(customAmt) && customAmt > 0) {
      return customAmt;
    }
  }

  // 2. Explicit single-chit member custom amount
  if (member && hasExplicitCustomMonthlyAmount(member, null, groupSettingAmt)) {
    const customAmt = Number(member.customMonthlyAmount);
    if (!isNaN(customAmt) && customAmt > 0) {
      return customAmt;
    }
  }

  // 3. Current monthly amount configured for the assigned chit group
  if (groupSettingAmt !== null && groupSettingAmt > 0) {
    return groupSettingAmt;
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

  // 5. Subscription's own stored monthly amount from Firestore (if positive and valid)
  if (subscription) {
    const subMonthly = Number(subscription.monthlyAmount ?? subscription.amountToPay);
    if (!isNaN(subMonthly) && subMonthly > 0) {
      return subMonthly;
    }
  }

  // 6. Chit group default definition
  if (resolvedGroup) {
    const grpMonthly = Number(resolvedGroup.monthlyPremium ?? resolvedGroup.monthlyAmount ?? resolvedGroup.baseGroupMonthly);
    if (!isNaN(grpMonthly) && grpMonthly > 0) {
      return grpMonthly;
    }
  }

  // 7. Mathematical standard fallback based on total chit value (e.g. 1L -> 5000, 2L -> 10000, 5L -> 25000)
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
  monthlyAdjustment = null,
  allGroupsList = []
) {
  if (!subscription) return 0;
  if (subscription.status && subscription.status !== 'ACTIVE') return 0;

  const baseMonthly = getEffectiveMonthlyAmount(member, subscription, groupPaymentSettings, chitGroup, monthlyAdjustment, allGroupsList);
  const quantity = Number(subscription.quantity || 1);
  const pending = Number(subscription.pending ?? subscription.pendingAmount ?? 0);
  const balance = Number(subscription.balance ?? 0);

  return Math.max((baseMonthly * quantity) + pending - balance, 0);
}

/**
 * Calculate the aggregate payable amount across all active subscriptions for a member.
 */
export function calculateMemberAggregatePayable(member, groupPaymentSettings = {}, allGroupsList = []) {
  if (!member) return 0;

  const activeChits = Array.isArray(member.chits) && member.chits.length > 0
    ? member.chits.filter((c) => !c.status || c.status === 'ACTIVE')
    : Array.isArray(member.holdings) && member.holdings.length > 0
    ? member.holdings.filter((c) => !c.status || c.status === 'ACTIVE')
    : [];

  if (activeChits.length === 0) {
    if (member.groupId || member.group) {
      return calculateHoldingPayable(member, member, groupPaymentSettings, null, null, allGroupsList);
    }
    return 0;
  }

  return activeChits.reduce((total, chit) => {
    return total + calculateHoldingPayable(chit, member, groupPaymentSettings, null, null, allGroupsList);
  }, 0);
}
