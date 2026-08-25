/**
 * Raghavendra Chitts — WhatsApp Service (Backend / Cloud Function API Integration)
 *
 * Flow:
 *   Frontend call (sendSingleWhatsAppMessage)
 *     ➔ Firebase Callable Cloud Function (sendWhatsAppMessage) OR Express local endpoint (/api/whatsapp/send)
 *     ➔ Backend Provider / Meta API call
 *     ➔ Accurate Status ('SENT', 'FAILED', 'NOT_CONFIGURED')
 *
 * No window.open, NO wa.me links, NO fake SENT statuses.
 */

import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../firebase';

export const ADMIN_WHATSAPP_NUMBER = '9705184411';
export const ADMIN_CONTACT_NUMBER = ADMIN_WHATSAPP_NUMBER;

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const WHATSAPP_API_BASE_URL =
  import.meta.env.VITE_WHATSAPP_API_URL ||
  (isLocalhost
    ? ''
    : 'https://raghavendra-chitts-whatsapp.onrender.com');

export function getWhatsAppApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${WHATSAPP_API_BASE_URL}${cleanPath}`;
}

export const WA_STATUS = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  INVALID_NUMBER: 'INVALID_NUMBER',
};

export function normalizeWhatsAppNumber(phone) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, '');
  if (!clean) return null;
  if (clean.length === 10) return `91${clean}`;
  if (clean.length === 12 && clean.startsWith('91')) return clean;
  if (clean.length === 11 && clean.startsWith('0')) return `91${clean.slice(1)}`;
  if (clean.length >= 10 && clean.length <= 15) return clean;
  return null;
}

/**
 * Dispatch single WhatsApp message through Firebase Cloud Function / Express backend.
 * NO window.open, NO wa.me links, NO fake SENT statuses.
 */
export async function sendSingleWhatsAppMessage({ member, recipient, message, language = 'english' }) {
  const targetPhone = recipient || member?.whatsapp || member?.phone || '';
  const norm = normalizeWhatsAppNumber(targetPhone);
  const memberName = member?.name || 'Member';

  if (!norm) {
    return {
      success: false,
      status: WA_STATUS.INVALID_NUMBER,
      message: `Member "${memberName}" does not have a valid WhatsApp phone number.`,
      recipient: targetPhone,
      memberName,
    };
  }

  if (!message || !String(message).trim()) {
    return {
      success: false,
      status: WA_STATUS.FAILED,
      message: 'Please enter message content before sending.',
      recipient: norm,
      memberName,
    };
  }

  // 1. Try Firebase Callable Function if user logged in
  if (auth.currentUser) {
    try {
      const callable = httpsCallable(functions, 'sendWhatsAppMessage', { timeout: 15000 });
      const res = await callable({
        recipient: norm,
        member,
        memberName,
        message,
        language,
      });

      if (res?.data) {
        return {
          success: res.data.success || res.data.status === 'SENT',
          status: res.data.status || (res.data.success ? 'SENT' : 'FAILED'),
          message: res.data.message || (res.data.success ? 'Message sent successfully.' : 'Backend call failed.'),
          providerMessageId: res.data.providerMessageId || res.data.messageId || null,
          recipient: norm,
          memberName,
        };
      }
    } catch (_) {
      // Fall through to Express backend API
    }
  }

  // 2. Try Express backend API endpoint (/api/whatsapp/send)
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch (_) {}
    }

    const response = await fetch(getWhatsAppApiUrl('/api/whatsapp/send'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ member, recipient: norm, message, language }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: data.success || data.status === 'SENT' || data.status === 'sent',
        status: data.status ? String(data.status).toUpperCase() : (data.success ? 'SENT' : 'FAILED'),
        message: data.message || (data.success ? 'Message sent successfully.' : 'Backend error'),
        providerMessageId: data.providerMessageId || data.messageId || null,
        recipient: norm,
        memberName,
      };
    }

    const errData = await response.json().catch(() => ({}));
    return {
      success: false,
      status: errData.status ? String(errData.status).toUpperCase() : 'NOT_CONFIGURED',
      message: errData.message || `WhatsApp delivery provider is not configured. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to server/.env.`,
      recipient: norm,
      memberName,
    };
  } catch (netErr) {
    return {
      success: false,
      status: WA_STATUS.NOT_CONFIGURED,
      message: 'WhatsApp delivery provider is not configured or backend server is unreachable. The message has been prepared but was not sent.',
      recipient: norm,
      memberName,
    };
  }
}

/**
 * Backend config check helper.
 */
export async function getWhatsAppConfigStatus() {
  try {
    const res = await fetch(getWhatsAppApiUrl('/api/whatsapp/config'));
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (_) {}

  return {
    ok: true,
    connected: false,
    isConfigured: false,
    status: 'NOT_CONFIGURED',
    adminNumber: ADMIN_WHATSAPP_NUMBER,
    message: 'WhatsApp delivery provider is not configured.',
  };
}

export async function getWhatsAppHealth() {
  try {
    const res = await fetch(getWhatsAppApiUrl('/api/health'));
    if (res.ok) return await res.json();
  } catch (_) {}
  return { ok: false };
}

export async function getWhatsAppStatus() {
  try {
    const res = await fetch(getWhatsAppApiUrl('/api/whatsapp/status'));
    if (res.ok) return await res.json();
  } catch (_) {}
  return { ok: false };
}

export async function getWhatsAppQrStatus() {
  try {
    const res = await fetch(getWhatsAppApiUrl('/api/whatsapp/qr'));
    if (res.ok) {
      const data = await res.json();
      return {
        ok: data.ok ?? true,
        connected: Boolean(data.connected),
        status: data.status || (data.connected ? 'CONNECTED' : (data.qrCodeDataUrl ? 'QR_READY' : 'INITIALIZING')),
        userPhone: data.userPhone || '9705184411',
        userName: data.userName || 'Raghavendra Chitts',
        lastConnected: data.lastConnected || null,
        error: data.error || null,
        qrCodeDataUrl: data.qrCodeDataUrl || null,
        qrGenerationId: data.qrGenerationId || 0,
        readyForReconnect: data.readyForReconnect ?? true,
      };
    }
  } catch (err) {
    return {
      ok: false,
      connected: false,
      status: 'INITIALIZING',
      error: 'Connecting to WhatsApp Gateway...',
      qrCodeDataUrl: null,
      qrGenerationId: 0,
    };
  }
  return {
    ok: false,
    connected: false,
    status: 'INITIALIZING',
    error: 'Connecting to WhatsApp Gateway...',
    qrCodeDataUrl: null,
    qrGenerationId: 0,
  };
}

export async function connectWhatsAppGateway() {
  try {
    const res = await fetch(getWhatsAppApiUrl('/api/whatsapp/connect'), { method: 'POST' });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { ok: false, connected: false, status: 'ERROR', error: 'Failed to request QR Code.' };
}

export async function reconnectWhatsAppGateway() {
  try {
    const res = await fetch(getWhatsAppApiUrl('/api/whatsapp/reconnect'), { method: 'POST' });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { ok: false, connected: false, status: 'ERROR', error: 'Failed to restart WhatsApp session.' };
}

export async function disconnectWhatsAppGateway() {
  try {
    const res = await fetch(getWhatsAppApiUrl('/api/whatsapp/disconnect'), { method: 'POST' });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { ok: false, connected: false, status: 'DISCONNECTED', readyForReconnect: true };
}

export async function testConnection() {
  return getWhatsAppConfigStatus();
}

export async function sendTestWhatsAppMessage({ recipient = '8125737275', message } = {}) {
  return sendSingleWhatsAppMessage({
    recipient,
    message: message || 'Hello Ahmad 👋 This is a test message from Raghavendra Chitts.',
  });
}

