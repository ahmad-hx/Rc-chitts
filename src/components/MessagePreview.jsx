import React, { useState } from 'react';
import { getBilingualWhatsAppMessage } from '../services/messageFormatter';
import { Copy, Check, MessageSquare } from 'lucide-react';
import Button from './Button';

export default function MessagePreview({ member }) {
  const [copied, setCopied] = useState(false);
  
  if (!member) return null;

  const messageText = getBilingualWhatsAppMessage(member);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const rawPhone = member.whatsapp || member.phone || '';
    const digits = rawPhone.replace(/\D/g, '');
    const phoneNum = digits.startsWith('91') ? digits : `91${digits.replace(/^0/, '')}`;
    const encoded = encodeURIComponent(messageText);
    window.open(`https://wa.me/${phoneNum}?text=${encoded}`, '_blank');
  };

  return (
    <div className="border border-brand-border rounded-xl bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-100 px-4 py-3 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-navy-deep" />
          <span className="text-xs font-semibold text-brand-text-main">
            Bilingual WhatsApp Message Preview ({member.name})
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="text-brand-text-secondary hover:text-brand-text-main flex items-center gap-1.5 text-xs font-medium bg-white px-2.5 py-1 rounded border border-brand-border shadow-2xs transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-brand-success" />
              <span className="text-brand-success font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Body / Chat Bubble style */}
      <div className="p-4 max-h-[350px] overflow-y-auto bg-[#efeae2] relative">
        {/* Subtle WhatsApp style background pattern */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>
        <div className="bg-white rounded-lg shadow-xs p-4 relative z-10 max-w-full text-xs text-brand-text-main whitespace-pre-wrap font-mono leading-relaxed border-l-4 border-[#25D366]">
          {messageText}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-white border-t border-brand-border flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="gold" size="sm" onClick={handleSendWhatsApp}>
          Send WhatsApp
        </Button>
      </div>
    </div>
  );
}
