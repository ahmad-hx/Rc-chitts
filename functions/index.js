import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import admin from "firebase-admin";

// ─── Firebase Admin Init ──────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ─── Firebase Secrets (production-safe — never in frontend code) ──────────────
const waAccessToken  = defineSecret("WHATSAPP_ACCESS_TOKEN");
const waPhoneNumId   = defineSecret("WHATSAPP_PHONE_NUMBER_ID");

// ─── Constants ────────────────────────────────────────────────────────────────
export const ADMIN_WHATSAPP_NUMBER = "9705184411";

// ─── Status Codes ─────────────────────────────────────────────────────────────
const STATUS = {
  SENT:           "SENT",
  FAILED:         "FAILED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  UNAUTHORIZED:   "UNAUTHORIZED",
  INVALID_NUMBER: "INVALID_NUMBER",
  API_ERROR:      "API_ERROR",
  NETWORK_ERROR:  "NETWORK_ERROR",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function maskPhone(phone = "") {
  const s = String(phone);
  if (s.length <= 4) return "****";
  return s.slice(0, -4).replace(/\d/g, "*") + s.slice(-4);
}

function normalizePhone(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0"))  return `91${digits.slice(1)}`;
  if (digits.startsWith("91")) return digits;
  return `91${digits}`;
}

function fmtINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

// ─── Message Builders ─────────────────────────────────────────────────────────
function buildEnglishMessage(member, activeChits) {
  const name = member.name || "Member";
  if (!activeChits.length) {
    return `Dear ${name} Garu,\n\nYour Raghavendra Chitts payment is due soon.\n\nPlease make your payment on time.\n\nThank you,\nRaghavendra Chitts\n📞 ${ADMIN_WHATSAPP_NUMBER}`;
  }

  let lines = `Dear ${name} Garu,\n\nYour Raghavendra Chitts payment details:\n\n`;
  activeChits.forEach((chit, i) => {
    lines += `${i + 1}. ${chit.name || "Chit"}\n`;
    lines += `   Monthly Due: ${fmtINR(chit.amountToPay)}\n`;
    lines += `   Balance: ${fmtINR(chit.balanceAmount)}\n\n`;
  });
  const totalDue = activeChits.reduce((s, c) => s + Number(c.amountToPay || 0), 0);
  lines += `Total Monthly Due: ${fmtINR(totalDue)}\n\n`;
  lines += `Please make your payment on time.\n\nThank you,\nRaghavendra Chitts\n📞 ${ADMIN_WHATSAPP_NUMBER}`;
  return lines;
}

function buildTeluguMessage(member, activeChits) {
  const name = member.name || "Member";
  if (!activeChits.length) {
    return `నమస్కారం ${name} గారు,\n\nమీ రాఘవేంద్ర చిట్స్ చెల్లింపు సమయం వచ్చింది.\n\nదయచేసి సమయానికే చెల్లించండి.\n\nధన్యవాదములు,\nరాఘవేంద్ర చిట్స్\n📞 ${ADMIN_WHATSAPP_NUMBER}`;
  }

  let lines = `నమస్కారం ${name} గారు,\n\nమీ రాఘవేంద్ర చిట్స్ చెల్లింపు వివరాలు:\n\n`;
  activeChits.forEach((chit, i) => {
    const chitName = (chit.name || "చిట్టీ").replace(/Chit/gi, "చిట్టీ").replace(/Group/gi, "గ్రూప్");
    lines += `${i + 1}. ${chitName}\n`;
    lines += `   నెలవారీ చెల్లింపు: ${fmtINR(chit.amountToPay)}\n`;
    lines += `   మిగిలిన మొత్తం: ${fmtINR(chit.balanceAmount)}\n\n`;
  });
  const totalDue = activeChits.reduce((s, c) => s + Number(c.amountToPay || 0), 0);
  lines += `మొత్తం నెలవారీ చెల్లింపు: ${fmtINR(totalDue)}\n\n`;
  lines += `దయచేసి మీ చెల్లింపును సమయానికే పూర్తి చేయండి.\n\nధన్యవాదములు,\nరాఘవేంద్ర చిట్స్\n📞 ${ADMIN_WHATSAPP_NUMBER}`;
  return lines;
}

function buildMessage(member, language = "english+telugu") {
  const activeChits = (member.chits || []).filter(c => !c.status || c.status === "ACTIVE");
  const lang = String(language).toLowerCase();
  const isBilingual = lang.includes("telugu") && lang.includes("english");
  const isTelugu    = lang.includes("telugu") && !lang.includes("english");

  if (isBilingual) {
    return `${buildEnglishMessage(member, activeChits)}\n\n${"─".repeat(20)}\n\n${buildTeluguMessage(member, activeChits)}`;
  }
  if (isTelugu) return buildTeluguMessage(member, activeChits);
  return buildEnglishMessage(member, activeChits);
}

// ─── Firestore Message Log (messageLogs collection) ───────────────────────────
async function logMessage({ memberId, memberName, phone, language, message, status, providerMessageId, error }) {
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("messageLogs").add({
      memberId:          memberId || null,
      memberName:        memberName || "Member",
      phone:             maskPhone(phone), // masked for safety
      channel:           "whatsapp",
      language:          language || "english+telugu",
      message:           message ? message.slice(0, 300) : "",
      status:            status || STATUS.FAILED,
      providerMessageId: providerMessageId || null,
      error:             error || null,
      createdAt:         now,
      sentAt:            status === STATUS.SENT ? now : null,
    });
  } catch (err) {
    // Non-critical — log failure does not block the API response
    logger.warn("messageLogs write failed:", err.message);
  }
}

