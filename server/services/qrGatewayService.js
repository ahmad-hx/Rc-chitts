import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFolder = path.resolve(__dirname, '../auth_info_baileys');

let sock = null;
let currentQrDataUrl = null;
let connectionState = {
  connected: false,
  status: 'DISCONNECTED',
  userPhone: '9705184411',
  userName: 'Raghavendra Chitts',
  lastConnected: null,
  error: null,
};
let isInitializing = false;

export async function initWhatsAppQrGateway() {
  if (sock && connectionState.connected) {
    return connectionState;
  }
  if (isInitializing) {
    return connectionState;
  }

  isInitializing = true;
  connectionState.status = 'INITIALIZING';

  try {
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Raghavendra Chitts', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr);
          connectionState.connected = false;
          connectionState.status = 'QR_READY';
          connectionState.error = null;
          console.log('[WHATSAPP GATEWAY] New QR Code generated for scanning!');
        } catch (err) {
          console.error('[WHATSAPP GATEWAY] QR Code generation error:', err);
        }
      }

      if (connection === 'open') {
        currentQrDataUrl = null;
        connectionState.connected = true;
        connectionState.status = 'CONNECTED';
        connectionState.lastConnected = new Date().toISOString();
        connectionState.error = null;
        
        const userJid = sock.user?.id || '';
        const phoneDigits = userJid.split(':')[0] || userJid.split('@')[0] || '9705184411';
        connectionState.userPhone = phoneDigits;
        connectionState.userName = sock.user?.name || 'Raghavendra Chitts Admin';

        console.log(`[WHATSAPP GATEWAY] 🟢 WhatsApp Linked successfully! Connected phone: +${phoneDigits}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        connectionState.connected = false;
        connectionState.status = shouldReconnect ? 'RECONNECTING' : 'DISCONNECTED';
        connectionState.error = lastDisconnect?.error?.message || 'Connection closed';

        console.log(`[WHATSAPP GATEWAY] Connection closed (statusCode: ${statusCode}). Reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(() => {
            isInitializing = false;
            initWhatsAppQrGateway();
          }, 3000);
        } else {
          // If logged out, clean auth folder so fresh QR can be scanned
          try {
            fs.rmSync(authFolder, { recursive: true, force: true });
          } catch (_) {}
          isInitializing = false;
        }
      }
    });

  } catch (err) {
    console.error('[WHATSAPP GATEWAY] Initialization error:', err);
    connectionState.connected = false;
    connectionState.status = 'ERROR';
    connectionState.error = err.message;
  } finally {
    isInitializing = false;
  }

  return connectionState;
}

export function getWhatsAppGatewayState() {
  return {
    ...connectionState,
    qrCodeDataUrl: currentQrDataUrl,
  };
}

export async function sendWhatsAppMessageViaQrGateway({ recipient, message }) {
  const normPhone = String(recipient).replace(/\D/g, '');
  if (!normPhone) {
    return {
      success: false,
      status: 'INVALID_NUMBER',
      message: 'Invalid recipient phone number.',
    };
  }

  // Format recipient JID for Baileys
  const formattedJid = normPhone.includes('@s.whatsapp.net') ? normPhone : `${normPhone}@s.whatsapp.net`;

  // If gateway is connected via scanned QR code
  if (sock && connectionState.connected) {
    try {
      const sentMsg = await sock.sendMessage(formattedJid, { text: message });
      return {
        success: true,
        status: 'SENT',
        messageId: sentMsg?.key?.id || `wa_${Date.now()}`,
        recipient: normPhone,
        provider: 'WHATSAPP_LINKED_DEVICE_GATEWAY',
      };
    } catch (err) {
      console.error('[WHATSAPP GATEWAY] Message send error:', err);
      return {
        success: false,
        status: 'FAILED',
        message: err.message || 'Failed to deliver message via linked WhatsApp session.',
        recipient: normPhone,
      };
    }
  }

  // If QR code is not scanned yet
  return {
    success: false,
    status: 'NOT_CONFIGURED',
    message: 'WhatsApp is not linked yet. Please scan the QR Code in Settings / WhatsApp Studio to link your device.',
    recipient: normPhone,
  };
}

export async function disconnectWhatsAppGateway() {
  try {
    if (sock) {
      sock.logout();
      sock = null;
    }
    connectionState.connected = false;
    connectionState.status = 'DISCONNECTED';
    currentQrDataUrl = null;
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
    return { success: true, message: 'WhatsApp session unlinked.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
