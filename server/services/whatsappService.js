import dotenv from 'dotenv';

dotenv.config();

export const ADMIN_WHATSAPP_NUMBER = '9705184411';

function normalizePhoneNumber(value) {
  if (!value) return '';

  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }

  if (digits.startsWith('91')) {
    return digits;
  }

  return `91${digits}`;
}

export function getWhatsAppConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

  const isValidToken = Boolean(accessToken && !accessToken.includes('YOUR_WHATSAPP_ACCESS_TOKEN_HERE'));
  const isValidPhoneId = Boolean(phoneNumberId && !phoneNumberId.includes('YOUR_PHONE_NUMBER_ID_HERE'));
  const isConfigured = isValidToken && isValidPhoneId;

  return {
    adminNumber: ADMIN_WHATSAPP_NUMBER,
    isConfigured,
    accessToken: isValidToken ? 'configured' : 'missing',
    phoneNumberId: isValidPhoneId ? 'configured' : 'missing',
    businessAccountId: businessAccountId ? 'configured' : 'missing',
  };
}

function getLanguageCode(language = 'english') {
  if (language === 'telugu') return 'te';
  if (language === 'english') return 'en';
  return 'en';
}

function buildSingleChitMessage(member, chit, language = 'english', dueDate = '15 August') {
  const total = Number(chit.amountToPay ?? 0);
  const chitAmount = Number(chit.totalChitValue ?? 0);

  const template = {
    english: `Dear ${member.name},\n\nYour Raghavendra Chitts monthly payment of ₹${total.toLocaleString('en-IN')}\nfor your ₹${chitAmount.toLocaleString('en-IN')} chit is due on ${dueDate}.\n\nPlease complete your payment on time.\n\nThank you,\nRaghavendra Chitts`,
    telugu: `ప్రియమైన ${member.name},\n\nమీ రాఘవేంద్ర చిట్స్ నెలవారీ చెల్లింపు ₹${total.toLocaleString('en-IN')}\n${chitAmount.toLocaleString('en-IN')} చిట్టీ కోసం ${dueDate}న చెల్లించాల్సి ఉంది.\n\nదయచేసి మీ చెల్లింపును సమయానికే పూర్తి చేయండి.\n\nధన్యవాదములు,\nరాఘవేంద్ర చిట్స్`,
    bilingual: `Dear ${member.name},\n\nYour Raghavendra Chitts monthly payment of ₹${total.toLocaleString('en-IN')}\nfor your ₹${chitAmount.toLocaleString('en-IN')} chit is due on ${dueDate}.\n\nPlease complete your payment on time.\n\nThank you,\nRaghavendra Chitts\n\n-------------------\n\nప్రియమైన ${member.name},\n\nమీ రాఘవేంద్ర చిట్స్ నెలవారీ చెల్లింపు ₹${total.toLocaleString('en-IN')}\n${chitAmount.toLocaleString('en-IN')} చిట్టీ కోసం ${dueDate}న చెల్లించాల్సి ఉంది.\n\nదయచేసి మీ చెల్లింపును సమయానికే పూర్తి చేయండి.\n\nధన్యవాదములు,\nరాఘవేంద్ర చిట్స్`
  };

  return template[language] || template.english;
}

function buildMultipleChitMessage(member, activeChits, language = 'english', dueDate = '15 August') {
  const totalDue = activeChits.reduce((sum, chit) => sum + Number(chit.amountToPay ?? 0), 0);
  const lines = activeChits.map((chit, index) => {
    const amount = Number(chit.amountToPay ?? 0);
    const balance = Number(chit.balanceAmount ?? 0);
    const chitValue = Number(chit.totalChitValue ?? 0);

    return `${index + 1}. ₹${chitValue.toLocaleString('en-IN')} Chit\nMonthly Due: ₹${amount.toLocaleString('en-IN')}\nBalance: ₹${balance.toLocaleString('en-IN')}`;
  }).join('\n\n');

  const template = {
    english: `Dear ${member.name},\n\nYour Raghavendra Chitts payment details:\n\n${lines}\n\nTotal Due: ₹${totalDue.toLocaleString('en-IN')}\n\nPlease complete your payment on time.\n\nThank you,\nRaghavendra Chitts`,
    telugu: `ప్రియమైన ${member.name},\n\nమీ రాఘవేంద్ర చిట్స్ చెల్లింపు వివరాలు:\n\n${lines.replace(/₹/g, '₹').replace(/Chit/g, 'చిట్టీ')}\n\nమొత్తం చెల్లాల్సినది: ₹${totalDue.toLocaleString('en-IN')}\n\nదయచేసి మీ చెల్లింపును సమయానికే పూర్తి చేయండి.\n\nధన్యవాదములు,\nరాఘవేంద్ర చిట్స్`,
    bilingual: `Dear ${member.name},\n\nYour Raghavendra Chitts payment details:\n\n${lines}\n\nTotal Due: ₹${totalDue.toLocaleString('en-IN')}\n\nPlease complete your payment on time.\n\nThank you,\nRaghavendra Chitts\n\n-------------------\n\nప్రియమైన ${member.name},\n\nమీ రాఘవేంద్ర చిట్స్ చెల్లింపు వివరాలు:\n\n${lines.replace(/₹/g, '₹').replace(/Chit/g, 'చిట్టీ')}\n\nమొత్తం చెల్లాల్సినది: ₹${totalDue.toLocaleString('en-IN')}\n\nదయచేసి మీ చెల్లింపును సమయానికే పూర్తి చేయండి.\n\nధన్యవాదములు,\nరాఘవేంద్ర చిట్స్`
  };

  return template[language] || template.english;
}

