// SMS functionality has been removed from Raghavendra Chitts.
// WhatsApp is the primary communication mechanism.

export const ADMIN_CONTACT_NUMBER = '919849053282';
export function getSmsConfig() {
  return { isConfigured: false, disabled: true };
}
export async function sendBulkSMS() {
  return { ok: false, message: 'SMS service disabled. Please use WhatsApp.' };
}
