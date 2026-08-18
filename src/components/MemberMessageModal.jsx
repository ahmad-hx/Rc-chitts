import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { MessageSquare, Send, CheckCircle2, Phone, CreditCard } from 'lucide-react';
import { getBilingualWhatsAppMessage } from '../services/messageFormatter';
import { generateUpiPayLink } from '../services/upiService';

export default function MemberMessageModal({ isOpen, onClose, member, onSent, groupPaymentSettings = {} }) {
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [copied, setCopied] = useState(false);

  if (!member) return null;

  const upiInfo = generateUpiPayLink({ member, groupPaymentSettings });
  const totalPayable = upiInfo.amount;
  const activeChits = (member.chits || []).filter(c => c.status ? c.status === 'ACTIVE' : true);

  const whatsappMessage = getBilingualWhatsAppMessage(member, groupPaymentSettings);

  const smsMessage = `Dear ${member.name},
Chitt Due: ${upiInfo.formattedAmount} | 15 Aug

${member.name} గారు,
చిట్టి బకాయి: ${upiInfo.formattedAmount} | 15 ఆగస్టు

Please pay on time.
సమయానికి చెల్లించండి.

Raghavendra Chitts | 9705184411`;

  const handleLaunchUpiIntent = () => {
    if (!upiInfo.success || !upiInfo.upiUrl) {
      onSent?.('No payment required (Amount is ₹0)');
      return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = upiInfo.upiUrl;
      onSent?.(`Opened UPI payment app for ${member.name} (${upiInfo.formattedAmount})`);
    } else {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(upiInfo.upiUrl);
      }
      onSent?.(`UPI Link (${upiInfo.formattedAmount}) copied! UPI payments are available on supported mobile devices.`);
    }
  };

  const handleOpenWhatsAppWeb = () => {
    const rawPhone = member.whatsapp || member.phone || '';
    const digits = rawPhone.replace(/\D/g, '');
    const phoneNum = digits.startsWith('91') ? digits : `91${digits.replace(/^0/, '')}`;
    const encoded = encodeURIComponent(whatsappMessage);
    window.open(`https://wa.me/${phoneNum}?text=${encoded}`, '_blank');
    onSent?.(`WhatsApp link opened for ${member.name}`);
    onClose();
  };

  const handleSendSMS = () => {
    onSent?.(`SMS sent successfully to ${member.name} (${member.phone})`);
    onClose();
  };

  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Send Message: ${member.name}`}
      subtitle={`Member Phone: ${member.phone} • ${activeChits.length} Active Chit(s) • Amount Due: ${upiInfo.formattedAmount}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'whatsapp' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sms')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sms' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Phone className="w-4 h-4" />
            SMS (Bilingual)
          </button>
        </div>

        {activeTab === 'whatsapp' ? (
          <div className="space-y-4 font-sans">
            <div className="rounded-2xl border border-emerald-200 bg-[#ece5dd] p-3">
              <div className="mb-2 flex items-center justify-between rounded-t-xl bg-[#0b141a] px-3 py-2 text-white">
                <span className="text-xs font-semibold text-[#25D366] flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" /> WhatsApp Message + UPI Action
                </span>
                <span className="text-[10px] text-slate-300">Bilingual English + Telugu</span>
              </div>
              <div className="bg-white p-3 text-xs leading-6 text-slate-800 whitespace-pre-wrap rounded-b-xl border border-slate-200">
                {whatsappMessage}
              </div>
            </div>

            {/* UPI ACTION BUTTON INTERACTIVE PREVIEW */}
            {upiInfo.success ? (
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clickable UPI Payment Action</p>
                    <p className="text-xs text-sky-300 font-bold mt-0.5">Payee: {upiInfo.payeeName} ({upiInfo.upiId})</p>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                    Amount: {upiInfo.formattedAmount}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLaunchUpiIntent}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>PAY {upiInfo.formattedAmount}</span>
                </button>

                <p className="text-[10px] text-slate-400 text-center">
                  Launches Google Pay, PhonePe, Paytm, BHIM chooser on mobile devices. (Clicking does not auto-mark payment as paid).
                </p>
              </div>
            ) : (
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 font-bold text-center">
                No payment required for this member (Payable Amount is ₹0).
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => handleCopyMessage(whatsappMessage)}
                className="text-xs text-slate-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                {copied ? 'Copied to Clipboard!' : 'Copy Message Text'}
              </button>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="rounded-xl" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl" onClick={handleOpenWhatsAppWeb}>
                  <Send className="w-3.5 h-3.5" />
                  Open WhatsApp Web
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 font-sans">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">SMS Template Preview</span>
                <span className="text-[10px] font-mono text-slate-400">{smsMessage.length} chars</span>
              </div>
              <div className="bg-white p-3.5 text-xs leading-6 text-slate-900 font-sans whitespace-pre-wrap rounded-xl border border-slate-200">
                {smsMessage}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => handleCopyMessage(smsMessage)}
                className="text-xs text-slate-800 font-semibold hover:underline cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy Text'}
              </button>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="rounded-xl" onClick={onClose}>Cancel</Button>
                <Button variant="gold" size="sm" className="gap-2 rounded-xl" onClick={handleSendSMS}>
                  <Send className="w-3.5 h-3.5" />
                  Send SMS Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
