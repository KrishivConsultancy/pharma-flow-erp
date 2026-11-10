// True Wholesale Profit & Loss Engine, Monthly Sales Register & 1-Click CA GST Export Pack [F6]
// Precise profitability based on batch net landing cost and real-time GSTR-1 / GSTR-2B / HSN CSV generators

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  PieChart,
  Users,
  Boxes,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import { CompanyProfile, Sale, Purchase, ReturnAdjustment, Party } from '../db/schema';
import { CsvExportService } from '../services/csvExportService';

type ReportTabType = 'PL_STATEMENT' | 'SALES_REGISTER' | 'PURCHASE_REGISTER' | 'CA_PACK';

interface ReportsProfitLossPageProps {
  company: CompanyProfile;
}

export const ReportsProfitLossPage: React.FC<ReportsProfitLossPageProps> = ({ company }) => {
  const [activeTab, setActiveTab] = useState<ReportTabType>('PL_STATEMENT');
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [adjustments, setAdjustments] = useState<ReturnAdjustment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);

  // Date filters
  const [period, setPeriod] = useState<string>('ALL');

  const loadData = async () => {
    try {
      const allSales = await dbService.query<Sale>(`
        SELECT s.*, p.name as customer_name, p.gstin as customer_gstin, p.city as customer_city
        FROM sales s
        LEFT JOIN parties p ON s.customer_id = p.id
        ORDER BY s.sale_date DESC
      `);
      setSales(allSales);

      const allPurchases = await dbService.query<Purchase>(`
        SELECT p.*, pt.name as vendor_name, pt.gstin as vendor_gstin
        FROM purchases p
        LEFT JOIN parties pt ON p.vendor_id = pt.id
        ORDER BY p.invoice_date DESC
      `);
      setPurchases(allPurchases);

      const allAdj = await dbService.query<ReturnAdjustment>('SELECT * FROM returns_adjustments');
      setAdjustments(allAdj);

      const allParties = await dbService.query<Party>('SELECT * FROM parties');
      setParties(allParties);

      const allSaleItems = await dbService.query('SELECT * FROM sale_items');
      setSaleItems(allSaleItems);
    } catch (err) {
      console.error('Error loading reports data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(loadData);
    return unsub;
  }, []);

  // Compute True Wholesale P&L Numbers
  const grossSalesRevenue = sales.reduce((sum, s) => sum + s.sub_total, 0);
  const salesReturns = adjustments
    .filter((a) => a.adjustment_type === 'SALES_RETURN_CREDIT_NOTE')
    .reduce((sum, a) => sum + a.total_amount, 0);
  const netRevenue = grossSalesRevenue - salesReturns;

  const totalCostOfGoods = sales.reduce((sum, s) => sum + (s.total_cost_of_goods || 0), 0);
  const grossTradingProfit = netRevenue - totalCostOfGoods;
  const grossMarginPercent = netRevenue > 0 ? (grossTradingProfit / netRevenue) * 100 : 0;

  const expiryBreakageLosses = adjustments
    .filter((a) => a.adjustment_type === 'EXPIRY_BREAKAGE_WRITE_OFF')
    .reduce((sum, a) => sum + a.total_amount, 0);

  const netRealizedProfit = grossTradingProfit - expiryBreakageLosses;
  const netMarginPercent = netRevenue > 0 ? (netRealizedProfit / netRevenue) * 100 : 0;

  // Medicine-wise profit rankings
  const medicineProfitMap = new Map<string, { qty: number; revenue: number; cost: number; profit: number }>();
  for (const item of saleItems) {
    const name = item.product_name;
    const existing = medicineProfitMap.get(name) || { qty: 0, revenue: 0, cost: 0, profit: 0 };
    const cost = (item.qty + item.free_qty) * (item.net_landing_cost_snapshot || 0);
    existing.qty += item.qty;
    existing.revenue += item.taxable_amount;
    existing.cost += cost;
    existing.profit += item.line_profit || (item.taxable_amount - cost);
    medicineProfitMap.set(name, existing);
  }
  const topMedicines = Array.from(medicineProfitMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.profit - a.profit);

  // Customer-wise profit rankings
  const customerProfitMap = new Map<string, { bills: number; revenue: number; profit: number }>();
  for (const s of sales) {
    const custName = s.customer_name || 'RETAIL CHEMIST';
    const existing = customerProfitMap.get(custName) || { bills: 0, revenue: 0, profit: 0 };
    existing.bills += 1;
    existing.revenue += s.net_amount;
    existing.profit += s.net_profit || 0;
    customerProfitMap.set(custName, existing);
  }
  const topCustomers = Array.from(customerProfitMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.profit - a.profit);

  // CA Pack Export Triggers
  const handleExportGstr1 = () => {
    const csv = CsvExportService.generateGstr1Csv(sales, parties);
    CsvExportService.downloadCsv(csv, `Radha_Drugs_GSTR1_Sales_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  const handleExportHsn = () => {
    const csv = CsvExportService.generateHsnSummaryCsv(saleItems);
    CsvExportService.downloadCsv(csv, `Radha_Drugs_HSN_Summary_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  const handleExportGstr2b = () => {
    const csv = CsvExportService.generateGstr2bCsv(purchases, parties);
    CsvExportService.downloadCsv(csv, `Radha_Drugs_GSTR2B_Purchases_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-sky-600" />
            <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Financial P&amp;L Statements &amp; CA Tax Filing Pack [F6]
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Realized Trading Margin based on exact batch Net Landing Cost &amp; Indian GST return registers
          </p>
        </div>

        {/* 1-Click CA Pack Download Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportGstr1}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-sm shadow-sm flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>GSTR-1 CSV</span>
          </button>
          <button
            onClick={handleExportHsn}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-sm shadow-sm flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>HSN Summary CSV</span>
          </button>
          <button
            onClick={handleExportGstr2b}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-sm shadow-sm flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>GSTR-2B ITC CSV</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-1.5 rounded-sm shadow-sm flex space-x-2 text-xs font-bold">
        {[
          { id: 'PL_STATEMENT', label: 'True Wholesale P&L Statement', icon: TrendingUp },
          { id: 'SALES_REGISTER', label: `Outward Sales Register (${sales.length})`, icon: Receipt },
          { id: 'PURCHASE_REGISTER', label: `Inward Purchase Register (${purchases.length})`, icon: FileSpreadsheet },
          { id: 'CA_PACK', label: 'CA / GST Filing Export Hub', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTabType)}
              className={`px-3 py-2 rounded-sm border flex items-center space-x-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TRUE PROFIT & LOSS STATEMENT */}
      {activeTab === 'PL_STATEMENT' && (
        <div className="space-y-4">
          {/* Executive P&L Formula Breakdown Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 rounded-sm shadow-sm text-xs">
            <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white mb-3 pb-1 border-b border-slate-200 dark:border-slate-800">
              Formula Breakdown: Net Realized Profit Calculation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-sm">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">(+) Gross Sales Revenue</span>
                <span className="font-mono font-black text-lg text-slate-900 dark:text-white">
                  ₹{grossSalesRevenue.toFixed(2)}
                </span>
                <div className="text-[10px] text-slate-500 mt-1">
                  Excl. GST (GST Bills + Simple Memos)
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-sm">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">(-) Cost of Goods Sold</span>
                <span className="font-mono font-black text-lg text-rose-600">
                  ₹{totalCostOfGoods.toFixed(2)}
                </span>
                <div className="text-[10px] text-slate-500 mt-1">
                  Calculated with Free Scheme Benefits
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-sm">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">(=) Gross Trading Margin</span>
                <span className="font-mono font-black text-lg text-emerald-600">
                  ₹{grossTradingProfit.toFixed(2)} ({grossMarginPercent.toFixed(1)}%)
                </span>
                <div className="text-[10px] text-slate-500 mt-1">
                  Markup realized on wholesale sales
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-sm">
                <span className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300 block">
                  (=) Net Realized Profit
                </span>
                <span className="font-mono font-black text-xl text-emerald-700 dark:text-emerald-300">
                  ₹{netRealizedProfit.toFixed(2)} ({netMarginPercent.toFixed(1)}%)
                </span>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  After Expiry/Breakage Loss Deductions
                </div>
              </div>
            </div>
          </div>

          {/* Granular Tables: Bill-by-Bill, Top Medicines, Top Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Profit Medicines */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm p-3">
              <h3 className="font-black text-xs uppercase text-slate-800 dark:text-slate-200 mb-2 flex items-center space-x-1.5">
                <Boxes className="w-4 h-4 text-sky-600" />
                <span>Top Profit Generating Medicines</span>
              </h3>
              <table className="w-full text-left border-collapse table-dense text-xs">
                <thead>
                  <tr className="uppercase text-[10px] font-black text-slate-500">
                    <th>Medicine</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Revenue (₹)</th>
                    <th className="text-right">Profit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {topMedicines.slice(0, 8).map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="font-bold uppercase text-slate-900 dark:text-white truncate max-w-[160px]">
                        {m.name}
                      </td>
                      <td className="text-right font-mono">{m.qty}</td>
                      <td className="text-right font-mono">₹{m.revenue.toFixed(2)}</td>
                      <td className="text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                        ₹{m.profit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top Profit Chemist Customers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm p-3">
              <h3 className="font-black text-xs uppercase text-slate-800 dark:text-slate-200 mb-2 flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-sky-600" />
                <span>Top Profit Generating Clients / Chemists</span>
              </h3>
              <table className="w-full text-left border-collapse table-dense text-xs">
                <thead>
                  <tr className="uppercase text-[10px] font-black text-slate-500">
                    <th>Customer Name</th>
                    <th className="text-right">Bills</th>
                    <th className="text-right">Volume (₹)</th>
                    <th className="text-right">Net Margin (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {topCustomers.slice(0, 8).map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="font-bold uppercase text-slate-900 dark:text-white truncate max-w-[160px]">
                        {c.name}
                      </td>
                      <td className="text-right font-mono">{c.bills}</td>
                      <td className="text-right font-mono">₹{c.revenue.toFixed(2)}</td>
                      <td className="text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                        ₹{c.profit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OUTWARD SALES REGISTER */}
      {activeTab === 'SALES_REGISTER' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm p-3 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="font-black uppercase text-slate-700 dark:text-slate-300">
              All Outward Bills Register ({sales.length} Bills)
            </span>
            <button
              onClick={handleExportGstr1}
              className="px-3 py-1 bg-slate-800 text-white font-bold rounded-sm flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Sales CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse table-dense text-xs">
              <thead>
                <tr className="uppercase text-[10px] font-black text-slate-500">
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>GSTIN</th>
                  <th className="text-right">Taxable SubTotal</th>
                  <th className="text-right">Total GST</th>
                  <th className="text-right">Net Bill Amount</th>
                  <th className="text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="font-mono font-black text-slate-900 dark:text-white">{s.invoice_no}</td>
                    <td className="font-mono text-slate-500">{s.sale_date}</td>
                    <td>
                      <span className="font-bold text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded-sm">
                        {s.bill_type === 'GST_INVOICE' ? 'TAX INVOICE' : 'ESTIMATE'}
                      </span>
                    </td>
                    <td className="font-bold uppercase text-slate-900 dark:text-white">{s.customer_name}</td>
                    <td className="font-mono text-slate-500 text-[10px]">{s.customer_gstin || 'UNREGISTERED'}</td>
                    <td className="text-right font-mono">₹{s.sub_total.toFixed(2)}</td>
                    <td className="text-right font-mono">₹{s.total_gst.toFixed(2)}</td>
                    <td className="text-right font-mono font-black text-sky-700 dark:text-sky-400">
                      ₹{s.net_amount.toFixed(2)}
                    </td>
                    <td className="text-right font-mono font-bold text-emerald-600">
                      ₹{s.net_profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INWARD PURCHASE REGISTER */}
      {activeTab === 'PURCHASE_REGISTER' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm p-3 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="font-black uppercase text-slate-700 dark:text-slate-300">
              All Inward Invoices Register ({purchases.length} Bills)
            </span>
            <button
              onClick={handleExportGstr2b}
              className="px-3 py-1 bg-slate-800 text-white font-bold rounded-sm flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Purchases CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse table-dense text-xs">
              <thead>
                <tr className="uppercase text-[10px] font-black text-slate-500">
                  <th>Supplier Invoice</th>
                  <th>Date</th>
                  <th>Vendor Name</th>
                  <th>Supplier GSTIN</th>
                  <th>Tax Type</th>
                  <th className="text-right">Taxable SubTotal</th>
                  <th className="text-right">Total Tax (ITC)</th>
                  <th className="text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="font-mono font-black text-slate-900 dark:text-white">{p.supplier_invoice_no}</td>
                    <td className="font-mono text-slate-500">{p.invoice_date}</td>
                    <td className="font-bold uppercase text-slate-900 dark:text-white">{p.vendor_name}</td>
                    <td className="font-mono text-slate-500 text-[10px]">{p.vendor_gstin}</td>
                    <td className="font-bold text-[10px]">{p.tax_type}</td>
                    <td className="text-right font-mono">₹{p.sub_total.toFixed(2)}</td>
                    <td className="text-right font-mono">₹{(p.total_cgst + p.total_sgst + p.total_igst).toFixed(2)}</td>
                    <td className="text-right font-mono font-black text-indigo-700 dark:text-indigo-400">
                      ₹{p.grand_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CA / GST EXPORT HUB */}
      {activeTab === 'CA_PACK' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm p-4 text-xs space-y-4">
          <h2 className="font-black text-sm uppercase text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">
            Chartered Accountant (CA) Tax Filing &amp; GST Return Hub
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-sm space-y-2">
              <div className="font-black text-sm uppercase text-slate-900 dark:text-white">
                1. GSTR-1 Sales Register CSV
              </div>
              <p className="text-slate-500">
                Categorized B2B (with Recipient GSTIN) and B2CS (Unregistered) invoices with exact tax breakdown.
              </p>
              <button
                onClick={handleExportGstr1}
                className="w-full mt-2 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-sm shadow-sm flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download GSTR-1 CSV</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-sm space-y-2">
              <div className="font-black text-sm uppercase text-slate-900 dark:text-white">
                2. HSN-Wise Summary CSV
              </div>
              <p className="text-slate-500">
                Aggregated by HSN codes (3004, 3006, etc.) with UQC, Total Quantity, Taxable Value, and Tax amounts.
              </p>
              <button
                onClick={handleExportHsn}
                className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-sm shadow-sm flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download HSN Summary CSV</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-sm space-y-2">
              <div className="font-black text-sm uppercase text-slate-900 dark:text-white">
                3. GSTR-2B Input Tax Credit (ITC) CSV
              </div>
              <p className="text-slate-500">
                Inward vendor invoices with supplier GSTIN, Invoice No, Taxable amount, and eligible ITC claims.
              </p>
              <button
                onClick={handleExportGstr2b}
                className="w-full mt-2 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold rounded-sm shadow-sm flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download GSTR-2B CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
