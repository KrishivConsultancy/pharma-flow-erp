// Quotation Print Preview Modal Controller
// Half-Page (A5) vs Full-Page (A4) toggle, WhatsApp share, PDF Export, & Convert to Sale Bill

import React, { useState, useEffect } from 'react';
import { Printer, Download, Share2, X, Minimize2, Maximize2, ShoppingCart } from 'lucide-react';
import { CompanyProfile, Quotation, QuotationItem } from '../../db/schema';
import { QuotationPrintTemplate } from './QuotationPrintTemplate';
import { toast } from '../../services/toastService';

interface QuotationPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  items: QuotationItem[];
  company: CompanyProfile;
  onConvertToSaleBill?: (quotation: Quotation) => void;
}

export const QuotationPrintModal: React.FC<QuotationPrintModalProps> = ({
  isOpen,
  onClose,
  quotation,
  items,
  company,
  onConvertToSaleBill,
}) => {
  const [layout, setLayout] = useState<'half' | 'full'>('half');

  useEffect(() => {
    if (items.length > 8) {
      setLayout('full');
    } else {
      setLayout('half');
    }
  }, [items]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !quotation) return null;

  const handleDownloadPdf = async () => {
    if ((window as any).electronAPI?.exportInvoicePdf) {
      try {
        const res = await (window as any).electronAPI.exportInvoicePdf({
          invoiceNo: quotation.quotation_no,
          isHalfPage: layout === 'half',
        });
        if (res.success) {
          toast.success(`Quotation PDF saved to:\n${res.filePath}`, { title: 'PDF Exported' });
        } else if (!res.cancelled) {
          toast.error(`Failed to save PDF: ${res.error}`);
        }
      } catch (err: any) {
        toast.error(`PDF export error: ${err.message}`);
      }
    } else {
      window.print();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const phone = (quotation.customer_phone || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;

    const itemLines = items
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.product_name} (${it.pack_size || ''}) x ${it.qty}${it.free_qty > 0 ? `+${it.free_qty}` : ''} @ Rs.${it.sale_rate.toFixed(2)} = Rs.${it.line_total.toFixed(2)}`
      )
      .join('\n');

    const msg =
      `*RADHA DRUGS - PRICE QUOTATION / RATE ESTIMATE*\n` +
      `Quotation No: *${quotation.quotation_no}*\n` +
      `Date: ${quotation.quotation_date}\n` +
      `Valid Until: ${quotation.valid_until_date || '15 Days'}\n` +
      `Customer: *${quotation.customer_name}*\n\n` +
      `*Estimated Items:*\n${itemLines}\n\n` +
      `Sub-Total: Rs. ${quotation.sub_total.toFixed(2)}\n` +
      `GST Tax: Rs. ${quotation.total_gst.toFixed(2)}\n` +
      `*ESTIMATED TOTAL: Rs. ${quotation.net_amount.toFixed(2)}*\n\n` +
      `_Note: Price estimate only. Stock confirmed upon order booking._\n` +
      `Pay Advance UPI: ${company.upi_id}\n` +
      `Radha Drugs, Begusarai | Phone: ${company.phone}`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-between overflow-hidden">
      {/* Top Floating Control Bar */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between text-white select-none">
        <div className="flex items-center space-x-3">
          <span className="font-extrabold text-sm uppercase tracking-wider text-amber-400">
            Quotation Preview [{quotation.quotation_no}]
          </span>
          <span className="text-xs text-slate-300 border-l border-slate-700 pl-3">
            {quotation.customer_name}
          </span>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-sm uppercase ${
              quotation.status === 'CONVERTED'
                ? 'bg-emerald-900 text-emerald-300'
                : quotation.status === 'EXPIRED'
                ? 'bg-rose-900 text-rose-300'
                : 'bg-amber-900 text-amber-300'
            }`}
          >
            {quotation.status}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Half vs Full Page Toggle */}
          <div className="flex bg-slate-800 rounded-sm p-0.5 border border-slate-700 mr-2 text-xs font-bold">
            <button
              onClick={() => setLayout('half')}
              className={`px-2.5 py-1 rounded-sm flex items-center space-x-1 transition-all ${
                layout === 'half' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>A5 Landscape</span>
            </button>
            <button
              onClick={() => setLayout('full')}
              className={`px-2.5 py-1 rounded-sm flex items-center space-x-1 transition-all ${
                layout === 'full' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>A4 Portrait</span>
            </button>
          </div>

          {/* 1-Click Convert to Sale Bill (if not already converted) */}
          {quotation.status !== 'CONVERTED' && onConvertToSaleBill && (
            <button
              onClick={() => onConvertToSaleBill(quotation)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-sm flex items-center space-x-1.5 shadow-sm transition-all"
              title="Convert this quotation into a live wholesale sale bill"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Convert to Bill [F1]</span>
            </button>
          )}

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-sm border border-slate-700 flex items-center space-x-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>PDF Export</span>
          </button>

          {/* WhatsApp Share */}
          <button
            onClick={handleWhatsAppShare}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-sm flex items-center space-x-1.5 transition-all"
          >
            <Share2 className="w-3.5 h-3.5 text-white" />
            <span>WhatsApp Share</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-sm flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Print (Ctrl+P)</span>
          </button>

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-sm ml-2 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Print View Area (Scrollable with zoom preview) */}
      <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-950/90">
        <div className="transform origin-top scale-95 shadow-2xl">
          <QuotationPrintTemplate
            company={company}
            quotation={quotation}
            items={items}
            layout={layout}
          />
        </div>
      </div>
    </div>
  );
};