// ─── Core WhatsApp Send Logic ─────────────────────────────────────────────────
async function sendViaMetaApi({ recipient, messageText, accessToken, phoneNumberId }) {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  let metaRes;
  try {
    metaRes = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:   recipient,
        type: "text",
        text: { body: messageText, preview_url: false },
      }),
    });
  } catch (netErr) {
    logger.error("Meta API network error:", netErr.message);
    return { ok: false, status: STATUS.NETWORK_ERROR, message: `Network error reaching Meta: ${netErr.message}` };
  }

  let data = {};
  try {
    const raw = await metaRes.text();
    if (raw && raw.trim()) data = JSON.parse(raw);
  } catch (_) {
    // ignore parse error — metaRes.ok check still valid
  }

  if (!metaRes.ok) {
    const errMsg = data?.error?.message || `Meta API rejected the request (HTTP ${metaRes.status})`;
    logger.warn("Meta API error:", { status: metaRes.status, error: data?.error });
    return { ok: false, status: STATUS.API_ERROR, message: errMsg };
  }

  const messageId = data?.messages?.[0]?.id || null;
  logger.info("Meta API success:", { messageId, recipient: maskPhone(recipient) });
  return { ok: true, status: STATUS.SENT, messageId };
}

// ─── Callable Cloud Function (primary — used by frontend SDK) ─────────────────
export const sendWhatsAppMessage = onCall(
  { cors: true, secrets: [waAccessToken, waPhoneNumId] },
  async (request) => {
    // 1. Authentication check
    if (!request.auth) {
      logger.warn("Unauthenticated call to sendWhatsAppMessage");
      throw new HttpsError("unauthenticated", "Authentication required. Only logged-in admins can send WhatsApp messages.");
    }

    const callerUid   = request.auth.uid;
    const callerEmail = request.auth.token?.email || "unknown";
    logger.info("sendWhatsAppMessage called by:", { uid: callerUid, email: callerEmail });

    // 2. Read credentials from Firebase Secrets
    const accessToken  = waAccessToken.value();
    const phoneNumberId = waPhoneNumId.value();

    if (!accessToken || !phoneNumberId ||
        accessToken === "YOUR_WHATSAPP_ACCESS_TOKEN_HERE" ||
        phoneNumberId === "YOUR_PHONE_NUMBER_ID_HERE") {
      logger.warn("WhatsApp credentials not configured");
      return {
        success: false,
        status:  STATUS.NOT_CONFIGURED,
        message: "WhatsApp Business API credentials are not configured on the server. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID as Firebase secrets.",
        adminNumber: ADMIN_WHATSAPP_NUMBER,
      };
    }

    // 3. Validate and extract request data
    const { recipient, member, message, language = "english+telugu" } = request.data || {};

    const rawRecipient = recipient || member?.whatsapp || member?.phone || "";
    const cleanRecipient = normalizePhone(rawRecipient);

    if (!cleanRecipient || cleanRecipient.length < 10) {
      logger.warn("Invalid recipient number:", rawRecipient);
      return {
        success: false,
        status:  STATUS.INVALID_NUMBER,
        message: "Invalid or missing recipient WhatsApp number.",
        recipient: rawRecipient || "",
      };
    }

    logger.info("Preparing WhatsApp message:", {
      recipient:  maskPhone(cleanRecipient),
      memberName: member?.name || "Unknown",
      language,
    });

    // 4. Build personalized message (server-side, using passed member data)
    const messageText = message || (member ? buildMessage(member, language) : `Hello from Raghavendra Chitts. Please contact us at ${ADMIN_WHATSAPP_NUMBER}.`);

    // 5. Call Meta API
    const result = await sendViaMetaApi({ recipient: cleanRecipient, messageText, accessToken, phoneNumberId });

    // 6. Log to Firestore (messageLogs)
    await logMessage({
      memberId:          member?.id || null,
      memberName:        member?.name || "Member",
      phone:             cleanRecipient,
      language,
      message:           messageText,
      status:            result.status,
      providerMessageId: result.messageId || null,
      error:             result.ok ? null : result.message,
    });

    // 7. Return consistent response
    if (result.ok) {
      return {
        success:           true,
        status:            STATUS.SENT,
        message:           "WhatsApp message sent successfully.",
        providerMessageId: result.messageId,
        messageId:         result.messageId,
        recipient:         cleanRecipient,
        memberName:        member?.name || "Member",
      };
    }

    return {
      success:    false,
      status:     result.status,
      message:    result.message,
      recipient:  cleanRecipient,
      memberName: member?.name || "Member",
    };
  }
);

