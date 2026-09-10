import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  History,
  QrCode,
  Smartphone,
  Unlink,
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import {
  MESSAGE_TEMPLATES,
  normalizePhone,
  filterRecipients,
  generatePersonalizedMessage,
  createMessageHistoryDoc,
  fetchMessageHistory,
  getActiveChits,
} from '../services/messagingService';
import {
  sendSingleWhatsAppMessage,
  sendTestWhatsAppMessage,
  getWhatsAppApiUrl,
  reconnectWhatsAppGateway,
  disconnectWhatsAppGateway,
} from '../services/whatsappService';
import { memberService, chitService, groupPaymentSettingsService } from '../services/dbService';
import { useBillingMonth } from '../context/BillingMonthContext';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils';
import { getChitMonthForGroup } from '../utils/chitMonthUtils';

function parseRomanNumeral(str = '') {
  const clean = String(str).toUpperCase().trim().replace(/^GROUP\s+/, '');
  const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let num = 0;
  for (let i = 0; i < clean.length; i++) {
    const current = romanMap[clean[i]] || 0;
    const next = romanMap[clean[i + 1]] || 0;
    if (current < next) {
      num -= current;
    } else {
      num += current;
    }
  }
  return num > 0 ? num : 999;
}

function compareGroupIds(groupIdA = '', groupIdB = '') {
  const cleanA = String(groupIdA).trim().toUpperCase();
  const cleanB = String(groupIdB).trim().toUpperCase();

  const romanPattern = /^(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$/i;
  const rawA = cleanA.replace(/^GROUP\s+/, '');
  const rawB = cleanB.replace(/^GROUP\s+/, '');

  const isRomanA = rawA.length > 0 && romanPattern.test(rawA);
  const isRomanB = rawB.length > 0 && romanPattern.test(rawB);

  if (isRomanA && isRomanB) {
    return parseRomanNumeral(rawA) - parseRomanNumeral(rawB);
  }

  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

export default function WhatsAppPlaceholder() {
  const { selectedMonth } = useBillingMonth();

  // 1. Core Data States
  const [members, setMembers] = useState([]);
  const [chits, setChits] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [toast, setToast] = useState(null);

  // 2. QR Code Gateway States
  const [qrGatewayState, setQrGatewayState] = useState({
    ok: true,
    connected: false,
    status: 'INITIALIZING',
    userPhone: '9705184411',
    qrCodeDataUrl: null,
  });
  const [qrFetchError, setQrFetchError] = useState(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [consecutiveQrErrors, setConsecutiveQrErrors] = useState(0);
  const [latestQrGenId, setLatestQrGenId] = useState(0);

  // 3. Template & Language States
  const [selectedTemplateId, setSelectedTemplateId] = useState('PAYMENT_REMINDER');
  const [language, setLanguage] = useState('english');
  const [customTemplateText, setCustomTemplateText] = useState(MESSAGE_TEMPLATES.PAYMENT_REMINDER.englishText);

  // 4. Parameter Inputs
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [billingMonth, setBillingMonth] = useState(selectedMonth || 'August 2026');
  const [dueDate, setDueDate] = useState('15th of Month');
  const [chitAmount, setChitAmount] = useState('25000');
  const [groupPendingAmount, setGroupPendingAmount] = useState('0');
  const [balanceAmount, setBalanceAmount] = useState('0');

  // 5. Recipient Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // 6. Selection States
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [selectedPreviewMember, setSelectedPreviewMember] = useState(null);

  // 7. Sending States
  const [isSendingSingle, setIsSendingSingle] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({
    isSending: false,
    current: 0,
    total: 0,
    sentCount: 0,
    failedCount: 0,
  });
  const [bulkSummaryModal, setBulkSummaryModal] = useState(null);

  // 8. History & Audit Logs
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [detailsLogModal, setDetailsLogModal] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Sync billing month from global context
  useEffect(() => {
    if (selectedMonth) {
      setBillingMonth(selectedMonth);
    }
  }, [selectedMonth]);

  // Dynamically sync amount parameters with selected preview member
  useEffect(() => {
    if (selectedPreviewMember) {
      const activeChits = getActiveChits(selectedPreviewMember);
      const isMulti = selectedPreviewMember.classification === 'MULTIPLE' || activeChits.length > 1;
      if (isMulti) {
        let sumChit = 0;
        let sumPending = 0;
        let sumBalance = 0;
        activeChits.forEach((c) => {
          const baseMonthly = getEffectiveMonthlyAmount(selectedPreviewMember, c, groupPaymentSettings);
          const qty = Number(c.quantity || 1);
          sumChit += baseMonthly * qty;
          sumPending += Number(c.pending || 0);
          sumBalance += Number(c.balance || 0);
        });
        setChitAmount(String(sumChit));
        setGroupPendingAmount(String(sumPending));
        setBalanceAmount(String(sumBalance));
      } else {
        const targetChit = activeChits[0] || (selectedPreviewMember.groupId || selectedPreviewMember.group || selectedPreviewMember.chitGroup ? {
          groupId: selectedPreviewMember.groupId || selectedPreviewMember.group || selectedPreviewMember.chitGroup,
          totalChitValue: selectedPreviewMember.calculatedTotalChitValue || selectedPreviewMember.totalChitValue || 100000,
          pending: selectedPreviewMember.pending || 0,
          balance: selectedPreviewMember.balance || 0,
          quantity: 1,
        } : {});
        const baseMonthly = getEffectiveMonthlyAmount(selectedPreviewMember, targetChit, groupPaymentSettings);
        const qty = Number(targetChit.quantity || 1);
        const singleMonthly = baseMonthly * qty;
        const singlePending = Number(targetChit.pending ?? selectedPreviewMember.pending ?? 0);
        const singleBalance = Number(targetChit.balance ?? selectedPreviewMember.balance ?? 0);
        setChitAmount(String(singleMonthly));
        setGroupPendingAmount(String(singlePending));
        setBalanceAmount(String(singleBalance));
      }
    }
  }, [selectedPreviewMember, groupPaymentSettings]);

  // Auto-Calculated Amounts
  const totalAmount = useMemo(() => {
    const c = Number(chitAmount) || 0;
    const p = Number(groupPendingAmount) || 0;
    return c + p;
  }, [chitAmount, groupPendingAmount]);

  const finalAmount = useMemo(() => {
    const b = Number(balanceAmount) || 0;
    return totalAmount - b;
  }, [totalAmount, balanceAmount]);

  // Sync group selection between filters and parameters
  const handleGroupFilterChange = (val) => {
    setGroupFilter(val);
    setSelectedGroupId(val);
  };

  // Dynamically extract all unique group IDs from loaded Firestore chits and members data
  const availableGroups = useMemo(() => {
    const groupsSet = new Set();

    (chits || []).forEach((c) => {
      if (c.groupId) groupsSet.add(String(c.groupId).trim());
      if (c.group) groupsSet.add(String(c.group).trim());
    });

    (members || []).forEach((m) => {
      if (m.group) groupsSet.add(String(m.group).trim());
      if (m.groupId) groupsSet.add(String(m.groupId).trim());
      if (m.chitGroup) groupsSet.add(String(m.chitGroup).trim());

      const activeChits = m.chits || m.holdings || [];
      if (Array.isArray(activeChits)) {
        activeChits.forEach((c) => {
          if (c.groupId) groupsSet.add(String(c.groupId).trim());
          if (c.group) groupsSet.add(String(c.group).trim());
          if (c.chitGroup) groupsSet.add(String(c.chitGroup).trim());
        });
      }
    });

    return Array.from(groupsSet).filter(Boolean).sort(compareGroupIds);
  }, [chits, members]);

  // FEATURE 2: Organize Groups Hierarchically by Chit Amount (1L -> 2L -> 5L -> 10L)
  const groupedAvailableGroups = useMemo(() => {
    const groupValueMap = new Map();

    (chits || []).forEach((c) => {
      const gId = String(c.groupId || c.group || '').trim();
      const val = Number(c.totalChitValue || c.totalValue || c.chitValue || 100000);
      if (gId) groupValueMap.set(gId, val);
    });

    (members || []).forEach((m) => {
      (m.chits || m.holdings || []).forEach((c) => {
        const gId = String(c.groupId || c.group || '').trim();
        const val = Number(c.totalChitValue || c.totalValue || c.chitValue || 100000);
        if (gId && !groupValueMap.has(gId)) {
          groupValueMap.set(gId, val);
        }
      });
    });

    const categoryMap = new Map();

    (availableGroups || []).forEach((gId) => {
      const val = groupValueMap.get(gId) || 100000;
      const lakhStr = val >= 100000 ? `${(val / 100000).toFixed(0)} Lakh Chit Groups` : `₹${val.toLocaleString('en-IN')} Groups`;
      if (!categoryMap.has(val)) {
        categoryMap.set(val, { val, label: lakhStr, groups: [] });
      }
      categoryMap.get(val).groups.push(gId);
    });

    const sortedCategories = Array.from(categoryMap.values()).sort((a, b) => a.val - b.val);

    sortedCategories.forEach((cat) => {
      cat.groups.sort(compareGroupIds);
    });

    return sortedCategories;
  }, [availableGroups, chits, members]);

  // Poll QR Code Gateway Status with generational tracking and cold start tolerance
  const fetchQrGatewayStatus = useCallback(async () => {
    try {
      const res = await fetch(getWhatsAppApiUrl('/api/whatsapp/qr'));
      if (res.ok) {
        const data = await res.json();
        setConsecutiveQrErrors(0);
        setQrFetchError(null);

        // Discard stale responses if generation ID is older than latest seen
        if (data.qrGenerationId && data.qrGenerationId < latestQrGenId) {
          return;
        }

        if (data.qrGenerationId && data.qrGenerationId >= latestQrGenId) {
          setLatestQrGenId(data.qrGenerationId);
        }

        setQrGatewayState({
          ok: data.ok ?? true,
          connected: Boolean(data.connected),
          status: data.status || (data.connected ? 'CONNECTED' : (data.qrCodeDataUrl ? 'QR_READY' : 'INITIALIZING')),
          userPhone: data.userPhone || '9705184411',
          userName: data.userName || 'Raghavendra Chitts',
          lastConnected: data.lastConnected || null,
          error: data.error || null,
          qrCodeDataUrl: data.qrCodeDataUrl || null,
          qrGenerationId: data.qrGenerationId || 0,
        });

        if (data.connected && isQrModalOpen) {
          setIsQrModalOpen(false);
          showToast(`✓ WhatsApp Linked to +${data.userPhone || 'device'}! Ready for messaging.`, 'success');
        }
      } else {
        setConsecutiveQrErrors((prev) => {
          const next = prev + 1;
          if (next >= 4) {
            setQrFetchError('WhatsApp Gateway needs to be restarted.');
          }
          return next;
        });
      }
    } catch (_) {
      setConsecutiveQrErrors((prev) => {
        const next = prev + 1;
        if (next >= 4) {
          setQrFetchError('Connecting to WhatsApp Gateway... (Service waking up)');
        }
        return next;
      });
    }
  }, [latestQrGenId, isQrModalOpen]);

  const handleGenerateNewQr = async () => {
    setIsQrLoading(true);
    setQrFetchError(null);
    setConsecutiveQrErrors(0);
    setQrGatewayState((prev) => ({
      ...prev,
      status: 'INITIALIZING',
      qrCodeDataUrl: null,
      error: null,
    }));

    try {
      const data = await reconnectWhatsAppGateway();
      if (data && data.ok) {
        if (data.qrGenerationId) {
          setLatestQrGenId(data.qrGenerationId);
        }
        setQrGatewayState({
          ok: true,
          connected: Boolean(data.connected),
          status: data.status || (data.qrCodeDataUrl ? 'QR_READY' : 'INITIALIZING'),
          userPhone: data.userPhone || '9705184411',
          userName: data.userName || 'Raghavendra Chitts',
          lastConnected: data.lastConnected || null,
          error: data.error || null,
          qrCodeDataUrl: data.qrCodeDataUrl || null,
          qrGenerationId: data.qrGenerationId || 0,
        });
        showToast('Generated fresh QR Code! Scan with WhatsApp.', 'info');
      } else {
        setQrFetchError(data?.error || 'Unable to initialize fresh QR session.');
      }
    } catch (e) {
      setQrFetchError('Failed to connect to WhatsApp Gateway.');
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleDisconnectDevice = async () => {
    setIsQrLoading(true);
    setQrGatewayState((prev) => ({ ...prev, status: 'DISCONNECTING' }));

    try {
      await disconnectWhatsAppGateway();
      setQrGatewayState({
        ok: true,
        connected: false,
        status: 'DISCONNECTED',
        userPhone: '9705184411',
        userName: 'Raghavendra Chitts',
        lastConnected: null,
        error: null,
        qrCodeDataUrl: null,
        qrGenerationId: 0,
      });
      showToast('WhatsApp device unlinked successfully.', 'info');
    } catch (err) {
      showToast('Failed to unlink device.', 'error');
    } finally {
      setIsQrLoading(false);
    }
  };

  useEffect(() => {
    fetchQrGatewayStatus();
    const interval = setInterval(fetchQrGatewayStatus, 2500);
    return () => clearInterval(interval);
  }, [fetchQrGatewayStatus]);

  const handleOpenQrModal = () => {
    setIsQrModalOpen(true);
    if (!qrGatewayState.connected && !qrGatewayState.qrCodeDataUrl) {
      handleGenerateNewQr();
    }
  };

  // Load Firestore Data on Mount
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [fetchedMembers, fetchedChits, settingsRes] = await Promise.all([
          memberService.getMembers().catch(() => []),
          chitService.getChits().catch(() => []),
          groupPaymentSettingsService.getGroupPaymentSettings().catch(() => ({ settingsMap: {} })),
        ]);

        if (mounted) {
          const list = Array.isArray(fetchedMembers) ? fetchedMembers : [];
          const chitsList = Array.isArray(fetchedChits) ? fetchedChits : [];
          setMembers(list);
          setChits(chitsList);
          setGroupPaymentSettings(settingsRes?.settingsMap || {});

          // Extract groups for diagnostic logging
          const groupsSet = new Set();
          chitsList.forEach((c) => c.groupId && groupsSet.add(String(c.groupId)));
          list.forEach((m) => {
            if (m.groupId) groupsSet.add(String(m.groupId));
            if (m.group) groupsSet.add(String(m.group));
            (m.chits || []).forEach((c) => c.groupId && groupsSet.add(String(c.groupId)));
          });
          const uniqueGroups = Array.from(groupsSet).sort(compareGroupIds);

          console.log('Total members loaded:', list.length);
          console.log('Available groups:', uniqueGroups);
          if (list.length > 0) {
            setSelectedPreviewMember(list[0]);
          }
        }
      } catch (err) {
        if (mounted) {
          showToast('Failed to load member records from Firebase.', 'error');
        }
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Message History from Firestore ('messageHistory' collection)
  const refreshHistoryLogs = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const logs = await fetchMessageHistory({ statusFilter: historyStatusFilter, limitCount: 50 });
      setHistoryLogs(logs || []);
    } catch (_) {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyStatusFilter]);

  useEffect(() => {
    refreshHistoryLogs();
  }, [refreshHistoryLogs]);

  // Sync Template Text on Template or Language Change
  useEffect(() => {
    const tmpl = MESSAGE_TEMPLATES[selectedTemplateId] || MESSAGE_TEMPLATES.PAYMENT_REMINDER;
    if (language === 'english') {
      setCustomTemplateText(tmpl.englishText);
    } else if (language === 'telugu') {
      setCustomTemplateText(tmpl.teluguText);
    } else {
      setCustomTemplateText(`${tmpl.englishText}\n\n-------------------\n\n${tmpl.teluguText}`);
    }
  }, [selectedTemplateId, language]);

  // Filtered Recipients List
  const filteredRecipients = useMemo(() => {
    const effectiveGroupFilter = groupFilter !== 'all' ? groupFilter : selectedGroupId;
    return filterRecipients(members, {
      searchQuery,
      categoryFilter,
      groupFilter: effectiveGroupFilter,
      statusFilter,
    });
  }, [members, searchQuery, categoryFilter, groupFilter, selectedGroupId, statusFilter]);

  // Auto-Select Filtered Members
  useEffect(() => {
    setSelectedMemberIds(filteredRecipients.map((m) => m.id));
  }, [filteredRecipients]);

  // Selection Handlers
  const handleSelectAll = () => {
    if (selectedMemberIds.length === filteredRecipients.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredRecipients.map((m) => m.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedMemberIds([]);
  };

  const handleToggleMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Personalized Message Compiler
  const getCompiledMessageForMember = (member) => {
    return generatePersonalizedMessage(member, customTemplateText, {
      groupId: selectedGroupId,
      billingMonth,
      dueDate,
      groupPaymentSettings,
      chitsList: chits,
    });
  };

  // Selected Members Roster
  const selectedMembersList = useMemo(() => {
    return filteredRecipients.filter((m) => selectedMemberIds.includes(m.id));
  }, [filteredRecipients, selectedMemberIds]);

  // Single Member Direct Backend Send Handler
  const handleSendSingleMessage = async (member) => {
    if (!member) return;

    const rawPhone = member.whatsapp || member.phone || '';
    const norm = normalizePhone(rawPhone);

    if (!norm) {
      showToast(`Member "${member.name}" does not have a valid WhatsApp phone number.`, 'error');
      return;
    }

    const messageContent = getCompiledMessageForMember(member);
    if (!messageContent || !messageContent.trim()) {
      showToast('Please enter message content before sending.', 'error');
      return;
    }

    setIsSendingSingle(true);

    try {
      // Call secure backend delivery service (Linked Device QR Gateway or Meta API)
      const res = await sendSingleWhatsAppMessage({
        member,
        recipient: norm,
        message: messageContent,
        language,
      });

      setIsSendingSingle(false);

      const isSent = res.success || res.status === 'SENT';
      const statusText = isSent ? 'SENT' : res.status || 'NOT_CONFIGURED';

      // Log accurate result into dedicated 'messageHistory' Firestore collection
      await createMessageHistoryDoc({
        member,
        phone: norm,
        channel: 'WHATSAPP',
        message: messageContent,
        status: statusText,
        groupId: selectedGroupId,
        billingMonth,
        chitAmount: Number(chitAmount || 0),
        pendingAmount: Number(groupPendingAmount || 0),
        balanceAmount: Number(balanceAmount || 0),
        totalAmount,
        finalAmount,
        isTest: false,
      });

      refreshHistoryLogs();

      if (isSent) {
        showToast(`✓ WhatsApp message sent directly to ${member.name}!`, 'success');
      } else if (res.status === 'NOT_CONFIGURED') {
        showToast(`⚠️ WhatsApp is not linked yet. Scan the QR code to link your device.`, 'warning');
        setIsQrModalOpen(true);
      } else {
        showToast(`✕ Delivery failed for ${member.name}: ${res.message || 'API error'}`, 'error');
      }
    } catch (err) {
      setIsSendingSingle(false);
      showToast(`Send error: ${err.message}`, 'error');
    }
  };

  // Quick Test Message Execution
  const handleExecuteTestSend = async (recipientName, rawPhone) => {
    const norm = normalizePhone(rawPhone);
    const testMsg = `Hello ${recipientName} 👋 This is a test message from Raghavendra Chitts.`;

    try {
      const res = await sendTestWhatsAppMessage({ recipient: norm, message: testMsg });

      const isSent = res.success || res.status === 'SENT';
      const statusText = isSent ? 'SENT' : res.status || 'NOT_CONFIGURED';

      await createMessageHistoryDoc({
        member: { id: 'test_member', name: recipientName },
        phone: norm,
        channel: 'WHATSAPP',
        message: testMsg,
        status: statusText,
        groupId: selectedGroupId,
        billingMonth,
        pendingAmount: 0,
        isTest: true,
      });

      refreshHistoryLogs();

      if (isSent) {
        showToast(`✓ Live test message sent to ${recipientName}!`, 'success');
      } else {
        showToast(`⚠️ Device not linked yet. Please scan QR Code to enable direct sending.`, 'warning');
        setIsQrModalOpen(true);
      }
    } catch (err) {
      showToast(`Test send error: ${err.message}`, 'error');
    }
  };

  // Bulk Batch Send Handler
  const handleExecuteBulkSend = async () => {
    const recipients = selectedMembersList;
    if (recipients.length === 0) return;

    setIsConfirmModalOpen(false);

    setBulkProgress({
      isSending: true,
      current: 0,
      total: recipients.length,
      sentCount: 0,
      failedCount: 0,
    });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const member = recipients[i];
      const norm = normalizePhone(member.whatsapp || member.phone);
      const messageContent = getCompiledMessageForMember(member);

      setBulkProgress({
        isSending: true,
        current: i + 1,
        total: recipients.length,
        sentCount: sent,
        failedCount: failed,
      });

      if (!norm) {
        failed += 1;
        await createMessageHistoryDoc({
          member,
          phone: member.whatsapp || member.phone || 'N/A',
          channel: 'WHATSAPP',
          message: messageContent,
          status: 'INVALID_NUMBER',
          groupId: selectedGroupId,
          billingMonth,
          chitAmount: Number(chitAmount || 0),
          pendingAmount: Number(groupPendingAmount || 0),
          balanceAmount: Number(balanceAmount || 0),
          totalAmount,
          finalAmount,
        });
        continue;
      }

      try {
        const res = await sendSingleWhatsAppMessage({
          member,
          recipient: norm,
          message: messageContent,
          language,
        });

        const isSent = res.success || res.status === 'SENT';
        const statusText = isSent ? 'SENT' : res.status || 'NOT_CONFIGURED';

        if (isSent) {
          sent += 1;
        } else {
          failed += 1;
        }

        await createMessageHistoryDoc({
          member,
          phone: norm,
          channel: 'WHATSAPP',
          message: messageContent,
          status: statusText,
          groupId: selectedGroupId,
          billingMonth,
          chitAmount: Number(chitAmount || 0),
          pendingAmount: Number(groupPendingAmount || 0),
          balanceAmount: Number(balanceAmount || 0),
          totalAmount,
          finalAmount,
        });
      } catch (_) {
        failed += 1;
      }

      await new Promise((r) => setTimeout(r, 250));
    }

    setBulkProgress({
      isSending: false,
      current: recipients.length,
      total: recipients.length,
      sentCount: sent,
      failedCount: failed,
    });

    setBulkSummaryModal({
      total: recipients.length,
      sentCount: sent,
      failedCount: failed,
    });

    refreshHistoryLogs();
  };

  const selectedCount = selectedMemberIds.length;
  const charCount = customTemplateText.length;

  return (
    <div className="space-y-6 font-sans max-w-7xl mx-auto pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─── LINKED DEVICE QR CODE GATEWAY CARD ────────────────────────────────────── */}
      <div className="bg-white border border-[#E5E5E1] rounded-2xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${qrGatewayState.connected ? 'bg-[#2F6B4F]' : 'bg-[#959590]'}`}></span>
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1C1C1A]">
              {qrGatewayState.connected ? '● CONNECTED' : '○ NOT CONNECTED'}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-[#1C1C1A] tracking-tight">
            WhatsApp Messaging Gateway
          </h1>
          <p className="text-xs text-[#6B6B67]">
            {qrGatewayState.connected
              ? `WhatsApp account (+${qrGatewayState.userPhone}) is ready to send messages.`
              : 'Connect your WhatsApp account to start sending messages.'}
          </p>
        </div>

        {/* QR GATEWAY ACTIONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!qrGatewayState.connected ? (
            <Button
              variant="primary"
              size="md"
              className="rounded-xl text-xs gap-2 bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold cursor-pointer shadow-xs"
              onClick={handleOpenQrModal}
            >
              <QrCode className="w-4 h-4" />
              <span>Generate QR Code</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5 border-[#E5E5E1] bg-[#F7F7F5] text-[#1C1C1A] hover:bg-[#E5E5E1] font-bold cursor-pointer"
                onClick={handleOpenQrModal}
                title="View Connected Status or Refresh Pairing"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Device Status</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="rounded-xl text-xs gap-1.5 bg-[#A33A3A] hover:bg-[#852E2E] text-white font-bold cursor-pointer"
                onClick={handleDisconnectDevice}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. RECIPIENT SELECTION SYSTEM (Under Gateway) ────────────────────────── */}
      <Card className="p-5 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-4 font-sans">
        
        {/* ROSTER HEADER & ACTION BUTTON */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E1]">
          <div>
            <h3 className="text-sm font-extrabold text-[#1C1C1A] uppercase tracking-wider">Recipient Selection System</h3>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              {filteredRecipients.length} members loaded • <span className="font-bold text-[#2F5D50]">{selectedCount} selected</span>
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 bg-[#2F5D50] hover:bg-[#24493F] text-white cursor-pointer shadow-xs disabled:opacity-50"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={selectedCount === 0 || bulkProgress.isSending}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to {selectedCount} Members</span>
          </Button>
        </div>

        {/* SEARCH & FILTERS TOOLBAR */}
        <div className="space-y-2.5 text-xs">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#959590]" />
            <input
              type="text"
              placeholder="Search member name, phone, whatsapp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] pl-9 pr-3 py-2 font-medium text-[#1C1C1A] focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-1.5 font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
            >
              <option value="all">All Chit Categories</option>
              <option value="100000">₹1 Lakh Category</option>
              <option value="200000">₹2 Lakh Category</option>
              <option value="500000">₹5 Lakh Category</option>
              <option value="single">Single Chit Only</option>
              <option value="multiple">Multi Chit Only</option>
            </select>

            {/* Group Filter */}
            <select
              value={groupFilter}
              onChange={(e) => handleGroupFilterChange(e.target.value)}
              className="rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-1.5 font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
            >
              <option value="all">All Groups</option>
              {groupedAvailableGroups.map((cat) => (
                <optgroup key={cat.val} label={`── ${cat.label} ──`}>
                  {cat.groups.map((g) => (
                    <option key={g} value={g}>
                      Group {g}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-1.5 font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="due">Pending Due</option>
              <option value="single">Single Chit</option>
              <option value="multiple">Multiple Chit</option>
            </select>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1.5 rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] font-bold text-[#1C1C1A] hover:bg-[#E5E5E1] cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] font-bold text-[#1C1C1A] hover:bg-[#E5E5E1] cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* BATCH SENDING PROGRESS BAR */}
        {bulkProgress.isSending && (
          <div className="p-3 bg-[#EDF7F0] border border-[#2F5D50]/20 rounded-xl space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-[#1C1C1A] font-mono">
              <span>Sending Messages ({bulkProgress.current} / {bulkProgress.total})</span>
              <span>Sent: {bulkProgress.sentCount} | Failed/Queued: {bulkProgress.failedCount}</span>
            </div>
            <div className="w-full bg-[#E5E5E1] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#2F5D50] h-full transition-all duration-300"
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* MEMBER ROSTER TABLE */}
        <div className="overflow-x-auto border border-[#E5E5E1] rounded-xl">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#F7F7F5] border-b border-[#E5E5E1] text-[10px] font-black uppercase tracking-wider text-[#6B6B67]">
              <tr>
                <th className="p-3 w-10 text-center">Select</th>
                <th className="p-3">Member Name</th>
                <th className="p-3">Normalized Phone</th>
                <th className="p-3">Group</th>
                <th className="p-3">Classification</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E1]">
              {filteredRecipients.length > 0 ? (
                filteredRecipients.map((member) => {
                  const isChecked = selectedMemberIds.includes(member.id);
                  const rawPhone = member.whatsapp || member.phone || '';
                  const norm = normalizePhone(rawPhone);
                  const activeChits = getActiveChits(member);
                  const isMulti = member.classification === 'MULTIPLE' || activeChits.length > 1;

                  // Extract group display name(s) dynamically
                  const grpSet = new Set();
                  activeChits.forEach((c) => {
                    if (c.groupId) grpSet.add(String(c.groupId));
                    else if (c.group) grpSet.add(String(c.group));
                  });
                  if (grpSet.size === 0) {
                    const rootGrp = member.groupId || member.group || member.chitGroup;
                    if (rootGrp) grpSet.add(String(rootGrp));
                  }
                  const groupArr = Array.from(grpSet);
                  const groupText = groupArr.length > 0 ? groupArr.map((g) => `Group ${g}`).join(', ') : 'N/A';

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-[#F7F7F5] transition-colors ${
                        selectedPreviewMember?.id === member.id ? 'bg-[#EDF7F0]' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMember(member.id)}
                          className="w-4 h-4 rounded border-[#E5E5E1] text-[#2F5D50] focus:ring-[#2F5D50] cursor-pointer"
                        />
                      </td>

                      <td className="p-3 font-bold text-[#1C1C1A]">
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewMember(member)}
                          className="hover:underline text-left"
                        >
                          {member.name}
                        </button>
                      </td>

                      <td className="p-3 font-mono text-[#6B6B67] font-medium">
                        {norm ? `+${norm}` : <span className="text-[#C53030]">No Phone</span>}
                      </td>

                      <td className="p-3 text-[#6B6B67] font-medium">{groupText}</td>

                      <td className="p-3">
                        <Badge variant={isMulti ? 'purple' : 'info'} className="text-[10px] font-bold">
                          {isMulti ? 'MULTIPLE' : 'SINGLE'}
                        </Badge>
                      </td>

                      <td className="p-3 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleSendSingleMessage(member)}
                          className="px-3 py-1 bg-[#2F5D50] hover:bg-[#24493F] text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send Message</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#6B6B67]">
                    No members match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── 3. PARAMETERS & COMPOSER SET SIDE-BY-SIDE UNDER RECIPIENT SELECTION SYSTEM ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">

        {/* LEFT COLUMN: 1. REMINDER PARAMETERS & AMOUNT CALCULATION BOXES */}
        <Card className="p-5 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-5">
          <h2 className="text-xs font-extrabold text-[#1C1C1A] uppercase tracking-wider border-b border-[#E5E5E1] pb-2">
            1. Reminder Parameters & Amount Breakdown
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs font-sans">
            <div>
              <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">Chit Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupFilterChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
              >
                <option value="all">All Groups</option>
                {chits.length > 0
                  ? chits.map((c) => {
                      const lakhVal = (Number(c.totalChitValue || 100000) / 100000).toFixed(0);
                      const monthInfo = getChitMonthForGroup(c, selectedMonth, chits);
                      const grpId = c.groupId || 'I';
                      const optVal = chits.filter((cg) => String(cg.groupId).toUpperCase() === String(grpId).toUpperCase()).length > 1
                        ? (c.id || `group_${grpId}_${c.totalChitValue || 100000}`)
                        : grpId;
                      return (
                        <option key={c.id || `${grpId}_${c.totalChitValue}`} value={optVal}>
                          ₹{lakhVal} Lakh Group {grpId} (Month: {monthInfo.display})
                        </option>
                      );
                    })
                  : availableGroups.map((g) => (
                      <option key={g} value={g}>
                        Group {g}
                      </option>
                    ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">Billing Month</label>
              <select
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
              >
                {['August 2026', 'September 2026', 'October 2026', 'November 2026', 'December 2026'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">Due Date</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
              />
            </div>
          </div>

          {/* AMOUNT CALCULATION BOXES SECTION */}
          <div className="space-y-3 pt-3 border-t border-[#E5E5E1]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#1C1C1A] uppercase tracking-wider">
                Amount Calculation Boxes
              </span>
              <span className="text-[10px] font-mono text-[#2F5D50] bg-[#EDF7F0] px-2 py-0.5 rounded-full border border-[#2F5D50]/20 font-bold">
                Final = (Chit + Pending) - Balance
              </span>
            </div>

            <div className="space-y-3 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Chit Amount Box */}
                <div>
                  <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">
                    Chit Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 25000"
                    value={chitAmount}
                    onChange={(e) => setChitAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>

                {/* 2. Pending Amount Box */}
                <div>
                  <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">
                    Pending Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 0"
                    value={groupPendingAmount}
                    onChange={(e) => setGroupPendingAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>
              </div>

              {/* 3. Total Amount Box (Calculated: Chit + Pending) */}
              <div className="p-3 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-[#6B6B67] uppercase tracking-wider block">
                    Total Amount (Chit + Pending)
                  </span>
                  <span className="text-[11px] text-[#6B6B67] font-mono">
                    ₹{Number(chitAmount || 0).toLocaleString('en-IN')} + ₹{Number(groupPendingAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="text-base font-black font-mono text-[#1C1C1A]">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              {/* 4. Balance Amount Box (To Subtract) */}
              <div>
                <label className="text-[10px] font-bold text-[#C53030] uppercase tracking-wider block mb-1">
                  Balance Amount (₹) — To be Subtracted
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 0"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFF5F5] border border-[#F8B4B4] rounded-xl text-[#C53030] font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#C53030]"
                />
              </div>

              {/* 5. Final Amount Box (Calculated: Total - Balance) */}
              <div className="p-3.5 bg-[#EDF7F0] border border-[#2F5D50]/30 rounded-xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-[#2F5D50] uppercase tracking-wider block">
                    Final Payable Amount
                  </span>
                  <span className="text-[11px] text-[#2F5D50] font-mono">
                    ₹{totalAmount.toLocaleString('en-IN')} - ₹{Number(balanceAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="text-xl font-black font-mono text-[#2F5D50]">
                  ₹{finalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* RIGHT COLUMN: 2. MESSAGE COMPOSER & LIVE RECIPIENT PREVIEW */}
        <div className="space-y-6">
          <Card className="p-5 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-2">
              <h2 className="text-xs font-extrabold text-[#1C1C1A] uppercase tracking-wider">
                2. Message Composer
              </h2>

              <div className="flex items-center gap-1 bg-[#F7F7F5] p-1 rounded-xl text-[11px] font-bold">
                <button
                  onClick={() => setLanguage('english')}
                  className={`px-2 py-0.5 rounded-lg cursor-pointer ${language === 'english' ? 'bg-white text-[#2F5D50] shadow-xs' : 'text-[#6B6B67]'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('telugu')}
                  className={`px-2 py-0.5 rounded-lg cursor-pointer ${language === 'telugu' ? 'bg-white text-[#2F5D50] shadow-xs' : 'text-[#6B6B67]'}`}
                >
                  తెలుగు
                </button>
              </div>
            </div>

            {/* TEMPLATE SELECTOR */}
            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">Message Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl text-[#1C1C1A] font-bold focus:outline-none focus:ring-1 focus:ring-[#2F5D50] cursor-pointer"
              >
                {Object.values(MESSAGE_TEMPLATES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* TEXTAREA WITH CHAR COUNTER */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-[#6B6B67]">
                <span>EDITABLE MESSAGE CONTENT</span>
                <span className="font-mono">{charCount} characters</span>
              </div>
              <textarea
                rows={7}
                value={customTemplateText}
                onChange={(e) => setCustomTemplateText(e.target.value)}
                className="w-full p-3 text-xs font-mono bg-[#1C1C1A] text-[#EDF7F0] border border-[#E5E5E1] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#2F5D50] leading-relaxed"
              ></textarea>
            </div>
          </Card>

          {/* RECIPIENT PREVIEW & SEND BUTTON */}
          <Card className="p-5 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-2">
              <h2 className="text-xs font-extrabold text-[#1C1C1A] uppercase tracking-wider">
                3. Live Message Preview
              </h2>
              {selectedPreviewMember && (
                <Badge variant="info">{selectedPreviewMember.name}</Badge>
              )}
            </div>

            <div className="bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl p-4 font-sans text-xs leading-relaxed text-[#1C1C1A] whitespace-pre-wrap max-h-48 overflow-y-auto">
              {selectedPreviewMember
                ? getCompiledMessageForMember(selectedPreviewMember)
                : 'Select a member from the roster to preview message.'}
            </div>

            {/* LARGE PRIMARY ACTION BUTTON: SEND MESSAGE */}
            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center py-3.5 text-sm font-black bg-[#2F5D50] hover:bg-[#24493F] text-white rounded-xl shadow-xs gap-2 cursor-pointer"
              onClick={() => handleSendSingleMessage(selectedPreviewMember)}
              disabled={!selectedPreviewMember || isSendingSingle}
            >
              <Send className="w-4 h-4" />
              <span>{isSendingSingle ? 'Sending Message...' : `Send Message ${selectedPreviewMember ? `to ${selectedPreviewMember.name}` : ''}`}</span>
            </Button>
          </Card>
        </div>

      </div>

      {/* ─── MESSAGE HISTORY SECTION (DEDICATED 'messageHistory' COLLECTION) ────── */}
      <Card className="p-5 border border-[#E5E5E1] bg-white rounded-2xl shadow-xs space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E1]">
          <div>
            <h2 className="text-sm font-extrabold text-[#1C1C1A] uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-[#2F5D50]" />
              Firestore Message History & Audit Logs
            </h2>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Independent delivery records stored in <code className="bg-[#F7F7F5] px-1 py-0.5 rounded font-mono text-[#1C1C1A]">messageHistory</code> collection.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              className="rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-1.5 text-xs font-bold text-[#1C1C1A] focus:outline-none cursor-pointer"
            >
              <option value="all">All History Statuses</option>
              <option value="SENT">SENT</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="NOT_CONFIGURED">NOT_CONFIGURED</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs gap-1.5 border-[#E5E5E1] text-[#1C1C1A] hover:bg-[#F7F7F5] cursor-pointer font-bold"
              onClick={refreshHistoryLogs}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin text-[#2F5D50]' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* AUDIT LOG TABLE */}
        <div className="overflow-x-auto border border-[#E5E5E1] rounded-xl">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#F7F7F5] border-b border-[#E5E5E1] text-[10px] font-black uppercase tracking-wider text-[#6B6B67]">
              <tr>
                <th className="p-3">Recipient</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Group</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sent At</th>
                <th className="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E1]">
              {historyLogs.length > 0 ? (
                historyLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7F7F5]">
                    <td className="p-3 font-bold text-[#1C1C1A]">{log.recipientName || log.memberName || 'Member'}</td>
                    <td className="p-3 font-mono text-[#6B6B67]">+{log.phone}</td>
                    <td className="p-3 font-mono text-[10px] text-[#2F5D50] font-bold">{log.channel || 'WHATSAPP'}</td>
                    <td className="p-3 font-medium text-[#6B6B67]">Group {log.groupId || log.chitGroupId || 'I'}</td>
                    <td className="p-3">
                      {log.status === 'SENT' || log.status === 'Sent' ? (
                        <Badge variant="success">SENT ✓</Badge>
                      ) : log.status === 'NOT_CONFIGURED' ? (
                        <Badge variant="warning">NOT CONFIGURED</Badge>
                      ) : (
                        <Badge variant="error">{log.status || 'FAILED'}</Badge>
                      )}
                    </td>
                    <td className="p-3 text-[#6B6B67] font-mono text-[11px]">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailsLogModal(log)}
                        className="px-2.5 py-1 bg-[#F7F7F5] hover:bg-[#E5E5E1] text-[#1C1C1A] rounded-lg text-[11px] font-bold cursor-pointer border border-[#E5E5E1]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#6B6B67]">
                    No message history records found in `messageHistory` collection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── SCANNABLE QR CODE PAIRING MODAL ─────────────────────────────────────── */}
      {isQrModalOpen && (
        <Modal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          title="Link WhatsApp Account (Scan QR Code)"
        >
          <div className="space-y-4 font-sans text-xs text-center">
            <div className="p-4 bg-[#F7F7F5] border border-[#E5E5E1] rounded-2xl space-y-3">
              <h3 className="font-extrabold text-[#1C1C1A] text-sm">Scan QR Code with WhatsApp</h3>
              <p className="text-[#6B6B67] text-xs">
                Open WhatsApp on your phone ➔ <strong>Settings</strong> ➔ <strong>Linked Devices</strong> ➔ <strong>Link a Device</strong>.
              </p>

              {/* QR CODE DISPLAY CONTAINER */}
              <div className="p-4 bg-white border border-[#E5E5E1] rounded-xl w-64 h-64 mx-auto flex items-center justify-center shadow-xs relative">
                {qrGatewayState.status === 'DISCONNECTING' ? (
                  <div className="space-y-2 text-center text-[#6B6B67] p-2">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-red-500" />
                    <p className="font-bold text-xs text-[#1C1C1A]">Unlinking WhatsApp session...</p>
                    <p className="text-[10px] text-[#6B6B67]">Clearing device authentication cache</p>
                  </div>
                ) : qrFetchError ? (
                  <div className="space-y-3 text-center p-2">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="font-bold text-xs text-[#1C1C1A]">{qrFetchError}</p>
                    <p className="text-[10px] text-[#6B6B67]">Connection needs to be restarted.</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mx-auto cursor-pointer bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold text-xs"
                      onClick={handleGenerateNewQr}
                      disabled={isQrLoading}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isQrLoading ? 'animate-spin' : ''}`} /> Try Again
                    </Button>
                  </div>
                ) : qrGatewayState.connected || qrGatewayState.status === 'CONNECTED' ? (
                  <div className="space-y-2 text-center p-2">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                    <h4 className="font-black text-emerald-900 text-sm">WhatsApp Connected</h4>
                    <p className="text-xs text-emerald-700 font-bold">+{qrGatewayState.userPhone}</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                      Device Active & Ready
                    </span>
                  </div>
                ) : (qrGatewayState.status === 'QR_READY' || qrGatewayState.qrCodeDataUrl) && qrGatewayState.qrCodeDataUrl ? (
                  <div className="flex flex-col items-center justify-center h-full w-full">
                    <img
                      src={qrGatewayState.qrCodeDataUrl}
                      alt="WhatsApp Pairing QR Code"
                      className="w-52 h-52 object-contain rounded-lg border border-slate-100"
                    />
                  </div>
                ) : qrGatewayState.status === 'INITIALIZING' || qrGatewayState.status === 'RECONNECTING' || isQrLoading ? (
                  <div className="space-y-2 text-center text-[#6B6B67] p-2">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#2F5D50]" />
                    <p className="font-bold text-xs text-[#1C1C1A]">Generating fresh QR code...</p>
                    <p className="text-[10px] text-[#6B6B67]">Starting clean Baileys session</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-center text-[#6B6B67] p-2">
                    <Smartphone className="w-8 h-8 mx-auto text-[#2F5D50]" />
                    <p className="font-bold text-xs text-[#1C1C1A]">Ready to connect</p>
                    <p className="text-[10px] text-[#6B6B67]">Click below to generate a new QR code</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mx-auto cursor-pointer bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold text-xs"
                      onClick={handleGenerateNewQr}
                      disabled={isQrLoading}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isQrLoading ? 'animate-spin' : ''}`} /> Generate New QR
                    </Button>
                  </div>
                )}
              </div>

              {!qrGatewayState.connected && qrGatewayState.status !== 'CONNECTED' && qrGatewayState.status !== 'DISCONNECTING' && !qrFetchError && qrGatewayState.qrCodeDataUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-[#2F5D50]">
                    <Smartphone className="w-4 h-4" />
                    <span>Waiting for phone scan... (Auto-connects)</span>
                  </div>
                  <button
                    onClick={handleGenerateNewQr}
                    className="text-[11px] text-[#2F5D50] hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
                    disabled={isQrLoading}
                  >
                    <RefreshCw className={`w-3 h-3 ${isQrLoading ? 'animate-spin' : ''}`} />
                    Refresh QR Code
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <div>
                {qrGatewayState.connected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold"
                    onClick={handleDisconnectDevice}
                    disabled={isQrLoading}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsQrModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── CONFIRMATION MODAL BEFORE SENDING ─────────────────────────────────── */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Message Dispatch"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-4 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#6B6B67] font-bold">Total Recipients:</span>
                <span className="font-extrabold text-[#1C1C1A] text-sm">{selectedCount} Members</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B67] font-bold">Selected Chit Group:</span>
                <span className="font-bold text-[#1C1C1A]">Group {selectedGroupId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B67] font-bold">Billing Month:</span>
                <span className="font-bold text-[#1C1C1A]">{billingMonth}</span>
              </div>
            </div>

            <p className="text-[#6B6B67]">
              You are about to send <strong className="text-[#1C1C1A]">{selectedCount}</strong> personalized messages via your linked WhatsApp device.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5E1]">
              <Button variant="outline" size="sm" onClick={() => setIsConfirmModalOpen(false)}>
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                className="bg-[#2F5D50] hover:bg-[#24493F] text-white font-bold"
                onClick={handleExecuteBulkSend}
              >
                Confirm Send ({selectedCount} Messages)
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── BATCH SUMMARY MODAL ───────────────────────────────────────────────── */}
      {bulkSummaryModal && (
        <Modal
          isOpen={Boolean(bulkSummaryModal)}
          onClose={() => setBulkSummaryModal(null)}
          title="Messaging Complete"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-4 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl space-y-2 text-center">
              <h3 className="text-base font-black text-[#1C1C1A]">Dispatch Summary</h3>
              <div className="grid grid-cols-2 gap-3 pt-2 font-mono">
                <div className="p-3 bg-[#EDF7F0] border border-[#2F5D50]/20 rounded-xl">
                  <span className="text-[10px] font-bold text-[#2F6B4F] uppercase block">Sent</span>
                  <span className="text-lg font-black text-[#2F6B4F]">{bulkSummaryModal.sentCount}</span>
                </div>
                <div className="p-3 bg-[#FFF7E6] border border-[#B86B14]/20 rounded-xl">
                  <span className="text-[10px] font-bold text-[#B86B14] uppercase block">Failed / Queued</span>
                  <span className="text-lg font-black text-[#B86B14]">{bulkSummaryModal.failedCount}</span>
                </div>
              </div>
            </div>

            <p className="text-[#6B6B67] text-center">
              All {bulkSummaryModal.total} message jobs have been logged to the <code className="bg-[#F7F7F5] px-1 py-0.5 rounded font-mono text-[#1C1C1A]">messageHistory</code> collection.
            </p>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setBulkSummaryModal(null)}>
                Close Summary
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── AUDIT LOG DETAILS MODAL ─────────────────────────────────────────────────── */}
      {detailsLogModal && (
        <Modal
          isOpen={Boolean(detailsLogModal)}
          onClose={() => setDetailsLogModal(null)}
          title="Message Audit Record Details"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-4 bg-[#F7F7F5] border border-[#E5E5E1] rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-[#6B6B67] font-semibold">Recipient:</span>
                <span className="font-bold text-[#1C1C1A]">{detailsLogModal.recipientName || detailsLogModal.memberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B67] font-semibold">Phone:</span>
                <span className="font-bold font-mono text-[#1C1C1A]">+{detailsLogModal.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B67] font-semibold">Channel:</span>
                <span className="font-bold font-mono text-[#2F5D50]">{detailsLogModal.channel || 'WHATSAPP'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B67] font-semibold">Status:</span>
                <span className="font-bold text-[#1C1C1A]">{detailsLogModal.status || 'SENT'}</span>
              </div>
              {detailsLogModal.errorMessage && (
                <div className="pt-2 border-t border-[#E5E5E1] text-[#C53030]">
                  <span className="font-bold block mb-0.5">Error Message:</span>
                  <p className="bg-[#FCEEEE] p-2 rounded-lg font-mono text-[11px]">{detailsLogModal.errorMessage}</p>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">Message Content</span>
              <div className="p-3 bg-[#1C1C1A] text-[#EDF7F0] rounded-xl font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                {detailsLogModal.message || 'No message content stored.'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setDetailsLogModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
