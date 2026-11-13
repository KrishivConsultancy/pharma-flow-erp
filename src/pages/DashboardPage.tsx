// Radha Drugs Wholesale ERP - Executive Command Center & Operations Radar [F8]
// Top-tier UI design, real-time KPI metrics, 90-day expiry radar, shortage book & live sales feed

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
  FileSpreadsheet,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ExternalLink,
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
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'CRITICAL' | 'EXPIRED'>('ALL');
  const [shortageFilter, setShortageFilter] = useState<'ALL' | 'ZERO' | 'LOW'>('ALL');

  // Print modal state
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<Sale | null>(null);
  const [saleItemsForPrint, setSaleItemsForPrint] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const allSales = await dbService.query<Sale>(
        'SELECT * FROM sales ORDER BY sale_date DESC, created_at DESC'
      );
      setSales(allSales);
      setRecentSales(allSales.slice(0, 8));

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

  // Compute Live KPIs
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.net_amount, 0);
  const totalGrossProfit = sales.reduce((sum, s) => sum + (s.net_profit || 0), 0);
  const profitMarginPercent = totalSalesRevenue > 0 ? (totalGrossProfit / totalSalesRevenue) * 100 : 0;

  const gstBillsCount = sales.filter((s) => s.bill_type === 'GST_INVOICE').length;
  const simpleBillsCount = sales.filter((s) => s.bill_type === 'SIMPLE_BILL').length;

  const totalReceivables = parties
    .filter((p) => p.party_type === 'CUSTOMER' && p.current_balance > 0)
    .reduce((sum, p) => sum + p.current_balance, 0);
  const customerDebtorsCount = parties.filter((p) => p.party_type === 'CUSTOMER' && p.current_balance > 0).length;

  const totalPayables = parties
    .filter((p) => p.party_type === 'VENDOR' && p.current_balance > 0)
    .reduce((sum, p) => sum + p.current_balance, 0);

  const stockValuationCost = batches.reduce(
    (sum, b) => sum + b.available_qty * (b.net_landing_cost || b.purchase_rate),
    0
  );
  const stockValuationMrp = batches.reduce((sum, b) => sum + b.available_qty * b.mrp, 0);
  const activeBatchesCount = batches.filter((b) => b.available_qty > 0).length;

  // Expiry Risk Calculation
  const expiryLossValue = expiringBatches.reduce(
    (sum, b) => sum + b.available_qty * (b.net_landing_cost || b.purchase_rate),
    0
  );

  const handleOpenPrint = async (sale: Sale) => {
    const items = await dbService.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    setSelectedSaleForPrint(sale);
    setSaleItemsForPrint(items);
    setPrintModalOpen(true);
  };

  // Filter Expiry Radar List
  const todayIso = new Date().toISOString().substring(0, 10);
  const thirtyDaysIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const filteredExpiringBatches = expiringBatches.filter((b) => {
    const isExpired = b.exp_date_iso < todayIso;
    const isCritical = b.exp_date_iso >= todayIso && b.exp_date_iso <= thirtyDaysIso;
    if (expiryFilter === 'EXPIRED') return isExpired;
    if (expiryFilter === 'CRITICAL') return isCritical;
    return true;
  });

  // Filter Shortage List
  const filteredShortageBatches = shortageBatches.filter((b) => {
    if (shortageFilter === 'ZERO') return b.available_qty === 0;
    if (shortageFilter === 'LOW') return b.available_qty > 0;
    return true;
  });

  const currentDateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-950 font-sans text-xs">
      {/* 1. TOP EXECUTIVE GREETING & COMMAND STRIP */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3.5 rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-3 select-none">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide">
              {company.company_name} • Command Center
            </h1>
            <span className="bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-extrabold px-2 py-0.5 rounded-sm border border-sky-300 dark:border-sky-800 text-[10.5px]">
              FY {company.financial_year} Active
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-2">
            <span>{currentDateFormatted}</span>
            <span>•</span>
            <span>Wholesale Pharma Operations • Begusarai, Bihar</span>
          </p>
        </div>

        {/* Action Quick Launch Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('quotations')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-sm shadow-sm flex items-center space-x-1.5 transition-all"
            title="Create Price Quotation (F9)"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>New Quotation [F9]</span>
          </button>

          <button
            onClick={() => onNavigate('sales')}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-sm shadow-md flex items-center space-x-1.5 transition-all"
            title="Create Wholesale GST Tax Invoice (F1)"
          >
            <Receipt className="w-4 h-4 text-white" />
            <span>New Sale Bill [F1]</span>
          </button>
        </div>
      </div>

      {/* 2. TOP 6 EXECUTIVE KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Total Sales Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Gross Sales</span>
              <Receipt className="w-4 h-4 text-sky-600" />
            </div>
            <div className="font-mono font-black text-xl text-sky-700 dark:text-sky-400 mt-1 tabular-nums">
              ₹{totalSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span>{sales.length} Bills</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {gstBillsCount} GST / {simpleBillsCount} Memo
            </span>
          </div>
        </div>

        {/* Card 2: Market Udhaar (Receivable) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Market Udhaar</span>
              <Users className="w-4 h-4 text-amber-600" />
            </div>
            <div className="font-mono font-black text-xl text-amber-700 dark:text-amber-400 mt-1 tabular-nums">
              ₹{totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span>Receivable</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{customerDebtorsCount} Chemists</span>
          </div>
        </div>

        {/* Card 3: Vendor Payables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Vendor Payables</span>
              <ShoppingCart className="w-4 h-4 text-rose-600" />
            </div>
            <div className="font-mono font-black text-xl text-rose-700 dark:text-rose-400 mt-1 tabular-nums">
              ₹{totalPayables.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span>To Suppliers</span>
            <span className="font-semibold text-rose-700 dark:text-rose-400">Indizen / Patna</span>
          </div>
        </div>

        {/* Card 4: Net Realized Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Net Realized Profit</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-mono font-black text-xl text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
              ₹{totalGrossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span>Landing Margin</span>
            <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
              {profitMarginPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Card 5: Warehouse Stock Valuation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Stock Valuation</span>
              <Boxes className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="font-mono font-black text-xl text-indigo-700 dark:text-indigo-400 mt-1 tabular-nums">
              ₹{stockValuationCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span>MRP: ₹{stockValuationMrp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="font-mono font-bold">{activeBatchesCount} Batches</span>
          </div>
        </div>

        {/* Card 6: 90-Day Expiry Risk */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">90-Day Expiry Risk</span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="font-mono font-black text-xl text-rose-700 dark:text-rose-400 mt-1 tabular-nums">
              ₹{expiryLossValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <span className="text-rose-600 font-bold">{expiringBatches.length} At-Risk Batches</span>
            <button
              onClick={() => onNavigate('returns')}
              className="text-sky-600 dark:text-sky-400 hover:underline font-bold"
            >
              Return &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 3. FAST ACTION LAUNCHPAD (7 HIGH-CONTRAST TILES) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {[
          {
            title: 'Sales Bill',
            desc: 'Series T001157',
            shortcut: 'F1',
            color: 'bg-sky-600 hover:bg-sky-500 border-sky-500',
            icon: Receipt,
            action: () => onNavigate('sales', { mode: 'GST_INVOICE' }),
          },
          {
            title: 'Quotations',
            desc: 'Zero Stock Memo',
            shortcut: 'F9',
            color: 'bg-amber-600 hover:bg-amber-500 border-amber-500',
            icon: FileSpreadsheet,
            action: () => onNavigate('quotations'),
          },
          {
            title: 'Purchase Inward',
            desc: 'Scheme 100+20 Math',
            shortcut: 'F2',
            color: 'bg-indigo-700 hover:bg-indigo-600 border-indigo-600',
            icon: ShoppingCart,
            action: () => onNavigate('purchase'),
          },
          {
            title: 'Stock Batches',
            desc: 'FEFO Inventory',
            shortcut: 'F3',
            color: 'bg-slate-800 hover:bg-slate-700 border-slate-700',
            icon: Boxes,
            action: () => onNavigate('inventory'),
          },
          {
            title: 'Parties & Khata',
            desc: 'Customer Udhaar',
            shortcut: 'F4',
            color: 'bg-purple-800 hover:bg-purple-700 border-purple-700',
            icon: Users,
            action: () => onNavigate('parties'),
          },
          {
            title: 'Debit Notes',
            desc: 'Supplier Returns',
            shortcut: 'F5',
            color: 'bg-rose-700 hover:bg-rose-600 border-rose-600',
            icon: RotateCcw,
            action: () => onNavigate('returns'),
          },
          {
            title: 'P&L Reports',
            desc: 'GSTR CA Pack',
            shortcut: 'F6',
            color: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-600',
            icon: BarChart3,
            action: () => onNavigate('reports'),
          },
        ].map((tile, i) => {
          const Icon = tile.icon;
          return (
            <button
              key={i}
              onClick={tile.action}
              className={`p-3 rounded-sm text-left text-white shadow-sm transition-all border flex flex-col justify-between h-22 select-none group transform hover:-translate-y-0.5 ${tile.color}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-4 h-4 text-white/90 group-hover:scale-110 transition-transform" />
                <span className="font-mono text-[9px] font-black bg-black/35 px-1.5 py-0.5 rounded border border-white/20">
                  {tile.shortcut}
                </span>
              </div>
              <div>
                <div className="font-black text-xs uppercase tracking-wide leading-tight">{tile.title}</div>
                <div className="text-[10px] text-white/80 leading-tight mt-0.5">{tile.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. SPLIT OPERATIONAL GRIDS: 90-Day Expiry Radar & Shortage Book */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: 90-Day Expiry Radar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex flex-col contain-layout-unit">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between select-none">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h2 className="font-extrabold text-xs uppercase text-slate-900 dark:text-white">
                90-Day Expiry Radar ({expiringBatches.length} Batches)
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1 text-[10px] font-bold">
              {(['ALL', 'CRITICAL', 'EXPIRED'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExpiryFilter(mode)}
                  className={`px-2 py-0.5 rounded-sm transition-all ${
                    expiryFilter === mode
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 overflow-y-auto max-h-[250px] flex-1">
            {filteredExpiringBatches.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                No batches matching this expiry filter. Stock is secure!
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                    <th className="py-1 px-2">Medicine</th>
                    <th className="py-1 px-2">Batch</th>
                    <th className="py-1 px-2">Expiry</th>
                    <th className="py-1 px-2 text-right">Qty</th>
                    <th className="py-1 px-2 text-right">Capital at Risk</th>
                    <th className="py-1 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredExpiringBatches.map((b) => {
                    const isExp = b.exp_date_iso < todayIso;
                    const lossVal = b.available_qty * (b.net_landing_cost || b.purchase_rate);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 px-2 font-bold uppercase truncate max-w-[150px] text-slate-900 dark:text-white">
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
                            {b.exp_date_mm_yy} {isExp ? '(EXP)' : ''}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {b.available_qty}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          ₹{lossVal.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            onClick={() => onNavigate('returns', { batchId: b.id })}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-sm shadow-xs"
                            title="Generate Supplier Debit Note"
                          >
                            Debit Note
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

        {/* Panel 2: Critical Stock Shortage & Reorder Book */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex flex-col contain-layout-unit">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between select-none">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-rose-600" />
              <h2 className="font-extrabold text-xs uppercase text-slate-900 dark:text-white">
                Shortage Book ({shortageBatches.length} Items)
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1 text-[10px] font-bold">
              {(['ALL', 'ZERO', 'LOW'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setShortageFilter(mode)}
                  className={`px-2 py-0.5 rounded-sm transition-all ${
                    shortageFilter === mode
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {mode === 'ALL' ? 'ALL' : mode === 'ZERO' ? '0 STOCK' : 'LOW'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 overflow-y-auto max-h-[250px] flex-1">
            {filteredShortageBatches.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                All medicines are well-stocked above reorder threshold!
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                    <th className="py-1 px-2">Medicine</th>
                    <th className="py-1 px-2 text-right">Stock</th>
                    <th className="py-1 px-2 text-right">Threshold</th>
                    <th className="py-1 px-2">Last Vendor</th>
                    <th className="py-1 px-2 text-right">Purchase Rate</th>
                    <th className="py-1 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredShortageBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-1.5 px-2 font-bold uppercase truncate max-w-[140px] text-slate-900 dark:text-white">
                        {b.medicine_name || b.id}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-black text-rose-600 dark:text-rose-400">
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
                          className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold rounded-sm shadow-xs"
                          title="Generate Inward Purchase Order"
                        >
                          Reorder [F2]
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

      {/* 5. RECENT SALES INVOICES FEED */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm p-3.5 contain-layout-unit">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-2 select-none">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-sky-600" />
            <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">
              Recent Wholesale Invoices &amp; Counter Activity
            </h2>
          </div>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
          >
            <span>Open Sales Billing Desk [F1]</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase font-black text-[10px]">
                <th className="p-2">Invoice No</th>
                <th className="p-2">Type</th>
                <th className="p-2">Date</th>
                <th className="p-2">Customer / Pharmacy</th>
                <th className="p-2 text-right">Taxable Sub-Total</th>
                <th className="p-2 text-right">GST Total</th>
                <th className="p-2 text-right">Net Bill Amount</th>
                <th className="p-2">Payment Mode</th>
                <th className="p-2 text-center">Print Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No sales recorded yet. Press F1 to bill your first customer.
                  </td>
                </tr>
              ) : (
                recentSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2 font-mono font-black text-sky-700 dark:text-sky-400">
                      {s.invoice_no}
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded-sm font-extrabold text-[9.5px] uppercase border ${
                          s.bill_type === 'GST_INVOICE'
                            ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {s.bill_type === 'GST_INVOICE' ? 'TAX INVOICE' : 'SIMPLE MEMO'}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-slate-500">{s.sale_date}</td>
                    <td className="p-2 font-bold uppercase text-slate-900 dark:text-white">
                      {s.customer_name || 'Counter Customer'}
                    </td>
                    <td className="p-2 text-right font-mono">₹{s.sub_total.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">₹{s.total_gst.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono font-black text-sm text-slate-900 dark:text-white">
                      ₹{s.net_amount.toFixed(2)}
                    </td>
                    <td className="p-2">
                      <span
                        className={`font-bold text-[9.5px] uppercase px-1.5 py-0.5 rounded-sm border ${
                          s.payment_mode === 'CREDIT'
                            ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {s.payment_mode}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleOpenPrint(s)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-sm inline-flex items-center space-x-1 shadow-xs transition-colors"
                      >
                        <Printer className="w-3 h-3 text-sky-400" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
