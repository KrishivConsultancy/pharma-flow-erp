// Batch Inventory & Stock Valuation Engine [F3]
// 4 Instant Filter Tabs: Active Batches, Shortage Book, Expiring Soon, and Expired Stock

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Filter,
  Download,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Building2,
  Package,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import { InventoryBatch, CompanyProfile } from '../db/schema';
import { CsvExportService } from '../services/csvExportService';

type TabType = 'ALL' | 'SHORTAGE' | 'EXPIRING' | 'EXPIRED';

interface InventoryBatchesPageProps {
  company: CompanyProfile;
  onNavigate: (page: string, params?: any) => void;
}

export const InventoryBatchesPage: React.FC<InventoryBatchesPageProps> = ({
  company,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  const loadBatches = async () => {
    try {
      const data = await dbService.query<InventoryBatch>(`
        SELECT b.*, m.name as medicine_name, m.pack_size, m.mfg_by, m.hsn_code, m.min_stock_alert, p.name as vendor_name
        FROM inventory_batches b
        LEFT JOIN medicines_master m ON b.medicine_id = m.id
        LEFT JOIN parties p ON b.last_vendor_id = p.id
        ORDER BY b.exp_date_iso ASC
      `);
      setBatches(data);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  useEffect(() => {
    loadBatches();
    const unsub = dbService.subscribe(loadBatches);
    return unsub;
  }, []);

  const todayIso = new Date().toISOString().substring(0, 10);
  const ninetyDaysIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  // Filter batches based on tab and search
  const filteredBatches = batches.filter((b) => {
    // Search filter
    const matchesSearch =
      (b.medicine_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.batch_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.mfg_by || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.vendor_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'SHORTAGE') {
      return b.available_qty <= (b.min_stock_alert || 20);
    } else if (activeTab === 'EXPIRING') {
      return b.exp_date_iso >= todayIso && b.exp_date_iso <= ninetyDaysIso && b.available_qty > 0;
    } else if (activeTab === 'EXPIRED') {
      return b.exp_date_iso < todayIso && b.available_qty > 0;
    }
    return true;
  });

  // Stock Valuations
  const totalValuationCost = filteredBatches.reduce(
    (sum, b) => sum + b.available_qty * (b.net_landing_cost || b.purchase_rate),
    0
  );
  const totalValuationMrp = filteredBatches.reduce(
    (sum, b) => sum + b.available_qty * b.mrp,
    0
  );

  const handleExportCsv = () => {
    const csv = CsvExportService.generateStockValuationCsv(filteredBatches);
    const dateStr = new Date().toISOString().substring(0, 10);
    CsvExportService.downloadCsv(csv, `Radha_Drugs_Stock_Valuation_${dateStr}.csv`);
  };

  const handleToggleSelectBatch = (id: string) => {
    const next = new Set(selectedBatchIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBatchIds(next);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* 1. TOP HEADER & VALUATION CARDS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Boxes className="w-5 h-5 text-sky-600" />
            <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Batch-Wise Inventory &amp; Expiry Radar [F3]
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            FEFO Tracking • Landing Cost Valuation • Automated Supplier Debit Note generator
          </p>
        </div>

        {/* Valuation Badges */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-sm">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Stock Valuation (Cost)</span>
            <span className="font-mono font-black text-sm text-sky-700 dark:text-sky-300">
              ₹{totalValuationCost.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-sm">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Stock Valuation (MRP)</span>
            <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
              ₹{totalValuationMrp.toFixed(2)}
            </span>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-sm flex items-center space-x-1.5 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export Stock CSV</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER TABS & SEARCH BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2 rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* 4 Instant Tabs */}
        <div className="flex space-x-1">
          {[
            { id: 'ALL', label: `All Batches (${batches.length})`, color: 'bg-sky-600' },
            {
              id: 'SHORTAGE',
              label: `Shortage Reorder (${batches.filter((b) => b.available_qty <= (b.min_stock_alert || 20)).length})`,
              color: 'bg-rose-600',
            },
            {
              id: 'EXPIRING',
              label: `Expiring Soon (${batches.filter((b) => b.exp_date_iso >= todayIso && b.exp_date_iso <= ninetyDaysIso && b.available_qty > 0).length})`,
              color: 'bg-amber-600',
            },
            {
              id: 'EXPIRED',
              label: `Expired Stock (${batches.filter((b) => b.exp_date_iso < todayIso && b.available_qty > 0).length})`,
              color: 'bg-red-700',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3 py-1.5 font-bold uppercase rounded-sm border transition-colors ${
                activeTab === tab.id
                  ? `${tab.color} text-white border-transparent shadow-sm`
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex-1 max-w-sm flex items-center border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 rounded-sm">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Medicine, Batch, Mfg, Vendor..."
            className="w-full bg-transparent border-none outline-none text-xs font-semibold"
          />
        </div>
      </div>

      {/* 3. BATCHES DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse table-dense">
            <thead>
              <tr className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                <th className="w-8 text-center">#</th>
                <th className="min-w-[180px]">Medicine Name</th>
                <th className="w-20">Pack</th>
                <th className="w-16">Mfg</th>
                <th className="w-24">Batch No</th>
                <th className="w-24">Exp (MM/YY)</th>
                <th className="w-20 text-right">Available Qty</th>
                <th className="w-24 text-right">MRP (₹)</th>
                <th className="w-24 text-right">Landing Cost</th>
                <th className="w-24 text-right">Wholesale Rate</th>
                <th className="w-28 text-right">Stock Value (Cost)</th>
                <th className="w-32">Supplier</th>
                <th className="w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-xs">
              {filteredBatches.map((b, idx) => {
                const isExp = b.exp_date_iso < todayIso;
                const isNearExp = b.exp_date_iso >= todayIso && b.exp_date_iso <= ninetyDaysIso;
                const isShortage = b.available_qty <= (b.min_stock_alert || 20);

                let badgeClass = '';
                if (isExp) badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
                else if (isNearExp) badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';

                return (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="font-bold uppercase text-slate-900 dark:text-white">
                      {b.medicine_name || b.medicine_id}
                      {isShortage && (
                        <span className="ml-1 text-[9px] bg-rose-600 text-white px-1 font-bold">
                          LOW STOCK
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-slate-500 uppercase">{b.pack_size}</td>
                    <td className="font-mono text-slate-500 uppercase">{b.mfg_by}</td>
                    <td className="font-mono font-bold text-slate-900 dark:text-white">{b.batch_no}</td>
                    <td className="font-mono">
                      <span className={`px-1.5 py-0.5 rounded-sm font-bold text-[10px] ${badgeClass}`}>
                        {b.exp_date_mm_yy} {isExp ? '(EXP)' : ''}
                      </span>
                    </td>
                    <td className="text-right font-mono font-black text-sm">
                      <span className={isShortage ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}>
                        {b.available_qty}
                      </span>
                    </td>
                    <td className="text-right font-mono text-slate-600 dark:text-slate-400">
                      ₹{b.mrp.toFixed(2)}
                    </td>
                    <td className="text-right font-mono font-bold text-sky-700 dark:text-sky-300">
                      ₹{b.net_landing_cost.toFixed(2)}
                    </td>
                    <td className="text-right font-mono font-extrabold text-slate-900 dark:text-white">
                      ₹{b.default_sale_rate.toFixed(2)}
                    </td>
                    <td className="text-right font-mono font-black text-slate-900 dark:text-white">
                      ₹{(b.available_qty * (b.net_landing_cost || b.purchase_rate)).toFixed(2)}
                    </td>
                    <td className="font-bold uppercase text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                      {b.vendor_name || 'INDIZEN'}
                    </td>
                    <td className="text-center">
                      {(isExp || isNearExp) ? (
                        <button
                          onClick={() => onNavigate('returns', { batchId: b.id })}
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-sm shadow-sm"
                        >
                          Return Note
                        </button>
                      ) : (
                        <button
                          onClick={() => onNavigate('sales', { medicineId: b.medicine_id })}
                          className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold rounded-sm shadow-sm"
                        >
                          Bill Item
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
