import dotenv from 'dotenv';

dotenv.config();

export const ADMIN_CONTACT_NUMBER = process.env.ADMIN_CONTACT_NUMBER || '9705184411';

export function getSmsConfig() {
  const smsApiKey = process.env.SMS_API_KEY || '';
  const smsApiSecret = process.env.SMS_API_SECRET || '';
  const smsSenderId = process.env.SMS_SENDER_ID || '';
  const smsProviderUrl = process.env.SMS_PROVIDER_URL || '';

  return {
    adminNumber: ADMIN_CONTACT_NUMBER,
    isConfigured: Boolean(smsApiKey && smsApiSecret && smsSenderId && smsProviderUrl),
    apiKeyConfigured: Boolean(smsApiKey),
    apiSecretConfigured: Boolean(smsApiSecret),
    senderIdConfigured: Boolean(smsSenderId),
    providerUrlConfigured: Boolean(smsProviderUrl),
  };
}

function normalizePhone(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }

  if (digits.startsWith('91')) {
    return digits;
  }

  return `91${digits}`;
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function getActiveChits(member) {
  return (member?.chits || []).filter((chit) => (chit.status ? chit.status === 'ACTIVE' : true));
}

function buildSingleMemberSms(member, language = 'english', messageType = 'payment_reminder') {
  const activeChits = getActiveChits(member);
  const chit = activeChits[0] || {};
  const dueDate = chit.dueDate || '15 August 2026';
  const monthlyDue = Number(chit.amountToPay || 0);
  const pendingAmount = Number(chit.balanceAmount || Number(chit.amountToPay || 0));
  const chitValue = Number(chit.totalChitValue || 0);

  const english = `Dear ${member.name},\n\nYour ${formatCurrency(monthlyDue)} chitt payment is due on ${dueDate}.\n\nPending Amount: ${formatCurrency(pendingAmount)}\n\nPlease make the payment on time.\n\nRaghavendra Chitts\nContact: ${ADMIN_CONTACT_NUMBER}`;

  const telugu = `ప్రియమైన ${member.name},\n\nమీ ${formatCurrency(monthlyDue)} చిట్టీ చెల్లింపు ${dueDate}న చెల్లించాల్సి ఉంది.\n\nబాకీ మొత్తం: ${formatCurrency(pendingAmount)}\n\nదయచేసి మీ చెల్లింపును సమయానికే చేయండి.\n\nరాఘవేంద్ర చిట్స్\nసంప్రదించండి: ${ADMIN_CONTACT_NUMBER}`;

  if (language === 'telugu') return telugu;
  if (language === 'english+telugu') return `${english}\n\n---\n\n${telugu}`;
  return english;
}

function buildMultipleMemberSms(member, language = 'english', messageType = 'payment_reminder') {
  const activeChits = getActiveChits(member);
  const totalDue = activeChits.reduce((sum, chit) => sum + Number(chit.amountToPay || 0), 0);

  const details = activeChits.map((chit, index) => {
    const due = Number(chit.amountToPay || 0);
    const pending = Number(chit.balanceAmount || 0);
    const value = Number(chit.totalChitValue || 0);
    return `${index + 1}. ₹${value.toLocaleString('en-IN')} Chit\nMonthly Due: ₹${due.toLocaleString('en-IN')}\nPending: ₹${pending.toLocaleString('en-IN')}`;
  }).join('\n\n');

  const english = `Dear ${member.name},\n\nYour chitt payment details:\n\n${details}\n\nTotal Due: ${formatCurrency(totalDue)}\n\nPlease make the payment on time.\n\nRaghavendra Chitts\n${ADMIN_CONTACT_NUMBER}`;

  const telugu = `ప్రియమైన ${member.name},\n\nమీ చిట్టీ చెల్లింపు వివరాలు:\n\n${details.replace(/Chit/g, 'చిట్టీ')}\n\nమొత్తం చెల్లాల్సినది: ${formatCurrency(totalDue)}\n\nదయచేసి మీ చెల్లింపును సమయానికే చేయండి.\n\nరాఘవేంద్ర చిట్స్\n${ADMIN_CONTACT_NUMBER}`;

  if (language === 'telugu') return telugu;
  if (language === 'english+telugu') return `${english}\n\n---\n\n${telugu}`;
  return english;
}

