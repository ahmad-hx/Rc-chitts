import express from 'express';
import cors from 'cors';
import { sendWhatsAppBroadcast, sendSingleWhatsAppMessage, getWhatsAppConfig, ADMIN_WHATSAPP_NUMBER } from './services/whatsappService.js';
import { sendBulkSMS, getSmsConfig, ADMIN_CONTACT_NUMBER } from './services/smsService.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  const config = getWhatsAppConfig();

  res.json({
    ok: true,
    adminNumber: ADMIN_WHATSAPP_NUMBER,
    config,
    connected: config.isConfigured,
    status: config.isConfigured ? 'connected' : 'not_configured',
  });
});

app.get('/api/sms/health', (req, res) => {
  const config = getSmsConfig();

  res.json({
    ok: true,
    adminNumber: ADMIN_CONTACT_NUMBER,
    connected: config.isConfigured,
    status: config.isConfigured ? 'connected' : 'not_configured',
    config,
  });
});

app.post('/api/whatsapp/send', async (req, res) => {
  const { member, recipient, message, language = 'english+telugu' } = req.body || {};

  try {
    const result = await sendSingleWhatsAppMessage({ member, recipient, message, language });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'failed',
      message: error.message || 'Failed to process WhatsApp request.',
      recipient: recipient || '',
    });
  }
});

app.post('/api/whatsapp/broadcast', async (req, res) => {
  const { members = [], language = 'english+telugu', target = 'all' } = req.body || {};

  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'No recipient members provided for the broadcast.',
    });
  }

  try {
    const result = await sendWhatsAppBroadcast({ members, language, target });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to send WhatsApp broadcast.',
    });
  }
});

app.post('/api/sms/broadcast', async (req, res) => {
  const { members = [], language = 'english', messageType = 'payment_reminder' } = req.body || {};

  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'No recipient members provided for the SMS broadcast.',
    });
  }

  try {
    const result = await sendBulkSMS({ members, language, messageType });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to send SMS broadcast.',
    });
  }
});

// Catch-all JSON 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    ok: false,
    success: false,
    status: 'not_found',
    message: `API endpoint '${req.originalUrl}' was not found on the backend server.`,
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    success: false,
    status: 'not_found',
    message: `Endpoint '${req.originalUrl}' not found.`,
  });
});

app.listen(port, () => {
  console.log(`Raghavendra Chitts WhatsApp API running on http://localhost:${port}`);
});
