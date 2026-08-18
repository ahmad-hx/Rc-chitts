/**
 * Raghavendra Chitts — WhatsApp Service (Frontend)
 *
 * Architecture:
 *   1. Firebase Callable Cloud Function (primary — credentials stay on server)
 *   2. Express /api/whatsapp/send (local dev fallback — same security model)
 *
 * IMPORTANT: WhatsApp credentials (WHATSAPP_ACCESS_TOKEN) are NEVER stored
 * in this file, in localStorage, or anywhere in the browser.
 */

import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../firebase';

export const ADMIN_WHATSAPP_NUMBER = '9705184411';

// ─── Status Codes (mirrors server) ───────────────────────────────────────────
export const WA_STATUS = {
  SENT:           'SENT',
  FAILED:         'FAILED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  UNAUTHORIZED:   'UNAUTHORIZED',
  INVALID_NUMBER: 'INVALID_NUMBER',
  API_ERROR:      'API_ERROR',
  NETWORK_ERROR:  'NETWORK_ERROR',
};

// ─── Safe JSON Response Parser ────────────────────────────────────────────────
// Handles: valid JSON, empty body, HTML 404 pages, 401/403/500 etc.
export async function parseJsonResponse(response) {
  let text = '';
  try {
    text = await response.text();
  } catch (_) {
    // network-level read failure
  }

  if (text && text.trim()) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {
      // Non-JSON body (e.g. Express/Nginx HTML error page)
    }
  }

  const httpStatusMessages = {
    404: 'API endpoint not found (HTTP 404). Ensure the backend server is running.',
    401: 'Authentication required (HTTP 401). Please log in with your admin account.',
    403: 'Access denied (HTTP 403). Admin credentials required.',
    500: 'Server error (HTTP 500). Please check the backend logs.',
  };

  return {
    success: false,
    status: response.status === 404 ? WA_STATUS.NOT_CONFIGURED : WA_STATUS.FAILED,
    message: httpStatusMessages[response.status]
      || `Server returned an unexpected response (HTTP ${response.status}).`,
    rawPreview: text ? text.slice(0, 120) : '',
  };
}

// ─── WhatsApp Config Status ───────────────────────────────────────────────────
export async function getWhatsAppConfigStatus() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      return {
        ok: false,
        connected: false,
        status: WA_STATUS.NOT_CONFIGURED,
        adminNumber: ADMIN_WHATSAPP_NUMBER,
        message: 'Backend WhatsApp service is unreachable.',
      };
    }
    const data = await parseJsonResponse(response);
    return data;
  } catch (error) {
    return {
      ok: false,
      connected: false,
      status: WA_STATUS.NOT_CONFIGURED,
      adminNumber: ADMIN_WHATSAPP_NUMBER,
      message: error.message || 'Unable to check WhatsApp API status.',
    };
  }
}

// ─── Send Single WhatsApp Message ─────────────────────────────────────────────
// Passes the full member object (with chits) to the Cloud Function so
// personalized messages are built server-side — not in the browser.
export async function sendSingleWhatsAppMessage({ member, recipient, message, language = 'english+telugu' }) {
  const targetRecipient = recipient || member?.whatsapp || member?.phone || '';
  const memberName = member?.name || 'Member';

  // ── Path 1: Firebase Callable Cloud Function (primary) ──────────────────
  // Only available when user is authenticated (Firebase Auth handles the token).
  if (auth.currentUser) {
    try {
      const callable = httpsCallable(functions, 'sendWhatsAppMessage', { timeout: 30000 });
      const result = await callable({
        recipient:  targetRecipient,
        member,           // full member object incl. chits for server-side message building
        memberName,
        message,          // optional override; if absent, server builds from member data
        language,
      });

      if (result?.data) {
        return normalizeResponse(result.data, targetRecipient, memberName);
      }
    } catch (firebaseErr) {
      const code = firebaseErr?.code || '';
      const msg  = firebaseErr?.message || '';

      // Unauthenticated / permission errors — don't fall through
      if (code === 'functions/unauthenticated' || code === 'functions/permission-denied') {
        return {
          success: false,
          status:  WA_STATUS.UNAUTHORIZED,
          message: 'Authentication required. Please log in with your admin account.',
          recipient: targetRecipient,
          memberName,
        };
      }

      // Function not deployed yet — fall through to Express backend
      if (code === 'functions/not-found' || code === 'functions/unavailable' || msg.includes('NOT_FOUND')) {
        console.warn('[WhatsApp] Firebase Cloud Function not deployed — falling back to Express API backend.');
      } else {
        console.warn('[WhatsApp] Firebase Cloud Function error — falling back to Express API backend:', msg);
      }
    }
  }

  // ── Path 2: Express /api/whatsapp/send (local dev / fallback) ───────────
  // Still secure: credentials live in server/.env on the backend.
  try {
    const headers = { 'Content-Type': 'application/json' };

    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (_) {
        // Proceed without token — backend will still respond (may reject if it enforces auth)
      }
    }

    const response = await fetch('/api/whatsapp/send', {
      method:  'POST',
      headers,
      body: JSON.stringify({ member, recipient: targetRecipient, message, language }),
    });

    const data = await parseJsonResponse(response);
    return normalizeResponse(data, targetRecipient, memberName);
  } catch (networkErr) {
    return {
      success:    false,
      status:     WA_STATUS.NETWORK_ERROR,
      message:    `Could not reach the backend server: ${networkErr.message}`,
      recipient:  targetRecipient,
      memberName,
    };
  }
}

// ─── Broadcast (bulk — production phase, not yet enabled) ─────────────────────
export async function sendWhatsAppBroadcast({ members, language = 'english+telugu', target = 'all' }) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch (_) {}
    }

    const response = await fetch('/api/whatsapp/broadcast', {
      method:  'POST',
      headers,
      body: JSON.stringify({ members, language, target }),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || data?.message || 'Unable to send WhatsApp broadcast.');
    }

    return data;
  } catch (error) {
    throw new Error(error.message || 'Unable to send WhatsApp broadcast.');
  }
}

// ─── Normalise response shape ─────────────────────────────────────────────────
function normalizeResponse(data, fallbackRecipient, fallbackName) {
  if (!data || typeof data !== 'object') {
    return {
      success:    false,
      status:     WA_STATUS.FAILED,
      message:    'Received an unexpected empty response from the server.',
      recipient:  fallbackRecipient,
      memberName: fallbackName,
    };
  }

  // Normalise status to uppercase enum
  const rawStatus = String(data.status || '').toUpperCase();
  const knownStatuses = Object.values(WA_STATUS);
  const status = knownStatuses.includes(rawStatus) ? rawStatus : (data.success ? WA_STATUS.SENT : WA_STATUS.FAILED);

  return {
    success:    !!data.success,
    status,
    message:    data.message || (data.success ? 'Message sent.' : 'Message failed.'),
    messageId:  data.messageId || null,
    recipient:  data.recipient  || fallbackRecipient,
    memberName: data.memberName || fallbackName,
  };
}

export const ADMIN_CONTACT_NUMBER = ADMIN_WHATSAPP_NUMBER;
