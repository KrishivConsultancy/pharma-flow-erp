// Clean Non-GST Estimate / Cash Memo Print Template
// Series S000101 for Unregistered Rural Doctors and Non-GST Retailers

import React from 'react';
import { CompanyProfile, Sale, SaleItem } from '../../db/schema';
import { numberToWordsInr } from '../../services/numberToWords';

interface SimpleBillTemplateProps {
  company: CompanyProfile;
  sale: Sale;
  items: SaleItem[];
  layout: 'half' | 'full';
}

export const SimpleBillTemplate: React.FC<SimpleBillTemplateProps> = ({
  company,
  sale,
  items,
  layout,
}) => {
  const totalDue = (sale.customer_previous_balance || 0) + sale.net_amount;

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    const [y, m, d] = isoStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(
    `upi://pay?pa=${company.upi_id}&pn=${encodeURIComponent(company.company_name)}&am=${sale.net_amount}&cu=INR`
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
        <div className="text-[11px] font-bold tracking-widest">SHREE GANESHAYA NAMAH</div>
        <div className="text-[14px] font-extrabold uppercase underline tracking-wider">
          ESTIMATE / CASH MEMO
        </div>
      </div>

      {/* 2. UPPER 2-COLUMN BOX */}
      <div className="border border-black flex">
        {/* Left Box (62%): Seller Profile */}
        <div className="w-[62%] border-r border-black p-2 text-center flex flex-col justify-center">
          <div className="text-[19px] font-black uppercase tracking-wider">{company.company_name}</div>
          <div className="text-[11px] font-bold italic">{company.tagline}</div>
          <div className="text-[11px] font-semibold uppercase">{company.address_line1}</div>
          <div className="text-[12px] font-bold uppercase">{company.city_district}</div>
          <div className="text-[11px] font-bold mt-0.5">Phone : {company.phone}</div>
        </div>

        {/* Right Box (38%): Seller Licenses */}
        <div className="w-[38%] p-2 text-[11px] font-bold flex flex-col justify-center space-y-1">
          <div>D.L.No. : <span className="font-extrabold">{company.dl_no}</span></div>
          <div>Valid upto : <span>{company.dl_valid_upto ? formatDate(company.dl_valid_upto) : '06/02/2029'}</span></div>
          <div className="text-gray-600 font-semibold text-[10px]">Supply of Non-GST Pharma Products</div>
        </div>
      </div>

      {/* 3. MIDDLE 2-COLUMN BUYER & INVOICE META BOX */}
      <div className="border-x border-b border-black flex">
        {/* Left Box (62%): Buyer Details */}
        <div className="w-[62%] border-r border-black p-2">
          <div className="text-[13px] font-black uppercase flex items-baseline">
            <span className="font-normal text-[11px] mr-1">To, M/s / Dr.</span>
            <span>{sale.customer_name || 'CASH MEMO'}</span>
          </div>
          <div className="text-[11px] font-medium uppercase mt-0.5 min-h-[16px]">
            {sale.customer_address || 'BEGUSARAI, BIHAR'}
          </div>
          <div className="text-[10px] font-bold mt-1.5 pt-1 border-t border-dotted border-gray-400">
            Reg / Phone : <span className="font-bold">{sale.customer_phone || sale.customer_dl_no || 'UNREGISTERED CLIENT'}</span>
          </div>
        </div>

        {/* Right Box (38%): Invoice Meta */}
        <div className="w-[38%] p-2 text-[11px] font-bold flex flex-col justify-center space-y-1.5">
          <div className="flex justify-between">
            <span>Bill No. :</span>
            <span className="font-black text-[13px]">{sale.invoice_no}</span>
          </div>
          <div className="flex justify-between">
            <span>Date :</span>
            <span className="font-extrabold">{formatDate(sale.sale_date)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-700">
            <span>Payment Mode:</span>
            <span className="font-bold uppercase">{sale.payment_mode}</span>
          </div>
        </div>
      </div>

      {/* 4. LINE ITEMS TABLE (Clean Simple Non-GST Columns) */}
      <div className="border-x border-b border-black">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="border-b border-black text-[10px] font-black uppercase bg-gray-50">
              <th className="py-1 px-1 border-r border-black w-[28px]">SN</th>
              <th className="py-1 px-1.5 border-r border-black text-left">ITEM NAME / MEDICINE</th>
              <th className="py-1 px-1 border-r border-black w-[60px]">PACK</th>
              <th className="py-1 px-1 border-r border-black w-[50px]">MFG</th>
              <th className="py-1 px-1 border-r border-black w-[75px]">BATCH NO</th>
              <th className="py-1 px-1 border-r border-black w-[50px]">EXP.</th>
              <th className="py-1 px-1 border-r border-black w-[40px]">QTY</th>
              <th className="py-1 px-1 border-r border-black w-[35px]">FREE</th>
              <th className="py-1 px-1 border-r border-black w-[55px]">M.R.P.</th>
              <th className="py-1 px-1 border-r border-black w-[55px]">RATE</th>
              <th className="py-1 px-1 border-r border-black w-[40px]">DIS%</th>
              <th className="py-1 px-1.5 w-[80px] text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="text-[10.5px] font-semibold divide-y divide-gray-300">
            {items.map((it, idx) => (
              <tr key={it.id || idx} className="hover:bg-gray-50">
                <td className="py-1 px-1 border-r border-black">{idx + 1}</td>
                <td className="py-1 px-1.5 border-r border-black text-left font-bold uppercase truncate max-w-[200px]">
                  {it.product_name}
                </td>
                <td className="py-1 px-1 border-r border-black uppercase text-[9.5px]">{it.pack_size}</td>
                <td className="py-1 px-1 border-r border-black uppercase text-[9.5px]">{it.mfg_by}</td>
                <td className="py-1 px-1 border-r border-black font-mono text-[10px]">{it.batch_no}</td>
                <td className="py-1 px-1 border-r border-black font-mono text-[10px]">{it.exp_date_mm_yy}</td>
                <td className="py-1 px-1 border-r border-black font-bold">{it.qty}</td>
                <td className="py-1 px-1 border-r border-black">{it.free_qty || 0}</td>
                <td className="py-1 px-1 border-r border-black font-mono">{it.mrp.toFixed(2)}</td>
                <td className="py-1 px-1 border-r border-black font-mono font-bold">{it.sale_rate.toFixed(2)}</td>
                <td className="py-1 px-1 border-r border-black font-mono">{it.discount_percent ? it.discount_percent.toFixed(1) : '0'}</td>
                <td className="py-1 px-1.5 text-right font-mono font-black">{it.line_total.toFixed(2)}</td>
              </tr>
            ))}

            {layout === 'half' && items.length < 4 && (
              Array.from({ length: 4 - items.length }).map((_, i) => (
                <tr key={`pad-${i}`} className="h-[22px]">
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 5. AMOUNT IN WORDS BANNER */}
      <div className="border-x border-b border-black py-1 px-2 text-[10.5px] font-black uppercase bg-gray-50 flex items-center justify-between">
        <div>{numberToWordsInr(sale.net_amount)}</div>
        <div className="text-[9px] text-gray-600 font-semibold">E. &amp; O.E.</div>
      </div>

      {/* 6. LOWER SPLIT BOX */}
      <div className="border-x border-b border-black flex">
        {/* Left Side (62%): Khata Previous Bal + Note */}
        <div className="w-[62%] border-r border-black p-2 flex flex-col justify-between">
          <div>
            <div className="border border-black py-1 px-1.5 text-[10.5px] font-bold flex justify-between bg-gray-50 mb-2">
              <span>YOUR LAST BAL. : ₹ <span className="font-black">{(sale.customer_previous_balance || 0).toFixed(2)}</span></span>
              <span>THIS MEMO : ₹ <span className="font-black">{sale.net_amount.toFixed(2)}</span></span>
              <span>TOTAL DUE : ₹ <span className="font-black">{totalDue.toFixed(2)}</span></span>
            </div>
            <div className="text-[8.5px] leading-tight text-gray-700 space-y-1">
              <div>* Goods once sold cannot be returned or exchanged.</div>
              <div>* All disputes are strictly subject to Begusarai Jurisdiction only.</div>
              <div>* Thank you for your continued partnership with Radha Drugs!</div>
            </div>
          </div>
        </div>

        {/* Right Side (38%): Totals & Signatory */}
        <div className="w-[38%] p-2 flex flex-col justify-between">
          <div className="space-y-1 text-[11px] font-bold">
            <div className="flex justify-between border-b border-gray-300 pb-0.5">
              <span>SUB TOTAL :</span>
              <span className="font-mono font-black">{sale.sub_total.toFixed(2)}</span>
            </div>
            {sale.bill_discount_amount > 0 && (
              <div className="flex justify-between border-b border-gray-300 pb-0.5 text-red-600">
                <span>DISCOUNT :</span>
                <span className="font-mono font-bold">-{sale.bill_discount_amount.toFixed(2)}</span>
              </div>
            )}
            {sale.other_adjustment !== 0 && (
              <div className="flex justify-between border-b border-gray-300 pb-0.5 text-gray-700">
                <span>OTH ADJ :</span>
                <span className="font-mono font-bold">{sale.other_adjustment.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-black pt-1 text-[14px]">
              <span className="font-extrabold uppercase">NET AMOUNT :</span>
              <span className="font-mono font-black text-[16px]">₹ {sale.net_amount.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-dotted border-gray-400 mt-2 flex items-end justify-between">
            <div className="flex flex-col items-center">
              <img
                src={upiQrUrl}
                alt="UPI QR"
                className="w-[58px] h-[58px] border border-gray-300 p-0.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-[7.5px] font-bold text-gray-600 mt-0.5">Scan to Pay UPI</span>
            </div>

            <div className="text-right">
              <div className="text-[9px] font-bold uppercase">For, {company.company_name}</div>
              <div className="h-6"></div>
              <div className="text-[9px] font-bold border-t border-black pt-0.5">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
