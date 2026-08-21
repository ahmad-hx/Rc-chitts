import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '.env');
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

import { sendWhatsAppBroadcast, sendSingleWhatsAppMessage, sendTestWhatsAppMessage, getWhatsAppConfig, verifyMetaConnection, ADMIN_WHATSAPP_NUMBER } from './services/whatsappService.js';
import { initWhatsAppQrGateway, getWhatsAppGatewayState, sendWhatsAppMessageViaQrGateway, disconnectWhatsAppGateway } from './services/qrGatewayService.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://raghavendra-chitts-c0822.web.app'
  ],
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  const metaCfg = await verifyMetaConnection();
  const qrState = getWhatsAppGatewayState();

  res.json({
    ok: true,
    adminNumber: ADMIN_WHATSAPP_NUMBER,
    connected: qrState.connected || metaCfg.connected,
    status: qrState.connected ? 'CONNECTED' : metaCfg.status,
    qrState,
    metaConfig: metaCfg,
  });
});

// ─── WHATSAPP LINKED DEVICE QR CODE ENDPOINTS ─────────────────────────────────
app.get('/api/whatsapp/qr', (req, res) => {
  const state = getWhatsAppGatewayState();
  res.json({
    ok: true,
    ...state,
  });
});

app.get('/api/whatsapp/status', (req, res) => {
  const state = getWhatsAppGatewayState();
  res.json({
    ok: true,
    ...state,
  });
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  const result = await disconnectWhatsAppGateway();
  res.json(result);
});

// ─── MAIN SEND MESSAGE API ENDPOINT ───────────────────────────────────────────
app.post('/api/whatsapp/send', async (req, res) => {
  const { member, recipient, message } = req.body || {};
  const targetPhone = recipient || member?.whatsapp || member?.phone || '';

  // 1. If Scanned QR Device is linked & active:
  const qrState = getWhatsAppGatewayState();
  if (qrState.connected) {
    const outcome = await sendWhatsAppMessageViaQrGateway({ recipient: targetPhone, message });
    return res.json(outcome);
  }

  // 2. Otherwise try Meta Cloud API backend if configured
  try {
    const outcome = await sendSingleWhatsAppMessage({ member, recipient: targetPhone, message });
    return res.json(outcome);
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      message: err.message || 'WhatsApp message dispatch failed.',
      recipient: targetPhone,
    });
  }
});

app.post('/api/whatsapp/test-message', async (req, res) => {
  const { recipient, message } = req.body || {};
  try {
    const qrState = getWhatsAppGatewayState();
    if (qrState.connected) {
      const outcome = await sendWhatsAppMessageViaQrGateway({ recipient, message });
      return res.json(outcome);
    }
    const result = await sendTestWhatsAppMessage({ recipient, message });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      message: error.message || 'Failed to send test WhatsApp message.',
      recipient: recipient || '',
    });
  }
});

app.get('/api/whatsapp/config', async (req, res) => {
  const metaCfg = await verifyMetaConnection();
  const qrState = getWhatsAppGatewayState();
  res.json({
    ok: true,
    connected: qrState.connected || metaCfg.connected,
    isConfigured: qrState.connected || metaCfg.isConfigured,
    status: qrState.connected ? 'CONNECTED' : metaCfg.status,
    qrState,
    metaConfig: metaCfg,
  });
});

// Catch-all JSON 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    ok: false,
    success: false,
    status: 'not_found',
    message: `API endpoint '${req.originalUrl}' was not found.`,
  });
});

app.listen(port, () => {
  console.log(`Raghavendra Chitts WhatsApp Gateway running on http://localhost:${port}`);
  // Initialize QR Code Baileys Linked Device socket
  initWhatsAppQrGateway();
});
