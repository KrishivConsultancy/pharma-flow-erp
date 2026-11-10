// Dashboard & Command Center: 6 Giant Action Tiles + Live KPIs + 90-Day Expiry Radar + Shortage Book

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  ShoppingCart,
  Boxes,
  Users,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  CreditCard,
  IndianRupee,
  Calendar,
  Clock,
  Printer,
  FileText,
  ShieldAlert,
  ArrowRight,
  Package,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import { CompanyProfile, Sale, InventoryBatch, Party } from '../db/schema';
import { InvoicePrintModal } from '../components/print/InvoicePrintModal';

interface DashboardPageProps {
  company: CompanyProfile;
  onNavigate: (page: string, params?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ company, onNavigate }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<InventoryBatch[]>([]);
  const [shortageBatches, setShortageBatches] = useState<InventoryBatch[]>([]);

  // Print modal state
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<Sale | null>(null);
  const [saleItemsForPrint, setSaleItemsForPrint] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const allSales = await dbService.query<Sale>('SELECT * FROM sales ORDER BY sale_date DESC, created_at DESC');
      setSales(allSales);
      setRecentSales(allSales.slice(0, 5));

      const allParties = await dbService.query<Party>('SELECT * FROM parties');
      setParties(allParties);

      const allBatches = await dbService.query<InventoryBatch>(`
        SELECT b.*, m.name as medicine_name, m.pack_size, m.mfg_by, m.min_stock_alert, p.name as vendor_name
        FROM inventory_batches b
        LEFT JOIN medicines_master m ON b.medicine_id = m.id
        LEFT JOIN parties p ON b.last_vendor_id = p.id
        ORDER BY b.exp_date_iso ASC
      `);
      setBatches(allBatches);

      // 90-Day Expiry Radar
      const today = new Date().toISOString().substring(0, 10);
      const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      const expSoon = allBatches.filter((b) => b.exp_date_iso <= ninetyDays && b.available_qty > 0);
      setExpiringBatches(expSoon);