export function buildSmsMessage(member, language = 'english', messageType = 'payment_reminder') {
  const activeChits = getActiveChits(member);

  if (!activeChits.length) {
    return `Dear ${member.name},\n\nYour chitt payment is due soon.\n\nPlease contact Raghavendra Chitts for payment details.\n\nRaghavendra Chitts\nContact: ${ADMIN_CONTACT_NUMBER}`;
  }

  if (activeChits.length === 1) {
    return buildSingleMemberSms(member, language, messageType);
  }

  return buildMultipleMemberSms(member, language, messageType);
}

export async function sendSMS({ to, message, memberName, language = 'english', messageType = 'payment_reminder' }) {
  const config = getSmsConfig();

  if (!config.isConfigured) {
    return {
      status: 'not_configured',
      phoneNumber: to,
      memberName,
      error: 'SMS service is not configured yet.',
      providerMessageId: null,
    };
  }

  try {
    const response = await fetch(config.providerUrlConfigured ? process.env.SMS_PROVIDER_URL : 'https://example.invalid', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${process.env.SMS_API_KEY}:${process.env.SMS_API_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        to,
        message,
        sender: process.env.SMS_SENDER_ID,
        type: messageType,
        language,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      return {
        status: 'failed',
        phoneNumber: to,
        memberName,
        error: errorPayload || 'SMS provider rejected the request.',
        providerMessageId: null,
      };
    }

    const payload = await response.json();
    return {
      status: 'sent',
      phoneNumber: to,
      memberName,
      error: '',
      providerMessageId: payload?.messageId || payload?.id || null,
    };
  } catch (error) {
    return {
      status: 'failed',
      phoneNumber: to,
      memberName,
      error: error.message || 'Unable to send SMS.',
      providerMessageId: null,
    };
  }
}

export async function sendBulkSMS({ members = [], language = 'english', messageType = 'payment_reminder' }) {
  const config = getSmsConfig();

  if (!config.isConfigured) {
    return {
      status: 'not_configured',
      totalCount: members.length,
      sentCount: 0,
      failedCount: members.length,
      results: members.map((member) => ({
        memberId: member.id,
        memberName: member.name,
        phoneNumber: member.whatsapp || member.phone || 'Not Available',
        status: 'failed',
        error: 'SMS service is not configured yet.',
        sentAt: null,
      })),
      adminNumber: ADMIN_CONTACT_NUMBER,
    };
  }

  const results = [];
  let sentCount = 0;

  for (const member of members) {
    const recipient = normalizePhone(member.whatsapp || member.phone || '');
    if (!recipient) {
      results.push({
        memberId: member.id,
        memberName: member.name,
        phoneNumber: member.whatsapp || member.phone || 'Not Available',
        status: 'failed',
        error: 'Invalid mobile number for SMS delivery.',
        sentAt: null,
      });
      continue;
    }

    const message = buildSmsMessage(member, language, messageType);
    const outcome = await sendSMS({
      to: recipient,
      message,
      memberName: member.name,
      language,
      messageType,
    });

    const result = {
      memberId: member.id,
      memberName: member.name,
      phoneNumber: recipient,
      status: outcome.status === 'sent' ? 'sent' : 'failed',
      error: outcome.error || '',
      sentAt: outcome.status === 'sent' ? new Date().toISOString() : null,
    };

    results.push(result);
    if (outcome.status === 'sent') sentCount += 1;
  }

  return {
    status: results.some((item) => item.status === 'failed') ? 'partial' : 'success',
    totalCount: results.length,
    sentCount,
    failedCount: results.filter((item) => item.status === 'failed').length,
    results,
    adminNumber: ADMIN_CONTACT_NUMBER,
  };
}
