// Radha Drugs - Wholesale Pharmaceutical Quotation / Rate Estimate Print Template
// Pixel-exact print layout matching wholesale trade standards with Half-page (A5) & Full-page (A4) support

import React from 'react';
import { CompanyProfile, Quotation, QuotationItem } from '../../db/schema';
import { numberToWordsInr } from '../../services/numberToWords';

interface QuotationPrintTemplateProps {
  company: CompanyProfile;
  quotation: Quotation;
  items: QuotationItem[];
  layout: 'half' | 'full'; // 'half' = A5 Landscape, 'full' = A4 Portrait
}

export const QuotationPrintTemplate: React.FC<QuotationPrintTemplateProps> = ({
  company,
  quotation,
  items,
  layout,
}) => {
  const isInterState = quotation.tax_type === 'INTER_STATE';

  // Compute GST Slab Breakdowns (5%, 12%, 18%)
  const slabs: Record<number, { taxable: number; cgst: number; sgst: number; igst: number; totalGst: number }> = {
    5: { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 },
    12: { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 },
    18: { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 },
  };

  for (const item of items) {
    const rate = Math.round(item.gst_percent);
    if (!slabs[rate]) {
      slabs[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 };
    }
    slabs[rate].taxable += item.taxable_amount;
    slabs[rate].cgst += item.cgst_amount || 0;
    slabs[rate].sgst += item.sgst_amount || 0;
    slabs[rate].igst += item.igst_amount || 0;
    slabs[rate].totalGst += (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
  }

  const activeSlabs = Object.entries(slabs).filter(([_, data]) => data.taxable > 0);

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(
    `upi://pay?pa=${company.upi_id}&pn=${encodeURIComponent(company.company_name)}&am=${quotation.net_amount}&cu=INR`
  )}`;

  return (
    <div
      className={`bg-white text-black font-sans leading-tight print-container ${
        layout === 'half' ? 'w-[210mm] min-h-[148mm] max-h-[148mm]' : 'w-[210mm] min-h-[297mm]'
      } p-3 mx-auto box-border border border-black`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 1. TOP HEADER STRIP */}
      <div className="text-center pb-1">
        <div className="text-[11px] font-bold tracking-widest text-slate-700">SHREE GANESHAYA NAMAH</div>
        <div className="text-[15px] font-black uppercase underline tracking-wider text-slate-900">
          PRICE QUOTATION / RATE ESTIMATE
        </div>
        <div className="text-[9.5px] font-bold uppercase text-rose-700 tracking-wider">
          * ESTIMATE MEMO ONLY - NOT A GST TAX INVOICE - NO STOCK DEDUCTED *
        </div>
      </div>

      {/* 2. UPPER 2-COLUMN SELLER BOX */}
      <div className="border border-black flex">
        {/* Left Box (62%): Seller Profile */}
        <div className="w-[62%] border-r border-black p-2 text-center flex flex-col justify-center">
          <div className="text-[20px] font-black uppercase tracking-wider text-slate-900">{company.company_name}</div>
          <div className="text-[11px] font-bold italic text-slate-700">{company.tagline}</div>
          <div className="text-[11px] font-semibold uppercase">{company.address_line1}</div>
          <div className="text-[12px] font-bold uppercase">{company.city_district} ({company.state_name || 'BIHAR'})</div>
          <div className="text-[11px] font-bold mt-0.5">
            Phone : <span className="font-mono">{company.phone}</span>
          </div>
        </div>

        {/* Right Box (38%): Seller Licenses & GST */}
        <div className="w-[38%] p-2 text-[11px] font-bold flex flex-col justify-center space-y-1">
          <div>GSTIN : <span className="font-mono font-black text-[12px]">{company.gstin}</span></div>
          <div>D.L.No. : <span className="font-mono font-extrabold">{company.dl_no}</span></div>
          <div>Valid upto : <span>{company.dl_valid_upto ? formatDate(company.dl_valid_upto) : '06/02/2029'}</span></div>
          {company.fssai_no && (
            <div>FSSAI No. : <span className="font-mono">{company.fssai_no}</span></div>
          )}
          <div className="text-sky-800 font-bold text-[10px] uppercase">
            Status: <span className="underline">{quotation.status}</span>
          </div>
        </div>
      </div>

      {/* 3. MIDDLE 2-COLUMN BUYER & QUOTATION META BOX */}
      <div className="border-x border-b border-black flex">
        {/* Left Box (62%): Buyer Details */}
        <div className="w-[62%] border-r border-black p-2">
          <div className="text-[13px] font-black uppercase flex items-baseline">
            <span className="font-normal text-[11px] mr-1">To, M/s / Dr.</span>
            <span>{quotation.customer_name || 'VALUED CLIENT'}</span>
          </div>
          <div className="text-[11px] font-medium uppercase mt-0.5 min-h-[16px]">
            {quotation.customer_address || 'BEGUSARAI, BIHAR'}
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10.5px] font-bold mt-1.5 pt-1 border-t border-dotted border-gray-400">
            <div>
              GSTIN : <span className="font-mono">{quotation.customer_gstin || 'UNREGISTERED'}</span>
            </div>
            <div>
              D.L. No : <span className="font-mono">{quotation.customer_dl_no || 'NA'}</span>
            </div>
          </div>
          <div className="text-[10px] font-bold text-gray-700">
            Phone / Contact : <span className="font-mono">{quotation.customer_phone || 'NA'}</span>
          </div>
        </div>

        {/* Right Box (38%): Quotation Meta */}
        <div className="w-[38%] p-2 text-[11px] font-bold flex flex-col justify-center space-y-1.5">
          <div className="flex justify-between">
            <span>Quotation No. :</span>
            <span className="font-mono font-black text-[13px]">{quotation.quotation_no}</span>
          </div>
          <div className="flex justify-between">
            <span>Quote Date :</span>
            <span className="font-mono">{formatDate(quotation.quotation_date)}</span>
          </div>
          <div className="flex justify-between">
            <span>Valid Until :</span>
            <span className="font-mono text-emerald-800">{quotation.valid_until_date ? formatDate(quotation.valid_until_date) : '15 Days'}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Supply Type :</span>
            <span className="font-mono">{isInterState ? 'INTER-STATE (IGST)' : 'INTRA-STATE (CGST+SGST)'}</span>
          </div>
          {quotation.converted_invoice_no && (
            <div className="flex justify-between text-[10px] text-emerald-700">
              <span>Converted Bill :</span>
              <span className="font-mono font-bold">{quotation.converted_invoice_no}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. MAIN ITEM PARTICULARS TABLE */}
      <table className="w-full border-x border-b border-black border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black font-extrabold text-center bg-gray-100 uppercase">
            <th className="border-r border-black w-[4%] py-1">#</th>
            <th className="border-r border-black w-[30%] py-1 text-left px-1.5">Product Description</th>
            <th className="border-r border-black w-[8%] py-1">Pack</th>
            <th className="border-r border-black w-[9%] py-1">Batch</th>
            <th className="border-r border-black w-[8%] py-1">Exp.</th>
            <th className="border-r border-black w-[6%] py-1">Qty</th>
            <th className="border-r border-black w-[5%] py-1">Free</th>
            <th className="border-r border-black w-[7%] py-1 text-right px-1">MRP</th>
            <th className="border-r border-black w-[8%] py-1 text-right px-1">Quoted Rate</th>
            <th className="border-r border-black w-[5%] py-1">Dis%</th>
            <th className="border-r border-black w-[5%] py-1">GST%</th>
            <th className="w-[9%] py-1 text-right px-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || idx} className="border-b border-gray-300 text-center font-medium">
              <td className="border-r border-black py-1 font-mono">{idx + 1}</td>
              <td className="border-r border-black py-1 text-left px-1.5 font-bold uppercase truncate max-w-[200px]">
                {item.product_name}
                {item.mfg_by && <span className="text-[8.5px] text-gray-600 block font-normal">{item.mfg_by}</span>}
              </td>
              <td className="border-r border-black py-1 font-mono uppercase">{item.pack_size || '-'}</td>
              <td className="border-r border-black py-1 font-mono font-semibold">{item.batch_no || 'TBD'}</td>
              <td className="border-r border-black py-1 font-mono">{item.exp_date_mm_yy || '-'}</td>
              <td className="border-r border-black py-1 font-mono font-bold">{item.qty}</td>
              <td className="border-r border-black py-1 font-mono">{item.free_qty > 0 ? item.free_qty : '-'}</td>
              <td className="border-r border-black py-1 text-right px-1 font-mono">{item.mrp.toFixed(2)}</td>
              <td className="border-r border-black py-1 text-right px-1 font-mono font-bold">{item.sale_rate.toFixed(2)}</td>
              <td className="border-r border-black py-1 font-mono">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
              <td className="border-r border-black py-1 font-mono font-semibold">{item.gst_percent}%</td>
              <td className="py-1 text-right px-1 font-mono font-bold">{item.line_total.toFixed(2)}</td>
            </tr>
          ))}

          {/* Blank row filler for layout consistency */}
          {items.length < (layout === 'half' ? 5 : 12) &&
            Array.from({ length: (layout === 'half' ? 5 : 12) - items.length }).map((_, i) => (
              <tr key={`fill-${i}`} className="border-b border-gray-200 text-transparent select-none">
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1">-</td>
                <td className="py-1">-</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* 5. BOTTOM SECTION: Slabs & Bank (Left 62%) vs Totals & Words (Right 38%) */}
      <div className="border-x border-b border-black flex">
        {/* Left Box (62%): GST Slabs Breakdown, Bank Info & UPI QR */}
        <div className="w-[62%] border-r border-black p-2 flex flex-col justify-between">
          <div>
            {/* GST Slab Table */}
            <div className="text-[9px] font-black uppercase tracking-wider mb-1 text-slate-800">
              Tax Classification Breakdown
            </div>
            <table className="w-full border border-black text-[9px] text-center">
              <thead>
                <tr className="bg-gray-100 font-extrabold border-b border-black">
                  <th className="border-r border-black py-0.5">GST Rate</th>
                  <th className="border-r border-black py-0.5">Taxable Val</th>
                  {!isInterState ? (
                    <>
                      <th className="border-r border-black py-0.5">CGST</th>
                      <th className="border-r border-black py-0.5">SGST</th>
                    </>
                  ) : (
                    <th className="border-r border-black py-0.5">IGST</th>
                  )}
                  <th className="py-0.5">Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {activeSlabs.map(([rate, d]) => (
                  <tr key={rate} className="border-b border-gray-300 font-mono">
                    <td className="border-r border-black py-0.5 font-bold">{rate}%</td>
                    <td className="border-r border-black py-0.5">{d.taxable.toFixed(2)}</td>
                    {!isInterState ? (
                      <>
                        <td className="border-r border-black py-0.5">{d.cgst.toFixed(2)}</td>
                        <td className="border-r border-black py-0.5">{d.sgst.toFixed(2)}</td>
                      </>
                    ) : (
                      <td className="border-r border-black py-0.5">{d.igst.toFixed(2)}</td>
                    )}
                    <td className="py-0.5 font-bold">{d.totalGst.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bank Account Details & UPI QR Code */}
          <div className="flex items-center justify-between border-t border-black pt-2 mt-2">
            <div className="text-[10px] space-y-0.5">
              <div className="font-extrabold uppercase text-slate-800">Bank Details for Order Confirmation:</div>
              <div>Bank: <span className="font-bold">{company.bank_name}</span></div>
              <div>A/C No: <span className="font-mono font-extrabold">{company.bank_account_no}</span></div>
              <div>IFSC: <span className="font-mono font-bold">{company.bank_ifsc}</span></div>
              <div>UPI ID: <span className="font-mono font-bold">{company.upi_id}</span></div>
            </div>

            {company.upi_id && (
              <div className="flex flex-col items-center pl-2">
                <img src={upiQrUrl} alt="UPI QR" className="w-16 h-16 border border-black p-0.5" />
                <span className="text-[8px] font-bold uppercase mt-0.5">Scan to Pay Advance</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Box (38%): Totals, Round off, Net Amount & Signatory */}
        <div className="w-[38%] p-2 flex flex-col justify-between">
          <div className="space-y-1 text-[11px] font-bold">
            <div className="flex justify-between">
              <span>Items Total (Sub-Total):</span>
              <span className="font-mono">₹{quotation.sub_total.toFixed(2)}</span>
            </div>
            {quotation.bill_discount_amount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Special Scheme Discount:</span>
                <span className="font-mono">-₹{quotation.bill_discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total GST Tax:</span>
              <span className="font-mono">₹{quotation.total_gst.toFixed(2)}</span>
            </div>
            {quotation.other_adjustment !== 0 && (
              <div className="flex justify-between">
                <span>Other Adjustments:</span>
                <span className="font-mono">₹{quotation.other_adjustment.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>Round Off:</span>
              <span className="font-mono">{quotation.round_off >= 0 ? `+${quotation.round_off.toFixed(2)}` : quotation.round_off.toFixed(2)}</span>
            </div>

            {/* Net Estimated Total */}
            <div className="border-t-2 border-b-2 border-black py-1 flex justify-between text-[13px] font-black bg-slate-100 px-1 mt-1">
              <span>ESTIMATED TOTAL:</span>
              <span className="font-mono">₹{quotation.net_amount.toFixed(2)}</span>
            </div>

            <div className="text-[9.5px] italic font-semibold text-gray-800 pt-0.5">
              Rupees: {numberToWordsInr(quotation.net_amount)}
            </div>
          </div>

          {/* Signatory Box */}
          <div className="border-t border-black pt-2 mt-3 text-right">
            <div className="text-[10px] font-extrabold uppercase">For {company.company_name}</div>
            <div className="h-9"></div>
            <div className="text-[9px] font-bold text-gray-600">Authorized Signatory / Quotation Desk</div>
          </div>
        </div>
      </div>

      {/* 6. TERMS & FOOTER */}
      <div className="border-x border-b border-black p-1.5 text-[8.5px] font-medium text-gray-700 space-y-0.5">
        <div className="font-bold text-[9px] text-black">Terms &amp; Conditions of Estimate:</div>
        <div>1. Prices, taxes, and schemes indicated are valid strictly up to the validity date mentioned above.</div>
        <div>2. Physical batch availability is subject to prior sales and confirmation at the time of final order placement.</div>
        <div>3. To convert this quotation into an official wholesale GST Tax Invoice, contact Radha Drugs billing desk.</div>
        <div>4. Subject to Begusarai jurisdiction only. E. &amp; O.E.</div>
      </div>
    </div>
  );
};
