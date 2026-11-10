// Pixel-Exact Radha Drugs GST Tax Invoice Print Template
// Matches real printed invoice T001156 with razor-sharp 1px wireframe borders

import React from 'react';
import { CompanyProfile, Sale, SaleItem } from '../../db/schema';
import { numberToWordsInr } from '../../services/numberToWords';

interface GstTaxInvoiceTemplateProps {
  company: CompanyProfile;
  sale: Sale;
  items: SaleItem[];
  layout: 'half' | 'full'; // 'half' = Half-page Landscape, 'full' = Full-page Portrait
}

export const GstTaxInvoiceTemplate: React.FC<GstTaxInvoiceTemplateProps> = ({
  company,
  sale,
  items,
  layout,
}) => {
  const isInterState = sale.tax_type === 'INTER_STATE';

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
    slabs[rate].cgst += item.cgst_amount;
    slabs[rate].sgst += item.sgst_amount;
    slabs[rate].igst += item.igst_amount;
    slabs[rate].totalGst += item.cgst_amount + item.sgst_amount + item.igst_amount;
  }

  // Active slabs that have taxable > 0
  const activeSlabs = Object.entries(slabs).filter(([_, data]) => data.taxable > 0);

  // Total Due calculation (Previous balance + Net amount of this bill)
  const totalDue = (sale.customer_previous_balance || 0) + sale.net_amount;

  // Format date to DD/MM/YYYY
  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    const [y, m, d] = isoStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // UPI QR String
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
        <div className="text-[11px] font-bold tracking-widest">MAA</div>
        <div className="text-[14px] font-extrabold uppercase underline tracking-wider">
          TAX INVOICE
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

        {/* Right Box (38%): Seller Licenses & GSTIN */}
        <div className="w-[38%] p-2 text-[11px] font-bold flex flex-col justify-center space-y-1">
          <div>GSTIN : <span className="font-extrabold">{company.gstin}</span></div>
          <div>FSSAI NO. : <span>{company.fssai_no || 'N/A'}</span></div>
          <div>D.L.No. : <span className="font-extrabold">{company.dl_no}</span></div>
          <div>Valid upto : <span>{company.dl_valid_upto ? formatDate(company.dl_valid_upto) : '06/02/2029'}</span></div>
        </div>
      </div>

      {/* 3. MIDDLE 2-COLUMN BUYER & INVOICE META BOX */}
      <div className="border-x border-b border-black flex">
        {/* Left Box (62%): Buyer Details */}
        <div className="w-[62%] border-r border-black p-2">
          <div className="text-[13px] font-black uppercase flex items-baseline">
            <span className="font-normal text-[11px] mr-1">To, M/s</span>
            <span>{sale.customer_name || 'CASH SALE'}</span>
          </div>
          <div className="text-[11px] font-medium uppercase mt-0.5 min-h-[16px]">
            {sale.customer_address || 'BEGUSARAI, BIHAR'}
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold mt-1.5 pt-1 border-t border-dotted border-gray-400">
            <div>D.L.No. : <span className="font-extrabold">{sale.customer_dl_no || 'N/A'}</span></div>
            <div>GSTIN. : <span className="font-extrabold">{sale.customer_gstin || 'UNREGISTERED'}</span></div>
          </div>
        </div>

        {/* Right Box (38%): Invoice Meta */}
        <div className="w-[38%] p-2 text-[11px] font-bold flex flex-col justify-center space-y-1.5">
          <div className="flex justify-between">
            <span>Inv. No. :</span>
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

      {/* 4. LINE ITEMS TABLE (15 Columns) */}
      <div className="border-x border-b border-black">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="border-b border-black text-[9.5px] font-black uppercase bg-gray-50">
              <th className="py-1 px-0.5 border-r border-black w-[24px]">SN</th>
              <th className="py-1 px-1 border-r border-black text-left">PRODUCT NAME</th>
              <th className="py-1 px-0.5 border-r border-black w-[58px]">HSN CODE</th>
              <th className="py-1 px-0.5 border-r border-black w-[45px]">PACK</th>
              <th className="py-1 px-0.5 border-r border-black w-[40px]">MFG</th>
              <th className="py-1 px-0.5 border-r border-black w-[65px]">BATCH</th>
              <th className="py-1 px-0.5 border-r border-black w-[40px]">EXP.</th>
              <th className="py-1 px-0.5 border-r border-black w-[32px]">QTY</th>
              <th className="py-1 px-0.5 border-r border-black w-[28px]">FREE</th>
              <th className="py-1 px-0.5 border-r border-black w-[46px]">M.R.P.</th>
              <th className="py-1 px-0.5 border-r border-black w-[46px]">RATE</th>
              <th className="py-1 px-0.5 border-r border-black w-[30px]">DIS%</th>
              {isInterState ? (
                <th className="py-1 px-0.5 border-r border-black w-[36px]">IGST%</th>
              ) : (
                <>
                  <th className="py-1 px-0.5 border-r border-black w-[32px]">CGST%</th>
                  <th className="py-1 px-0.5 border-r border-black w-[32px]">SGST%</th>
                </>
              )}
              <th className="py-1 px-1 w-[68px] text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="text-[10px] font-semibold divide-y divide-gray-300">
            {items.map((it, idx) => (
              <tr key={it.id || idx} className="hover:bg-gray-50">
                <td className="py-1 px-0.5 border-r border-black">{idx + 1}</td>
                <td className="py-1 px-1 border-r border-black text-left font-bold uppercase truncate max-w-[170px]">
                  {it.product_name}
                </td>
                <td className="py-1 px-0.5 border-r border-black text-[9px]">{it.hsn_code || '3004'}</td>
                <td className="py-1 px-0.5 border-r border-black text-[9px] uppercase">{it.pack_size}</td>
                <td className="py-1 px-0.5 border-r border-black text-[9px] uppercase">{it.mfg_by}</td>
                <td className="py-1 px-0.5 border-r border-black font-mono text-[9px]">{it.batch_no}</td>
                <td className="py-1 px-0.5 border-r border-black font-mono text-[9px]">{it.exp_date_mm_yy}</td>
                <td className="py-1 px-0.5 border-r border-black font-bold">{it.qty}</td>
                <td className="py-1 px-0.5 border-r border-black">{it.free_qty || 0}</td>
                <td className="py-1 px-0.5 border-r border-black font-mono">{it.mrp.toFixed(2)}</td>
                <td className="py-1 px-0.5 border-r border-black font-mono font-bold">{it.sale_rate.toFixed(2)}</td>
                <td className="py-1 px-0.5 border-r border-black font-mono">{it.discount_percent ? it.discount_percent.toFixed(1) : '0'}</td>
                {isInterState ? (
                  <td className="py-1 px-0.5 border-r border-black font-mono">{it.igst_percent.toFixed(1)}</td>
                ) : (
                  <>
                    <td className="py-1 px-0.5 border-r border-black font-mono">{it.cgst_percent.toFixed(2)}</td>
                    <td className="py-1 px-0.5 border-r border-black font-mono">{it.sgst_percent.toFixed(2)}</td>
                  </>
                )}
                <td className="py-1 px-1 text-right font-mono font-black">{it.taxable_amount.toFixed(2)}</td>
              </tr>
            ))}

            {/* Minimum rows padding for half-page view if fewer than 5 items */}
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
                  <td className="border-r border-black">&nbsp;</td>
                  <td className="border-r border-black">&nbsp;</td>
                  {!isInterState && <td className="border-r border-black">&nbsp;</td>}
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

      {/* 6. LOWER SPLIT BOX: GST SLAB + TERMS (Left) & TOTALS + SIGNATORY (Right) */}
      <div className="border-x border-b border-black flex">
        {/* Left Side (62% width) */}
        <div className="w-[62%] border-r border-black p-1.5 flex flex-col justify-between">
          <div>
            {/* GST Slab Table */}
            <div className="mb-1">
              <table className="w-full text-center border border-black text-[9px] border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-black font-bold uppercase">
                    <th className="py-0.5 border-r border-black">GST%</th>
                    <th className="py-0.5 border-r border-black">On Rs.</th>
                    {!isInterState ? (
                      <>
                        <th className="py-0.5 border-r border-black">SGST</th>
                        <th className="py-0.5 border-r border-black">CGST</th>
                      </>
                    ) : (
                      <th className="py-0.5 border-r border-black">IGST</th>
                    )}
                    <th className="py-0.5">TOTAL GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-semibold">
                  {activeSlabs.length > 0 ? (
                    activeSlabs.map(([slabRate, sData]) => (
                      <tr key={slabRate}>
                        <td className="py-0.5 border-r border-black font-bold">{slabRate}%</td>
                        <td className="py-0.5 border-r border-black font-mono">{sData.taxable.toFixed(2)}</td>
                        {!isInterState ? (
                          <>
                            <td className="py-0.5 border-r border-black font-mono">{sData.sgst.toFixed(2)}</td>
                            <td className="py-0.5 border-r border-black font-mono">{sData.cgst.toFixed(2)}</td>
                          </>
                        ) : (
                          <td className="py-0.5 border-r border-black font-mono">{sData.igst.toFixed(2)}</td>
                        )}
                        <td className="py-0.5 font-mono font-bold">{sData.totalGst.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-0.5 border-r border-black font-bold">5%</td>
                      <td className="py-0.5 border-r border-black font-mono">{sale.sub_total.toFixed(2)}</td>
                      {!isInterState ? (
                        <>
                          <td className="py-0.5 border-r border-black font-mono">{sale.total_sgst.toFixed(2)}</td>
                          <td className="py-0.5 border-r border-black font-mono">{sale.total_cgst.toFixed(2)}</td>
                        </>
                      ) : (
                        <td className="py-0.5 border-r border-black font-mono">{sale.total_igst.toFixed(2)}</td>
                      )}
                      <td className="py-0.5 font-mono font-bold">{sale.total_gst.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Previous Balance Banner */}
            <div className="border border-black py-0.5 px-1 text-[9.5px] font-bold flex justify-between bg-gray-50 mb-1">
              <span>YOUR LAST BAL. : ₹ <span className="font-black">{(sale.customer_previous_balance || 0).toFixed(2)}</span></span>
              <span>CURRENT BILL : ₹ <span className="font-black">{sale.net_amount.toFixed(2)}</span></span>
              <span>TOTAL DUE : ₹ <span className="font-black">{totalDue.toFixed(2)}</span></span>
            </div>

            {/* 4 Numbered Drug Act Warranty Clauses */}
            <div className="text-[7.5px] leading-tight text-gray-700 space-y-0.5">
              <div>1. Goods once sold can not be taken back.</div>
              <div>2. Please check the goods at the time of taking delivery.</div>
              <div>3. On strength of warranty obtained by us, we hereby give warranty that the goods sold under this invoice do not contravene the provisions of section 18 of the Drug Act, 1940.</div>
              <div>4. In case of any inadvertent error in price charged, please bring this invoice for rectification. ALL SUBJECT TO BEGUSARAI JURISDICTION.</div>
            </div>
          </div>
        </div>

        {/* Right Side (38% width): Totals & Signatory */}
        <div className="w-[38%] p-1.5 flex flex-col justify-between">
          <div className="space-y-1 text-[11px] font-bold">
            <div className="flex justify-between border-b border-gray-300 pb-0.5">
              <span>TOTAL AMOUNT :</span>
              <span className="font-mono font-black">{sale.sub_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-0.5">
              <span>ADD GST :</span>
              <span className="font-mono font-bold text-gray-900">{sale.total_gst.toFixed(2)}</span>
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

          {/* Bottom Right Signatory + UPI QR */}
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