      // Shortage / Reorder book (stock <= min_stock_alert)
      const shortage = allBatches.filter((b) => b.available_qty <= (b.min_stock_alert || 20));
      setShortageBatches(shortage);
    } catch (err) {
      console.error('Error loading dashboard metrics:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(loadData);
    return unsub;
  }, []);

  // Compute live KPIs
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.net_amount, 0);
  const totalCostOfGoods = sales.reduce((sum, s) => sum + (s.total_cost_of_goods || 0), 0);
  const totalGrossProfit = sales.reduce((sum, s) => sum + (s.net_profit || 0), 0);

  const totalReceivables = parties
    .filter((p) => p.party_type === 'CUSTOMER' && p.current_balance > 0)
    .reduce((sum, p) => sum + p.current_balance, 0);

  const totalPayables = parties
    .filter((p) => p.party_type === 'VENDOR' && p.current_balance > 0)
    .reduce((sum, p) => sum + p.current_balance, 0);

  const stockValuationCost = batches.reduce(
    (sum, b) => sum + b.available_qty * (b.net_landing_cost || b.purchase_rate),
    0
  );
  const stockValuationMrp = batches.reduce((sum, b) => sum + b.available_qty * b.mrp, 0);

  const handleOpenPrint = async (sale: Sale) => {
    const items = await dbService.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    setSelectedSaleForPrint(sale);
    setSaleItemsForPrint(items);
    setPrintModalOpen(true);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-950">
      {/* Welcome Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wide">
              {company.company_name} • WHOLESALE DISTRIBUTION DESK
            </h1>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-sm border border-emerald-300 dark:border-emerald-700">
              FY {company.financial_year} Active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Offline-First Local SQLite Engine • All data safely persisted locally and backed up to Supabase Cloud.
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => onNavigate('sales')}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-sm shadow-md flex items-center space-x-1.5"
          >
            <Receipt className="w-4 h-4" />
            <span>Create Sale Bill [F1]</span>
          </button>
        </div>
      </div>

      {/* 6 GIANT ACTION TILES */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            title: 'New GST Bill',
            desc: 'Series T001157',
            shortcut: 'F1',
            color: 'bg-sky-600 hover:bg-sky-500',
            textColor: 'text-sky-400',
            icon: Receipt,
            action: () => onNavigate('sales', { mode: 'GST_INVOICE' }),
          },
          {
            title: 'Simple Bill',
            desc: 'Series S000101',
            shortcut: 'Alt+S',
            color: 'bg-emerald-700 hover:bg-emerald-600',
            textColor: 'text-emerald-400',
            icon: FileText,
            action: () => onNavigate('sales', { mode: 'SIMPLE_BILL' }),
          },
          {
            title: 'Inward Purchase',
            desc: 'Smart 3-Way Entry',
            shortcut: 'F2',
            color: 'bg-indigo-700 hover:bg-indigo-600',
            textColor: 'text-indigo-400',
            icon: ShoppingCart,
            action: () => onNavigate('purchase'),
          },
          {
            title: 'Batch Inventory',
            desc: 'FEFO Stock Valuation',
            shortcut: 'F3',
            color: 'bg-slate-800 hover:bg-slate-700',
            textColor: 'text-slate-300',
            icon: Boxes,
            action: () => onNavigate('inventory'),
          },
          {
            title: 'Parties & Khata',
            desc: 'Udhaar Directory',
            shortcut: 'F4',
            color: 'bg-purple-800 hover:bg-purple-700',
            textColor: 'text-purple-300',
            icon: Users,
            action: () => onNavigate('parties'),
          },
          {
            title: 'Return to Vendor',
            desc: 'Supplier Debit Note',
            shortcut: 'F5',
            color: 'bg-amber-700 hover:bg-amber-600',
            textColor: 'text-amber-300',
            icon: RotateCcw,
            action: () => onNavigate('returns'),
          },
        ].map((tile, i) => {
          const Icon = tile.icon;
          return (
            <button
              key={i}
              onClick={tile.action}
              className={`p-3 rounded-sm text-left text-white shadow-sm transition-all border border-black/20 flex flex-col justify-between h-24 ${tile.color}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-5 h-5 text-white/90" />
                <span className="font-mono text-[10px] font-black bg-black/30 px-1.5 py-0.5 rounded-sm">
                  {tile.shortcut}
                </span>
              </div>
              <div>
                <div className="font-black text-xs uppercase tracking-wide">{tile.title}</div>
                <div className="text-[10px] text-white/80">{tile.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 5 EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Sales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Sales Revenue
          </div>
          <div className="font-mono font-black text-xl text-sky-700 dark:text-sky-400 mt-1">
            ₹{totalSalesRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {sales.length} Bills ({sales.filter((s) => s.bill_type === 'GST_INVOICE').length} GST + {sales.filter((s) => s.bill_type === 'SIMPLE_BILL').length} Non-GST)
          </div>
        </div>

        {/* Customer Receivables (Udhaar) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Market Udhaar (Receivable)
          </div>
          <div className="font-mono font-black text-xl text-amber-700 dark:text-amber-400 mt-1">
            ₹{totalReceivables.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Owed by retail chemists &amp; clinics
          </div>
        </div>

        {/* Vendor Payables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Vendor Payables
          </div>
          <div className="font-mono font-black text-xl text-rose-700 dark:text-rose-400 mt-1">
            ₹{totalPayables.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Payable to Indizen, Patna Pharma, etc.
          </div>
        </div>

        {/* Stock Valuation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Stock Valuation (Cost)
          </div>
          <div className="font-mono font-black text-xl text-emerald-700 dark:text-emerald-400 mt-1">
            ₹{stockValuationCost.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            MRP Value: ₹{stockValuationMrp.toFixed(2)}
          </div>
        </div>

        {/* Net Trading Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Net Realized Profit
          </div>
          <div className="font-mono font-black text-xl text-emerald-800 dark:text-emerald-300 mt-1">
            ₹{totalGrossProfit.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Exact margin on Landing Cost
          </div>
        </div>
      </div>

      {/* TWO SPLIT PANELS: 90-Day Expiry Radar & Shortage Book */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: 90-Day Expiry Radar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex flex-col">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">
                90-Day Expiry Radar ({expiringBatches.length} Batches)
              </h2>
            </div>
            <button
              onClick={() => onNavigate('returns')}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center space-x-1"
            >
              <span>Debit Notes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 overflow-y-auto max-h-[260px] flex-1">
            {expiringBatches.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No batches expiring in the next 90 days. Stock is fresh!
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                    <th className="py-1 px-2">Medicine</th>
                    <th className="py-1 px-2">Batch</th>
                    <th className="py-1 px-2">Exp Date</th>
                    <th className="py-1 px-2 text-right">Qty</th>
                    <th className="py-1 px-2 text-right">Loss Value</th>
                    <th className="py-1 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {expiringBatches.map((b) => {
                    const isExp = b.exp_date_iso < new Date().toISOString().substring(0, 10);
                    const lossVal = b.available_qty * (b.net_landing_cost || b.purchase_rate);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 px-2 font-bold uppercase truncate max-w-[140px] text-slate-900 dark:text-white">
                          {b.medicine_name || b.id}
                        </td>
                        <td className="py-1.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-300">
                          {b.batch_no}
                        </td>
                        <td className="py-1.5 px-2 font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded-sm font-bold text-[10px] ${
                              isExp
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {b.exp_date_mm_yy} {isExp ? '(EXPIRED)' : ''}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-black">{b.available_qty}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-600">
                          ₹{lossVal.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            onClick={() => onNavigate('returns', { batchId: b.id })}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-sm"
                          >
                            Return Note
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel 2: Shortage Book / Reorder Alarm */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex flex-col">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-rose-600" />
              <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">
                Shortage Book / Reorder List ({shortageBatches.length} Items)
              </h2>
            </div>
            <button
              onClick={() => onNavigate('purchase')}
              className="text-[11px] font-bold text-rose-700 dark:text-rose-400 hover:underline flex items-center space-x-1"
            >
              <span>Purchase Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 overflow-y-auto max-h-[260px] flex-1">
            {shortageBatches.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                All medicines are well-stocked above reorder threshold!
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                    <th className="py-1 px-2">Medicine</th>
                    <th className="py-1 px-2 text-right">In Stock</th>
                    <th className="py-1 px-2 text-right">Min Alert</th>
                    <th className="py-1 px-2">Last Supplier</th>
                    <th className="py-1 px-2 text-right">Last Rate</th>
                    <th className="py-1 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {shortageBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-1.5 px-2 font-bold uppercase truncate max-w-[130px] text-slate-900 dark:text-white">
                        {b.medicine_name || b.id}
                      </td>
                      <td className="py-1.5 px-2 text-right font-black text-rose-600">
                        {b.available_qty}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-400">
                        {b.min_stock_alert || 20}
                      </td>
                      <td className="py-1.5 px-2 font-bold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                        {b.vendor_name || 'INDIZEN'}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{b.purchase_rate.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          onClick={() => onNavigate('purchase', { medicineId: b.medicine_id })}
                          className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold rounded-sm"
                        >
                          Reorder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* RECENT SALES INVOICES FEED */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm p-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-sky-600" />
            <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">
              Recent Wholesale Invoices
            </h2>
          </div>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
          >
            Go to Sales Billing &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase font-black text-[10px]">
                <th className="p-2">Invoice No</th>
                <th className="p-2">Type</th>
                <th className="p-2">Date</th>
                <th className="p-2">Customer Name</th>
                <th className="p-2 text-right">Taxable Sub-Total</th>
                <th className="p-2 text-right">GST Total</th>
                <th className="p-2 text-right">Net Bill Amount</th>
                <th className="p-2">Payment</th>
                <th className="p-2 text-center">Print Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {recentSales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-2 font-mono font-black text-slate-900 dark:text-white">
                    {s.invoice_no}
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-sm font-bold text-[10px] ${
                        s.bill_type === 'GST_INVOICE'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {s.bill_type === 'GST_INVOICE' ? 'TAX INVOICE' : 'SIMPLE MEMO'}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-slate-500">{s.sale_date}</td>
                  <td className="p-2 font-bold uppercase text-slate-900 dark:text-white">
                    {s.customer_name || 'KHUSHI MEDICO'}
                  </td>
                  <td className="p-2 text-right font-mono">₹{s.sub_total.toFixed(2)}</td>
                  <td className="p-2 text-right font-mono">₹{s.total_gst.toFixed(2)}</td>
                  <td className="p-2 text-right font-mono font-black text-sm text-sky-700 dark:text-sky-400">
                    ₹{s.net_amount.toFixed(2)}
                  </td>
                  <td className="p-2">
                    <span className="font-bold text-[10px] uppercase bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                      {s.payment_mode}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleOpenPrint(s)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-sm inline-flex items-center space-x-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Print [Ctrl+P]</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Print Modal */}
      {selectedSaleForPrint && (
        <InvoicePrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          sale={selectedSaleForPrint}
          items={saleItemsForPrint}
          company={company}
        />
      )}
    </div>
  );
};