export function buildMemberMessage(member, language = 'english+telugu') {
  const activeChits = (member.chits || []).filter((chit) => (chit.status ? chit.status === 'ACTIVE' : true));

  const selectedLanguage = language.toLowerCase();
  const normalized = selectedLanguage.includes('telugu') && selectedLanguage.includes('english') ? 'bilingual' : selectedLanguage.includes('telugu') ? 'telugu' : 'english';

  if (activeChits.length === 0) {
    return buildSingleChitMessage(member, { amountToPay: 0, totalChitValue: 0 }, normalized);
  }

  if (activeChits.length === 1) {
    return buildSingleChitMessage(member, activeChits[0], normalized);
  }

  return buildMultipleChitMessage(member, activeChits, normalized);
}

export async function sendWhatsAppMessage({ to, message, language = 'english' }) {
  const config = getWhatsAppConfig();

  if (!config.isConfigured) {
    return {
      status: 'not_configured',
      message: 'WhatsApp API is not configured. Add WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_BUSINESS_ACCOUNT_ID to the backend environment first.',
      adminNumber: ADMIN_WHATSAPP_NUMBER,
    };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: message,
      },
      preview_url: false,
      ...(language === 'telugu' ? { template: { name: 'hello_world', language: { code: 'en_US' } } } : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      status: 'failed',
      reason: data?.error?.message || 'WhatsApp message failed to send.',
      phoneNumber: to,
    };
  }

  return {
    status: 'sent',
    messageId: data?.messages?.[0]?.id || null,
    phoneNumber: to,
  };
}

export async function sendWhatsAppBroadcast({ members = [], language = 'english+telugu', target = 'all' }) {
  const config = getWhatsAppConfig();

  if (!config.isConfigured) {
    return {
      status: 'not_configured',
      title: 'WhatsApp API not configured',
      sentCount: 0,
      failedCount: members.length,
      totalCount: members.length,
      results: (members || []).map((member) => ({
        memberId: member.id,
        memberName: member.name,
        phoneNumber: member.whatsapp || member.phone || 'Not Available',
        status: 'failed',
        error: 'WhatsApp API is not configured. Add the required backend environment variables first.',
      })),
      adminNumber: ADMIN_WHATSAPP_NUMBER,
      config,
      target,
      language,
    };
  }

  const results = [];
  let sentCount = 0;

  for (const member of members) {
    const recipient = normalizePhoneNumber(member.whatsapp || member.phone || '');
    if (!recipient) {
      results.push({
        memberId: member.id,
        memberName: member.name,
        phoneNumber: member.whatsapp || member.phone || 'Not Available',
        status: 'failed',
        error: 'Missing or invalid WhatsApp number.',
      });
      continue;
    }

    const message = buildMemberMessage(member, language);
    const outcome = await sendWhatsAppMessage({ to: recipient, message, language });

    const result = {
      memberId: member.id,
      memberName: member.name,
      phoneNumber: recipient,
      status: outcome.status === 'sent' ? 'sent' : 'failed',
      error: outcome.reason || '',
      sentAt: outcome.status === 'sent' ? new Date().toISOString() : null,
    };

    results.push(result);
    if (outcome.status === 'sent') sentCount += 1;
  }

  const failedCount = results.filter((result) => result.status === 'failed').length;

  return {
    status: failedCount === 0 ? 'success' : 'partial',
    sentCount,
    failedCount,
    totalCount: results.length,
    results,
    adminNumber: ADMIN_WHATSAPP_NUMBER,
    target,
    language,
  };
}

export async function sendSingleWhatsAppMessage({ member, recipient, message, language = 'english+telugu' }) {
  const config = getWhatsAppConfig();
  const cleanRecipient = normalizePhoneNumber(recipient || member?.whatsapp || member?.phone || '');

  if (!cleanRecipient) {
    return {
      success: false,
      status: 'INVALID_NUMBER',
      message: 'Invalid or missing recipient WhatsApp number.',
      recipient: recipient || '',
    };
  }

  if (!config.isConfigured) {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      message: 'WhatsApp Business API credentials (WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID) are missing from the server environment.',
      recipient: cleanRecipient,
      memberName: member?.name || 'Member',
      adminNumber: ADMIN_WHATSAPP_NUMBER,
    };
  }

  const messageContent = message || (member ? buildMemberMessage(member, language) : '');
  const outcome = await sendWhatsAppMessage({ to: cleanRecipient, message: messageContent, language });

  if (outcome.status === 'sent') {
    return {
      success: true,
      status: 'SENT',
      recipient: cleanRecipient,
      memberName: member?.name || 'Member',
      providerMessageId: outcome.messageId,
      messageId: outcome.messageId,
      message: 'WhatsApp message sent successfully.',
    };
  }

  return {
    success: false,
    status: 'FAILED',
    message: outcome.reason || 'Failed to deliver message via WhatsApp Business API.',
    recipient: cleanRecipient,
    memberName: member?.name || 'Member',
  };
}

