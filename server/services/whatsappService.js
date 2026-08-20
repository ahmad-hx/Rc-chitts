import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from both server/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
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

export async function verifyMetaConnection() {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || '').trim();
  const businessAccountId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.META_BUSINESS_ACCOUNT_ID || '').trim();
  const rawPhoneNumber = (process.env.WHATSAPP_BUSINESS_PHONE || ADMIN_WHATSAPP_NUMBER || '').trim();

  const isPlaceholderToken = !accessToken ||
    accessToken.startsWith('YOUR_') ||
    accessToken.includes('HERE') ||
    accessToken.includes('PLACEHOLDER') ||
    accessToken.length < 15;

  const isPlaceholderPhoneId = !phoneNumberId ||
    phoneNumberId.startsWith('YOUR_') ||
    phoneNumberId.includes('HERE') ||
    phoneNumberId.includes('PLACEHOLDER') ||
    !/^\d+$/.test(phoneNumberId);

  const missing = [];
  if (isPlaceholderToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (isPlaceholderPhoneId) missing.push('WHATSAPP_PHONE_NUMBER_ID');

  if (missing.length > 0) {
    return {
      adminNumber: ADMIN_WHATSAPP_NUMBER,
      businessPhoneNumber: rawPhoneNumber,
      phoneNumberIdDisplay: isPlaceholderPhoneId ? 'Not Configured (Missing ID)' : 'Configured ✓',
      businessAccountIdDisplay: businessAccountId && !businessAccountId.startsWith('YOUR_') ? 'Configured ✓' : 'Not Configured',
      configured: false,
      isConfigured: false,
      connected: false,
      missing,
      provider: 'META_CLOUD_API',
      status: 'NOT_CONFIGURED',
      statusText: '🔴 Gateway Not Configured',
      statusReason: `Meta WhatsApp credentials (${missing.join(', ')}) need to be configured on the server.`,
      lastChecked: new Date().toISOString(),
      recommendedEngine: 'Meta Official Cloud API',
      accessToken: !isPlaceholderToken ? 'configured' : 'missing',
      phoneNumberId: !isPlaceholderPhoneId ? 'configured' : 'missing',
      businessAccountId: businessAccountId && !businessAccountId.startsWith('YOUR_') ? 'configured' : 'missing',
    };
  }


  // Perform REAL API connection check to Meta Graph API
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}?fields=id,verified_name,display_phone_number`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await metaRes.json();

    if (metaRes.ok && data?.id) {
      return {
        adminNumber: ADMIN_WHATSAPP_NUMBER,
        businessPhoneNumber: data.display_phone_number || rawPhoneNumber,
        phoneNumberIdDisplay: 'Configured ✓',
        businessAccountIdDisplay: businessAccountId ? 'Configured ✓' : 'Configured ✓ (Via Meta WABA)',
        isConfigured: true,
        connected: true,
        status: 'CONNECTED',
        statusText: '🟢 Gateway Connected',
        verifiedName: data.verified_name || 'Raghavendra Chitts Official',
        statusReason: 'Real Meta WhatsApp Business Cloud API connection verified successfully.',
        lastChecked: new Date().toISOString(),
        recommendedEngine: 'Meta Official Cloud API',
        accessToken: 'configured',
        phoneNumberId: 'configured',
        businessAccountId: 'configured',
      };
    }

    return {
      adminNumber: ADMIN_WHATSAPP_NUMBER,
      businessPhoneNumber: rawPhoneNumber,
      phoneNumberIdDisplay: 'Configured (Invalid)',
      businessAccountIdDisplay: businessAccountId ? 'Configured (Invalid)' : 'Not Configured',
      isConfigured: true,
      connected: false,
      status: 'CONFIG_ERROR',
      statusText: '🟠 Gateway Configuration Error',
      statusReason: data?.error?.message || `Meta API verification rejected token or phone number ID (HTTP ${metaRes.status}).`,
      lastChecked: new Date().toISOString(),
      recommendedEngine: 'Meta Official Cloud API',
      accessToken: 'invalid',
      phoneNumberId: 'configured',
      businessAccountId: 'missing',
    };
  } catch (err) {
    return {
      adminNumber: ADMIN_WHATSAPP_NUMBER,
      businessPhoneNumber: rawPhoneNumber,
      phoneNumberIdDisplay: 'Configured',
      businessAccountIdDisplay: 'Configured',
      isConfigured: true,
      connected: false,
      status: 'CONFIG_ERROR',
      statusText: '🟠 Network Error',
      statusReason: `Could not reach Meta Graph API server: ${err.message}`,
      lastChecked: new Date().toISOString(),
      recommendedEngine: 'Meta Official Cloud API',
      accessToken: 'configured',
      phoneNumberId: 'configured',
      businessAccountId: 'configured',
    };
  }
}

export function getWhatsAppConfig() {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || '').trim();
  const businessAccountId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.META_BUSINESS_ACCOUNT_ID || '').trim();
  const rawPhoneNumber = (process.env.WHATSAPP_BUSINESS_PHONE || ADMIN_WHATSAPP_NUMBER || '').trim();

  const isPlaceholderToken = !accessToken ||
    accessToken.startsWith('YOUR_') ||
    accessToken.includes('HERE') ||
    accessToken.includes('PLACEHOLDER') ||
    accessToken.length < 15;

  const isPlaceholderPhoneId = !phoneNumberId ||
    phoneNumberId.startsWith('YOUR_') ||
    phoneNumberId.includes('HERE') ||
    phoneNumberId.includes('PLACEHOLDER') ||
    !/^\d+$/.test(phoneNumberId);

  const isConfigured = !isPlaceholderToken && !isPlaceholderPhoneId;

  return {
    adminNumber: ADMIN_WHATSAPP_NUMBER,
    businessPhoneNumber: rawPhoneNumber,
    phoneNumberIdDisplay: !isPlaceholderPhoneId ? 'Configured ✓' : 'Not Configured (Missing ID)',
    businessAccountIdDisplay: businessAccountId && !businessAccountId.startsWith('YOUR_') ? 'Configured ✓' : 'Not Configured',
    isConfigured,
    connected: false, // Default until verifyMetaConnection is executed
    status: isConfigured ? 'UNVERIFIED' : 'NOT_CONFIGURED',
    statusText: isConfigured ? '🟠 Unverified Connection' : '🔴 Gateway Disconnected',
    lastChecked: new Date().toISOString(),
    recommendedEngine: 'Meta Official Cloud API',
    accessToken: !isPlaceholderToken ? 'configured' : 'missing',
    phoneNumberId: !isPlaceholderPhoneId ? 'configured' : 'missing',
    businessAccountId: businessAccountId && !businessAccountId.startsWith('YOUR_') ? 'configured' : 'missing',
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

export const MetaCloudProvider = {
  name: 'Meta Official Cloud API',
  async sendMessage({ to, message, language = 'english' }) {
    const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || '').trim();
    const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();

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
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        status: 'failed',
        reason: data?.error?.message || 'Meta WhatsApp Cloud API request rejected.',
        phoneNumber: to,
      };
    }

    return {
      status: 'sent',
      messageId: data?.messages?.[0]?.id || null,
      phoneNumber: to,
    };
  },
};

export const TwilioProvider = {
  name: 'Twilio API for WhatsApp',
  async sendMessage({ to, message }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return {
        status: 'failed',
        reason: 'Twilio credentials (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN) are missing from server environment.',
        phoneNumber: to,
      };
    }
    return {
      status: 'failed',
      reason: 'Twilio API provider adapter is ready for optional configuration.',
      phoneNumber: to,
    };
  },
};

export async function sendWhatsAppMessage({ to, message, language = 'english', provider = 'meta_cloud_api' }) {
  const config = getWhatsAppConfig();

  if (!config.isConfigured) {
    return {
      status: 'not_configured',
      message: 'WhatsApp API is not configured. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to server/.env.',
      adminNumber: ADMIN_WHATSAPP_NUMBER,
    };
  }

  const selectedProvider = provider === 'twilio' ? TwilioProvider : MetaCloudProvider;
  const outcome = await selectedProvider.sendMessage({ to, message, language });
  return outcome;
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

export async function sendTestWhatsAppMessage({ recipient, message }) {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID || '').trim();

  const cleanRecipient = normalizePhoneNumber(recipient || '');

  if (!cleanRecipient) {
    return {
      success: false,
      status: 'INVALID_NUMBER',
      message: 'The recipient phone number is invalid. Enter a valid mobile number (e.g. 9876543210).',
    };
  }

  const isPlaceholderToken = !accessToken || accessToken.startsWith('YOUR_') || accessToken.includes('HERE') || accessToken.length < 15;
  const isPlaceholderPhoneId = !phoneNumberId || phoneNumberId.startsWith('YOUR_') || !/^\d+$/.test(phoneNumberId);

  const missing = [];
  if (isPlaceholderToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (isPlaceholderPhoneId) missing.push('WHATSAPP_PHONE_NUMBER_ID');

  if (missing.length > 0) {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      missing,
      message: `Meta WhatsApp credentials (${missing.join(', ')}) are not configured in server/.env.`,
      recipient: cleanRecipient,
    };
  }

  const testMessage = message && message.trim()
    ? message.trim()
    : 'Hello from Raghavendra Chitts. This is a live test WhatsApp message from Meta Official Cloud API.';

  const outcome = await sendWhatsAppMessage({ to: cleanRecipient, message: testMessage, language: 'english' });

  if (outcome.status === 'sent') {
    return {
      success: true,
      status: 'SENT',
      recipient: cleanRecipient,
      messageId: outcome.messageId,
      message: `Test WhatsApp message submitted successfully to +${cleanRecipient}.`,
    };
  }

  return {
    success: false,
    status: 'FAILED',
    recipient: cleanRecipient,
    message: outcome.reason || 'Meta WhatsApp could not accept the message.',
  };
}



