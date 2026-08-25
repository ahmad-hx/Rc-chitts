import makeWASocket, { useMultiFileAuthState as initBaileysAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFolder = path.resolve(__dirname, '../auth_info_baileys');

let sock = null;
let currentQrDataUrl = null;
let qrGenerationId = 0;
let isInitializing = false;
let isDisconnecting = false;
let reconnectTimeout = null;

let connectionState = {
  connected: false,
  status: 'DISCONNECTED', // 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING' | 'ERROR'
  userPhone: '9705184411',
  userName: 'Raghavendra Chitts',
  lastConnected: null,
  error: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function safeCleanAuthFolder() {
  try {
    if (fs.existsSync(authFolder)) {
      // Remove all files inside auth folder
      const files = fs.readdirSync(authFolder);
      for (const file of files) {
        try {
          const curPath = path.join(authFolder, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            fs.rmSync(curPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(curPath);
          }
        } catch (_) {}
      }
      try {
        fs.rmSync(authFolder, { recursive: true, force: true });
      } catch (_) {}
      console.log('[WHATSAPP GATEWAY] 🧹 Auth cache folder cleared successfully.');
    }
  } catch (e) {
    console.warn('[WHATSAPP GATEWAY] Notice during auth folder cleanup:', e.message);
  }
}

async function cleanupSocket(isExplicitLogout = false) {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (sock) {
    const tempSock = sock;
    sock = null;

    try {
      if (tempSock.ev) {
        tempSock.ev.removeAllListeners('connection.update');
        tempSock.ev.removeAllListeners('creds.update');
        tempSock.ev.removeAllListeners('messages.upsert');
      }
    } catch (_) {}

    try {
      if (isExplicitLogout) {
        await tempSock.logout().catch(() => {});
      }
    } catch (_) {}

    try {
      tempSock.end(undefined);
    } catch (_) {}
  }
}

/**
 * Initializes or restarts the Baileys WhatsApp QR Gateway.
 * @param {boolean} forceRestart - When true, forces complete socket teardown, auth purge, and fresh QR generation.
 */
export async function initWhatsAppQrGateway(forceRestart = false) {
  // If already connected and not forcing restart, return current active state
  if (!forceRestart && sock && connectionState.connected) {
    return getWhatsAppGatewayState();
  }

  // Prevent race condition during active initialization unless forced
  if (!forceRestart && isInitializing) {
    return getWhatsAppGatewayState();
  }

  qrGenerationId += 1;
  const currentGenId = qrGenerationId;

  isInitializing = true;
  connectionState.status = 'INITIALIZING';
  connectionState.error = null;

  if (forceRestart) {
    currentQrDataUrl = null;
    connectionState.connected = false;
    await cleanupSocket(true);
    await sleep(200);
    safeCleanAuthFolder();
    await sleep(150);
  }

  try {
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    const { state, saveCreds } = await initBaileysAuthState(authFolder);

    // Double check if generation was superseded while awaiting auth state
    if (currentGenId !== qrGenerationId) {
      return getWhatsAppGatewayState();
    }

    await cleanupSocket(false);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Raghavendra Chitts', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      emitOwnEvents: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      // If this socket was superseded by a newer generation, ignore its events
      if (currentGenId !== qrGenerationId) {
        return;
      }

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            scale: 7,
            color: {
              dark: '#1C1C1A',
              light: '#FFFFFF',
            },
          });
          connectionState.connected = false;
          connectionState.status = 'QR_READY';
          connectionState.error = null;
          console.log(`[WHATSAPP GATEWAY] 📱 New QR Code ready for scan (Gen #${currentGenId})`);
        } catch (err) {
          console.error('[WHATSAPP GATEWAY] QR Code generation error:', err);
          connectionState.error = 'Failed to generate QR Code image';
        }
      }

      if (connection === 'open') {
        currentQrDataUrl = null;
        connectionState.connected = true;
        connectionState.status = 'CONNECTED';
        connectionState.lastConnected = new Date().toISOString();
        connectionState.error = null;

        const userJid = sock?.user?.id || '';
        const phoneDigits = userJid.split(':')[0] || userJid.split('@')[0] || '9705184411';
        connectionState.userPhone = phoneDigits;
        connectionState.userName = sock?.user?.name || 'Raghavendra Chitts Admin';

        console.log(`[WHATSAPP GATEWAY] 🟢 WhatsApp Linked successfully! Phone: +${phoneDigits}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === 403;
        const shouldReconnect = !isLoggedOut && !isDisconnecting && currentGenId === qrGenerationId;

        connectionState.connected = false;
        connectionState.status = isLoggedOut ? 'DISCONNECTED' : (shouldReconnect ? 'CONNECTING' : 'DISCONNECTED');
        connectionState.error = lastDisconnect?.error?.message || (isLoggedOut ? 'Device was unlinked' : 'Connection closed');

        console.log(
          `[WHATSAPP GATEWAY] Connection closed (status: ${statusCode}). Reconnect allowed: ${shouldReconnect}`
        );

        if (isLoggedOut) {
          safeCleanAuthFolder();
          currentQrDataUrl = null;
        } else if (shouldReconnect) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (currentGenId === qrGenerationId && !connectionState.connected) {
              initWhatsAppQrGateway(false);
            }
          }, 3000);
        }
      }
    });

  } catch (err) {
    console.error('[WHATSAPP GATEWAY] Socket initialization error:', err);
    if (currentGenId === qrGenerationId) {
      connectionState.connected = false;
      connectionState.status = 'ERROR';
      connectionState.error = err.message || 'Initialization failed';
    }
  } finally {
    if (currentGenId === qrGenerationId) {
      isInitializing = false;
    }
  }

  return getWhatsAppGatewayState();
}

export function getWhatsAppGatewayState() {
  return {
    ...connectionState,
    qrCodeDataUrl: currentQrDataUrl,
    qrGenerationId,
    readyForReconnect: true,
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

  const formattedJid = normPhone.includes('@s.whatsapp.net')
    ? normPhone
    : `${normPhone}@s.whatsapp.net`;

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

  return {
    success: false,
    status: 'NOT_CONFIGURED',
    message: 'WhatsApp is not linked yet. Please scan the QR Code in WhatsApp Messaging Gateway to link your device.',
    recipient: normPhone,
  };
}

/**
 * Explicit disconnect requested by admin.
 * Performs complete teardown and unlinks auth cache so next generation is completely clean.
 */
export async function disconnectWhatsAppGateway() {
  isDisconnecting = true;
  connectionState.status = 'DISCONNECTING';

  try {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    await cleanupSocket(true);
    await sleep(250);
    safeCleanAuthFolder();
    await sleep(150);

    connectionState.connected = false;
    connectionState.status = 'DISCONNECTED';
    connectionState.error = null;
    currentQrDataUrl = null;
    isInitializing = false;

    console.log('[WHATSAPP GATEWAY] 🔴 Complete disconnect and session wipe finished.');
    return {
      ok: true,
      success: true,
      connected: false,
      status: 'DISCONNECTED',
      qr: null,
      readyForReconnect: true,
      message: 'WhatsApp session unlinked and cleaned successfully.',
    };
  } catch (err) {
    console.error('[WHATSAPP GATEWAY] Disconnect error:', err);
    connectionState.connected = false;
    connectionState.status = 'DISCONNECTED';
    currentQrDataUrl = null;
    isInitializing = false;
    safeCleanAuthFolder();
    return {
      ok: true,
      success: true,
      connected: false,
      status: 'DISCONNECTED',
      qr: null,
      readyForReconnect: true,
      message: 'WhatsApp session cleared.',
    };
  } finally {
    isDisconnecting = false;
  }
}

/**
 * Restarts WhatsApp Gateway completely: cleans up old socket, clears auth, and generates a fresh QR.
 * Waits up to 3 seconds for the QR image to be generated before returning.
 */
export async function restartWhatsAppGateway() {
  console.log('[WHATSAPP GATEWAY] 🔄 Restarting WhatsApp Gateway for fresh session...');
  await disconnectWhatsAppGateway();
  await sleep(200);

  const initPromise = initWhatsAppQrGateway(true);

  // Poll for up to 3000ms until QR is ready or socket opens
  const start = Date.now();
  while (Date.now() - start < 3000) {
    const currentState = getWhatsAppGatewayState();
    if (currentState.qrCodeDataUrl || currentState.connected || currentState.status === 'QR_READY') {
      break;
    }
    await sleep(200);
  }

  await initPromise;
  return getWhatsAppGatewayState();
}
