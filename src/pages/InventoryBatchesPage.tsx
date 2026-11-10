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
  Plus,
  Trash2,
  Edit2,
  X,
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

  const [batchModalOpen, setBatchModalOpen] = useState<boolean>(false);
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  const [formMedName, setFormMedName] = useState<string>('');
  const [formHsn, setFormHsn] = useState<string>('30049099');
  const [formPack, setFormPack] = useState<string>('10*10');
  const [formMfg, setFormMfg] = useState<string>('');
  const [formBatchNo, setFormBatchNo] = useState<string>('');
  const [formExp, setFormExp] = useState<string>('05/28');
  const [formQty, setFormQty] = useState<number>(100);
  const [formMrp, setFormMrp] = useState<number>(0);
  const [formPurchaseRate, setFormPurchaseRate] = useState<number>(0);
  const [formSaleRate, setFormSaleRate] = useState<number>(0);
  const [formGst, setFormGst] = useState<number>(12);
  const [formRack, setFormRack] = useState<string>('');

  const handleOpenAddBatchModal = (batchToEdit?: any) => {
    if (batchToEdit) {
      setEditingBatch(batchToEdit);
      setFormMedName(batchToEdit.medicine_name || '');
      setFormHsn(batchToEdit.hsn_code || '30049099');
      setFormPack(batchToEdit.pack_size || '');
      setFormMfg(batchToEdit.mfg_by || '');
      setFormBatchNo(batchToEdit.batch_no || '');
      setFormExp(batchToEdit.exp_date_mm_yy || '');
      setFormQty(batchToEdit.available_qty || 0);
      setFormMrp(batchToEdit.mrp || 0);
      setFormPurchaseRate(batchToEdit.purchase_rate || 0);
      setFormSaleRate(batchToEdit.default_sale_rate || 0);
      setFormGst(batchToEdit.gst_percent || 12);
      setFormRack(batchToEdit.rack_location || '');
    } else {
      setEditingBatch(null);
      setFormMedName('');
      setFormHsn('30049099');
      setFormPack('10*10');
      setFormMfg('');
      setFormBatchNo('');
      setFormExp('05/28');
      setFormQty(100);
      setFormMrp(0);
      setFormPurchaseRate(0);
      setFormSaleRate(0);
      setFormGst(12);
      setFormRack('');
    }
    setBatchModalOpen(true);
  };

  const handleSaveBatchForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMedName.trim() || !formBatchNo.trim()) {
      alert('Please enter Medicine Name and Batch Number.');
      return;
    }

    try {
      await dbService.addOrUpdateManualBatch({
        id: editingBatch ? editingBatch.id : undefined,
        medicine_name: formMedName.trim().toUpperCase(),
        hsn_code: formHsn.trim(),
        pack_size: formPack.trim().toUpperCase(),
        mfg_by: formMfg.trim().toUpperCase(),
        batch_no: formBatchNo.trim().toUpperCase(),
        exp_date_mm_yy: formExp.trim(),
        mrp: Number(formMrp) || 0,
        purchase_rate: Number(formPurchaseRate) || 0,
        gst_percent: Number(formGst) || 12,
        default_sale_rate: Number(formSaleRate) || (Number(formPurchaseRate) * 1.25),
        available_qty: Number(formQty) || 0,
        rack_location: formRack.trim().toUpperCase(),
      });

      alert(`✅ Opening stock batch ${formBatchNo.toUpperCase()} saved successfully!`);
      setBatchModalOpen(false);
      await loadBatches();
    } catch (err: any) {
      alert(`Failed to save stock batch: ${err.message}`);
    }
  };

  const handleDeleteBatch = async (b: any) => {
    if (!window.confirm(`Are you sure you want to delete batch ${b.batch_no} of ${b.medicine_name || 'this medicine'}?`)) {
      return;
    }
    try {
      await dbService.deleteBatch(b.id);
      alert('✅ Batch deleted successfully.');
      await loadBatches();
    } catch (err: any) {
      alert(`Failed to delete batch: ${err.message}`);
    }
  };
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
            onClick={() => handleOpenAddBatchModal()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-sm flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Opening Stock Batch</span>
          </button>

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
                      {b.vendor_name || '-'}
                    </td>
                    <td className="text-center space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenAddBatchModal(b)}
                        className="p-1 text-slate-500 hover:text-sky-600 rounded inline-block"
                        title="Edit / Adjust Batch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(b)}
                        className="p-1 text-slate-500 hover:text-rose-600 rounded inline-block"
                        title="Delete Batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

      {/* Opening Stock / Manual Batch Modal */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-700 w-full max-w-2xl shadow-2xl rounded-sm flex flex-col max-h-[90vh]">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  {editingBatch ? 'Edit / Adjust Medicine Batch' : '+ Add Opening Stock Batch'}
                </h2>
                <p className="text-xs text-slate-500">
                  Direct physical stock entry without creating a purchase bill
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatchForm} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Medicine / Formulation Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formMedName}
                    onChange={(e) => setFormMedName(e.target.value.toUpperCase())}
                    placeholder="e.g. PARACETAMOL 650MG"
                    className="w-full px-3 py-1.5 font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Batch Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formBatchNo}
                    onChange={(e) => setFormBatchNo(e.target.value.toUpperCase())}
                    placeholder="e.g. BATCH2026A"
                    className="w-full px-3 py-1.5 font-mono font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Expiry Date (MM/YY) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formExp}
                    onChange={(e) => setFormExp(e.target.value)}
                    placeholder="e.g. 05/28"
                    className="w-full px-3 py-1.5 font-mono font-bold text-center border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Available Quantity (Units) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formQty}
                    onChange={(e) => setFormQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-1.5 font-mono font-bold text-sky-700 dark:text-sky-300 border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Pack Size
                  </label>
                  <input
                    type="text"
                    value={formPack}
                    onChange={(e) => setFormPack(e.target.value.toUpperCase())}
                    placeholder="e.g. 10*10"
                    className="w-full px-3 py-1.5 font-mono uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    value={formHsn}
                    onChange={(e) => setFormHsn(e.target.value)}
                    placeholder="30049099"
                    className="w-full px-3 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Manufacturer (Mfg By)
                  </label>
                  <input
                    type="text"
                    value={formMfg}
                    onChange={(e) => setFormMfg(e.target.value.toUpperCase())}
                    placeholder="e.g. CIPLA / ALKEM"
                    className="w-full px-3 py-1.5 uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    MRP (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formMrp}
                    onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 font-mono font-bold text-right border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Purchase Rate (Cost) (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPurchaseRate}
                    onChange={(e) => {
                      const pr = parseFloat(e.target.value) || 0;
                      setFormPurchaseRate(pr);
                      if (!formSaleRate || formSaleRate === 0) {
                        setFormSaleRate(Math.round(pr * 1.25 * 100) / 100);
                      }
                    }}
                    className="w-full px-3 py-1.5 font-mono font-bold text-right border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Default Wholesale Sale Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSaleRate}
                    onChange={(e) => setFormSaleRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 font-mono font-bold text-right border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    GST Rate %
                  </label>
                  <select
                    value={formGst}
                    onChange={(e) => setFormGst(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-1.5 font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="0">0% (Non-GST / Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-sm shadow-sm"
                >
                  Save Batch Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