// ─── HTTPS Cloud Function (REST fallback — also secured) ─────────────────────
export const sendWhatsAppMessageApi = onRequest(
  { cors: true, secrets: [waAccessToken, waPhoneNumId] },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, status: STATUS.FAILED, message: "Method Not Allowed. Use POST." });
    }

    // Auth via Firebase ID token in Authorization header
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, status: STATUS.UNAUTHORIZED, message: "Authentication required." });
    }

    let decodedToken;
    try {
      const idToken = authHeader.slice(7);
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authErr) {
      logger.warn("ID token verification failed:", authErr.message);
      return res.status(401).json({ success: false, status: STATUS.UNAUTHORIZED, message: "Invalid or expired authentication token." });
    }

    const accessToken   = waAccessToken.value();
    const phoneNumberId = waPhoneNumId.value();

    if (!accessToken || !phoneNumberId) {
      return res.json({ success: false, status: STATUS.NOT_CONFIGURED, message: "WhatsApp credentials are not configured on the server." });
    }

    const { recipient, member, message, language = "english+telugu" } = req.body || {};
    const rawRecipient   = recipient || member?.whatsapp || member?.phone || "";
    const cleanRecipient = normalizePhone(rawRecipient);

    if (!cleanRecipient || cleanRecipient.length < 10) {
      return res.json({ success: false, status: STATUS.INVALID_NUMBER, message: "Invalid recipient phone number." });
    }

    const messageText = message || (member ? buildMessage(member, language) : "Hello from Raghavendra Chitts.");
    const result = await sendViaMetaApi({ recipient: cleanRecipient, messageText, accessToken, phoneNumberId });

    await logMessage({
      memberId:          member?.id || null,
      memberName:        member?.name || "Member",
      phone:             cleanRecipient,
      language,
      message:           messageText,
      status:            result.status,
      providerMessageId: result.messageId || null,
      error:             result.ok ? null : result.message,
    });

    if (result.ok) {
      return res.json({ success: true, status: STATUS.SENT, message: "WhatsApp message sent successfully.", messageId: result.messageId, recipient: cleanRecipient });
    }
    return res.json({ success: false, status: result.status, message: result.message, recipient: cleanRecipient });
  }
);
