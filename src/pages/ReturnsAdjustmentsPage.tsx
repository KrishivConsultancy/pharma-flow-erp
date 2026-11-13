// Returns & Stock Adjustments Engine: Unified Debit Notes, Credit Notes & Expiry/Breakage Write-Offs [F5]

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  ShieldAlert,
  Building2,
  Boxes,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Download,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import { toast } from '../services/toastService';
import {
  ReturnAdjustment,
  AdjustmentType,
  CompanyProfile,
  Party,
  InventoryBatch,
  MedicineMaster,
} from '../db/schema';

interface ReturnsAdjustmentsPageProps {
  company: CompanyProfile;
  initialBatchId?: string;
}

export const ReturnsAdjustmentsPage: React.FC<ReturnsAdjustmentsPageProps> = ({
  company,
  initialBatchId,
}) => {
  const [adjustments, setAdjustments] = useState<ReturnAdjustment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);

  // Form State
  const [adjType, setAdjType] = useState<AdjustmentType>('PURCHASE_RETURN_DEBIT_NOTE');
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || '');
  const [qty, setQty] = useState<number>(1);
  const [unitRate, setUnitRate] = useState<number>(0);
  const [reason, setReason] = useState<string>('Near Expiry return to manufacturer');

  const loadData = async () => {
    try {
      const allAdj = await dbService.query<ReturnAdjustment>(`
        SELECT r.*, p.name as party_name, m.name as medicine_name
        FROM returns_adjustments r
        LEFT JOIN parties p ON r.party_id = p.id
        LEFT JOIN medicines_master m ON r.medicine_id = m.id
        ORDER BY r.voucher_date DESC, r.created_at DESC
      `);
      setAdjustments(allAdj);

      const allParties = await dbService.query<Party>('SELECT * FROM parties ORDER BY name ASC');
      setParties(allParties);

      const allBatches = await dbService.query<InventoryBatch>(`
        SELECT b.*, m.name as medicine_name, p.name as vendor_name
        FROM inventory_batches b
        JOIN medicines_master m ON b.medicine_id = m.id
        LEFT JOIN parties p ON b.last_vendor_id = p.id
        ORDER BY b.exp_date_iso ASC
      `);
      setBatches(allBatches);

      if (initialBatchId) {
        const found = allBatches.find((b) => b.id === initialBatchId);
        if (found) {
          setSelectedBatchId(found.id);
          setUnitRate(found.net_landing_cost || found.purchase_rate);
          if (found.last_vendor_id) setSelectedPartyId(found.last_vendor_id);
        }
      } else if (allBatches.length > 0 && !selectedBatchId) {
        const first = allBatches[0];
        setSelectedBatchId(first.id);
        setUnitRate(first.net_landing_cost || first.purchase_rate);
        if (first.last_vendor_id) setSelectedPartyId(first.last_vendor_id);
      }
    } catch (err) {
      console.error('Failed to load adjustments data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = dbService.subscribe(loadData);
    return unsub;
  }, [initialBatchId]);

  const handleBatchSelected = (batchId: string) => {
    setSelectedBatchId(batchId);
    const b = batches.find((x) => x.id === batchId);
    if (b) {
      setUnitRate(b.net_landing_cost || b.purchase_rate);
      if (b.last_vendor_id && adjType === 'PURCHASE_RETURN_DEBIT_NOTE') {
        setSelectedPartyId(b.last_vendor_id);
      }
    }
  };

  const totalAmount = Math.round(qty * unitRate * 100) / 100;

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      toast.error('Please select an inventory batch to adjust.', { title: 'Batch Selection Required' });
      return;
    }
    if (qty <= 0) {
      toast.error('Adjustment quantity must be greater than zero.', { title: 'Invalid Quantity' });
      return;
    }

    const targetBatch = batches.find((b) => b.id === selectedBatchId);
    if (!targetBatch) return;

    const voucherPrefix =
      adjType === 'PURCHASE_RETURN_DEBIT_NOTE'
        ? 'DN'
        : adjType === 'SALES_RETURN_CREDIT_NOTE'
        ? 'CN'
        : 'ADJ';
    const voucherNo = `${voucherPrefix}-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const adj: ReturnAdjustment = {
      id: `ADJ_${Date.now()}`,
      voucher_no: voucherNo,
      adjustment_type: adjType,
      voucher_date: voucherDate,
      party_id: selectedPartyId || null,
      medicine_id: targetBatch.medicine_id,
      batch_id: targetBatch.id,
      batch_no: targetBatch.batch_no,
      qty,
      unit_rate: unitRate,
      gst_percent: targetBatch.gst_percent,
      total_amount: totalAmount,
      reason: reason.trim() || 'Stock Adjustment',
      created_at: nowIso,
      sync_status: 'PENDING',
    };

    try {
      await dbService.saveAdjustmentTransaction(adj);
      toast.success(`Adjustment voucher ${voucherNo} created successfully! Stock and Khata updated.`);
      setReason('');
    } catch (err: any) {
      toast.error('Failed to save adjustment: ' + err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Returns, Debit/Credit Notes &amp; Breakage Adjustments [F5]
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            1-Click Supplier Return Debit Notes, Customer Sales Returns, and Expiry/Breakage Write-Offs
          </p>
        </div>
      </div>

      {/* Adjustment Voucher Creation Form Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 rounded-sm shadow-sm text-xs">
        <div className="font-extrabold text-sm uppercase text-slate-800 dark:text-slate-200 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          Create New Return / Debit Note Voucher
        </div>

        <form onSubmit={handleSubmitAdjustment} className="space-y-3">
          {/* Voucher Type Switcher */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Adjustment Type *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                {
                  id: 'PURCHASE_RETURN_DEBIT_NOTE',
                  label: 'Return to Vendor (Debit Note)',
                  color: 'bg-amber-600',
                },
                {
                  id: 'SALES_RETURN_CREDIT_NOTE',
                  label: 'Customer Return (Credit Note)',
                  color: 'bg-sky-600',
                },
                {
                  id: 'EXPIRY_BREAKAGE_WRITE_OFF',
                  label: 'Expiry / Breakage Write-Off',
                  color: 'bg-rose-600',
                },
                {
                  id: 'STOCK_SURPLUS',
                  label: 'Godown Stock Surplus',
                  color: 'bg-emerald-600',
                },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setAdjType(opt.id as AdjustmentType)}
                  className={`py-2 px-2 text-center font-bold text-[11px] rounded-sm border uppercase transition-colors ${
                    adjType === opt.id
                      ? `${opt.color} text-white border-transparent shadow-sm`
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Batch, Party & Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Batch Selector */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Select Batch *
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => handleBatchSelected(e.target.value)}
                className="w-full px-3 py-1.5 font-bold uppercase text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.medicine_name} | Batch: {b.batch_no} | Exp: {b.exp_date_mm_yy} (Stock: {b.available_qty})
                  </option>
                ))}
              </select>
            </div>

            {/* Party Selector (Vendor or Customer) */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Associated Party (Vendor or Customer)
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full px-3 py-1.5 font-bold uppercase text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">None (Internal Loss)</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.party_type}] {p.name} ({p.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Voucher Date
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full px-3 py-1.5 font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Qty, Rate & Reason */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Adjustment Qty *
              </label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 font-mono font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Unit Rate (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                value={unitRate}
                onChange={(e) => setUnitRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 font-mono font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Reason / Narration
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Broken in transit / Expired stock return"
                className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Summary & Submit */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-sm">
              Total Adjustment Amount: <span className="font-mono font-black text-amber-600 text-base">₹{totalAmount.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-sm shadow-md"
            >
              Post Adjustment &amp; Update Khata
            </button>
          </div>
        </form>
      </div>

      {/* History Table of Adjustments */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex-1 flex flex-col p-3">
        <div className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200 mb-2">
          Past Returns &amp; Adjustments Ledger ({adjustments.length} Records)
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse table-dense text-xs">
            <thead>
              <tr className="uppercase text-[10px] font-black text-slate-500">
                <th>Voucher No</th>
                <th>Type</th>
                <th>Date</th>
                <th>Party</th>
                <th>Medicine / Formulation</th>
                <th>Batch</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Total (₹)</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {adjustments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="font-mono font-black text-slate-900 dark:text-white">{a.voucher_no}</td>
                  <td>
                    <span className="font-bold text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                      {a.adjustment_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="font-mono text-slate-500">{a.voucher_date}</td>
                  <td className="font-bold uppercase text-slate-800 dark:text-slate-200">{a.party_name || '-'}</td>
                  <td className="font-bold uppercase text-slate-900 dark:text-white">{a.medicine_name}</td>
                  <td className="font-mono text-slate-500">{a.batch_no}</td>
                  <td className="text-right font-black">{a.qty}</td>
                  <td className="text-right font-mono">₹{a.unit_rate.toFixed(2)}</td>
                  <td className="text-right font-mono font-black text-amber-700 dark:text-amber-400">
                    ₹{a.total_amount.toFixed(2)}
                  </td>
                  <td className="text-slate-500">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
