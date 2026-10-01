import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { MessageSquare, Send, CheckCircle2, CreditCard, Copy } from 'lucide-react';
import { getBilingualWhatsAppMessage } from '../services/messageFormatter';
import { generateUpiPayLink } from '../services/upiService';
import { useBillingMonth } from '../context/BillingMonthContext';

export default function MemberMessageModal({ isOpen, onClose, member, onSent, groupPaymentSettings = {}, chits = [] }) {
  const [copied, setCopied] = useState(false);
  const { selectedMonth } = useBillingMonth();

  if (!member) return null;

  const upiInfo = generateUpiPayLink({ member, groupPaymentSettings });
  const activeChits = (member.chits || []).filter((c) => (c.status ? c.status === 'ACTIVE' : true));

  const whatsappMessage = getBilingualWhatsAppMessage(member, groupPaymentSettings, selectedMonth, '15th of Month', chits);

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

  const handleCopyMessage = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`WhatsApp Message: ${member.name}`}
      subtitle={`Member Phone: ${member.phone} • ${activeChits.length} Active Chit(s) • Total Due: ${upiInfo.formattedAmount}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 font-sans">
        {/* UPI PAY ACTION BANNER */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#F7F8F7] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#111111]">
              <CreditCard className="w-4 h-4 text-[#285F52]" />
              <span>Instant UPI Payment Action</span>
            </div>
            <span className="text-sm font-black text-[#111111] font-sans">{upiInfo.formattedAmount}</span>
          </div>

          <button
            type="button"
            onClick={handleLaunchUpiIntent}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#285F52] hover:bg-[#214D43] px-4 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
          >
            <CreditCard className="w-4 h-4 text-white" />
            <span>{upiInfo.isMobile ? 'Open GPay / PhonePe / PayTM' : 'Copy Desktop UPI Intent Link'}</span>
          </button>
        </div>

        {/* BILINGUAL WHATSAPP MESSAGE BOX */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">WhatsApp Payment Reminder Template</span>
            <button
              type="button"
              onClick={() => handleCopyMessage(whatsappMessage)}
              className="text-xs font-bold text-[#285F52] hover:text-[#214D43] flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F7F8F7] p-4 text-xs font-sans leading-relaxed text-[#111111] whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">
            {whatsappMessage}
          </div>
        </div>

        {/* MODAL ACTIONS */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
          <Button variant="secondary" size="sm" onClick={onClose} className="rounded-xl border-[#E5E7EB] text-[#111111]">
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenWhatsAppWeb}
            className="gap-2 rounded-xl bg-[#285F52] hover:bg-[#214D43] text-white cursor-pointer font-bold"
          >
            <Send className="w-4 h-4" />
            Open in WhatsApp Web
          </Button>
        </div>
      </div>
    </Modal>
  );
}
