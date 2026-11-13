// Invoice Print Preview Modal Controller
// Supports Half-Page Landscape (A5) vs Full-Page Portrait (A4) toggle, WhatsApp share, & Print

import React, { useState, useEffect } from 'react';
import { Printer, Download, Share2, X, FileText, Minimize2, Maximize2 } from 'lucide-react';
import { CompanyProfile, Sale, SaleItem } from '../../db/schema';
import { GstTaxInvoiceTemplate } from './GstTaxInvoiceTemplate';
import { SimpleBillTemplate } from './SimpleBillTemplate';
import { toast } from '../../services/toastService';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  items: SaleItem[];
  company: CompanyProfile;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  sale,
  items,
  company,
}) => {
  const [layout, setLayout] = useState<'half' | 'full'>('half');

  useEffect(() => {
    // If invoice has more than 8 items, default to full page portrait
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

  if (!isOpen || !sale) return null;

  const handleDownloadPdf = async () => {
    if ((window as any).electronAPI?.exportInvoicePdf) {
      try {
        const res = await (window as any).electronAPI.exportInvoicePdf({
          invoiceNo: sale.invoice_no,
          isHalfPage: layout === 'half',
        });
        if (res.success) {
          toast.success(`Invoice PDF saved to:\n${res.filePath}`, { title: 'PDF Exported' });
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
    const phone = (sale.customer_phone || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;

    // Build itemized WhatsApp message
    const itemLines = items.map((it, idx) => `${idx + 1}. ${it.product_name} (${it.batch_no}) x ${it.qty} = Rs.${it.taxable_amount.toFixed(2)}`).join('\n');
    const msg = `*RADHA DRUGS - INVOICE*\n` +
      `Bill No: *${sale.invoice_no}*\n` +
      `Date: ${sale.sale_date}\n` +
      `Customer: ${sale.customer_name}\n\n` +
      `*Items:*\n${itemLines}\n\n` +
      `*Bill Total: Rs. ${sale.net_amount.toFixed(2)}*\n` +
      `Previous Due: Rs. ${(sale.customer_previous_balance || 0).toFixed(2)}\n` +
      `*Total Outstanding: Rs. ${((sale.customer_previous_balance || 0) + sale.net_amount).toFixed(2)}*\n\n` +
      `Pay via UPI: ${company.upi_id}\n` +
      `Contact: ${company.phone}`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-between overflow-hidden">
      {/* Top Toolbar (Non-printable) */}
      <div className="no-print bg-slate-900 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between text-white shadow-lg">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-base tracking-wide">
            Print Preview: <span className="text-sky-300">{sale.invoice_no}</span> ({sale.customer_name})
          </span>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-sm border border-slate-600">
            {sale.bill_type === 'GST_INVOICE' ? 'GST Tax Invoice' : 'Simple Non-GST Bill'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Layout Toggle */}
          <div className="bg-slate-800 p-0.5 rounded-sm flex items-center border border-slate-700 mr-2 text-xs font-semibold">
            <button
              onClick={() => setLayout('half')}
              className={`px-3 py-1 flex items-center space-x-1 transition-colors ${
                layout === 'half' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Half-Page (A5 Landscape)</span>
            </button>
            <button
              onClick={() => setLayout('full')}
              className={`px-3 py-1 flex items-center space-x-1 transition-colors ${
                layout === 'full' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full-Page (A4 Portrait)</span>
            </button>
          </div>

          {/* WhatsApp Share */}
          <button
            onClick={handleWhatsAppShare}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-sm flex items-center space-x-1.5 transition-colors border border-emerald-500 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-sm flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-sm flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
            <kbd className="ml-1 bg-sky-800 px-1 py-0.2 rounded text-[10px]">Ctrl+P</kbd>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-sm transition-colors border border-slate-700"
            title="Close [Esc]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Print Stage */}
      <div className="flex-1 overflow-auto p-6 flex justify-center items-start bg-slate-800/60 print:bg-white print:p-0">
        <div id="printable-invoice-area" className="bg-white shadow-2xl print:shadow-none print:w-full">
          {sale.bill_type === 'GST_INVOICE' ? (
            <GstTaxInvoiceTemplate company={company} sale={sale} items={items} layout={layout} />
          ) : (
            <SimpleBillTemplate company={company} sale={sale} items={items} layout={layout} />
          )}
        </div>
      </div>

      {/* Bottom Hint Strip (Non-printable) */}
      <div className="no-print bg-slate-900 border-t border-slate-800 px-4 py-1.5 text-center text-xs text-slate-400">
        Tip: For Dot Matrix or Thermal printing, select Half-Page Landscape. Press <kbd className="bg-slate-800 text-slate-300 px-1 rounded border border-slate-700">Ctrl + P</kbd> to print or <kbd className="bg-slate-800 text-slate-300 px-1 rounded border border-slate-700">Esc</kbd> to return to billing.
      </div>
    </div>
  );
};
