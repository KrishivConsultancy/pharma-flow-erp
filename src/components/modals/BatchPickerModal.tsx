// FEFO (First Expiry First Out) Keyboard-Navigable Batch Picker Modal
// Displays complete pricing power: Cost, MRP, Wholesale Rate, and Last Rate Given to Customer

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { InventoryBatch } from '../../db/schema';

interface BatchPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineName: string;
  batches: InventoryBatch[];
  lastCustomerRate?: number;
  onSelectBatch: (batch: InventoryBatch) => void;
}

export const BatchPickerModal: React.FC<BatchPickerModalProps> = ({
  isOpen,
  onClose,
  medicineName,
  batches,
  lastCustomerRate,
  onSelectBatch,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [expiredOverrideConfirm, setExpiredOverrideConfirm] = useState<InventoryBatch | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Sort batches by exp_date_iso ASC (FEFO: Earliest Expiry First)
  const sortedBatches = [...batches].sort((a, b) => a.exp_date_iso.localeCompare(b.exp_date_iso));

  useEffect(() => {
    setSelectedIndex(0);
    setExpiredOverrideConfirm(null);
  }, [isOpen, medicineName]);

  // Keyboard navigation: Up/Down arrow, Enter, Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expiredOverrideConfirm) {
          setExpiredOverrideConfirm(null);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < sortedBatches.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (expiredOverrideConfirm) {
          onSelectBatch(expiredOverrideConfirm);
          setExpiredOverrideConfirm(null);
        } else if (sortedBatches[selectedIndex]) {
          handleSelect(sortedBatches[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, sortedBatches, expiredOverrideConfirm]);

  if (!isOpen) return null;

  // Expiry check helpers
  const todayIso = new Date().toISOString().substring(0, 10);
  const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const isExpired = (iso: string) => iso < todayIso;
  const isExpiringSoon = (iso: string) => iso >= todayIso && iso <= ninetyDaysLater;

  const handleSelect = (batch: InventoryBatch) => {
    if (isExpired(batch.exp_date_iso)) {
      setExpiredOverrideConfirm(batch);
      return;
    }
    onSelectBatch(batch);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-700 w-full max-w-4xl shadow-2xl rounded-sm flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-slate-900 dark:text-white uppercase tracking-wide">
                {medicineName}
              </span>
              <span className="text-xs bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 px-2 py-0.5 font-bold rounded-sm border border-sky-300 dark:border-sky-700">
                FEFO Batch Selector
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Earliest expiry sorted at top. Navigate with <kbd className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px] font-mono">↑</kbd> <kbd className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px] font-mono">↓</kbd> and press <kbd className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px] font-mono">Enter</kbd>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expired Warning Alert Override Modal if triggered */}
        {expiredOverrideConfirm && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border-b-2 border-rose-500 p-4 flex items-start space-x-3 text-rose-900 dark:text-rose-100">
            <ShieldAlert className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-sm">
                CRITICAL WARNING: Batch {expiredOverrideConfirm.batch_no} is EXPIRED (Exp: {expiredOverrideConfirm.exp_date_mm_yy})!
              </div>
              <div className="text-xs mt-1 text-rose-700 dark:text-rose-300">
                Drug Act Section 18 prohibits selling expired formulations. Are you sure you want to bill this batch?
              </div>
              <div className="mt-2.5 flex space-x-2">
                <button
                  onClick={() => {
                    onSelectBatch(expiredOverrideConfirm);
                    setExpiredOverrideConfirm(null);
                  }}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-sm shadow-sm"
                >
                  Confirm Override &amp; Select
                </button>
                <button
                  onClick={() => setExpiredOverrideConfirm(null)}
                  className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Table */}
        <div className="p-3 overflow-y-auto flex-1">
          {sortedBatches.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No inventory batches recorded for this medicine yet.
            </div>
          ) : (
            <table ref={tableRef} className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-left text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold uppercase">
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-8">#</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700">Batch No</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700">Exp. (MM/YY)</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right">Available Qty</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right">MRP (₹)</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right">Landing Cost (₹)</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right">Default Wholesale (₹)</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right">Last Client Rate (₹)</th>
                  <th className="p-2 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {sortedBatches.map((b, idx) => {
                  const expired = isExpired(b.exp_date_iso);
                  const nearExpiry = isExpiringSoon(b.exp_date_iso);
                  const isSelected = selectedIndex === idx;

                  let rowBg = isSelected
                    ? 'bg-sky-100 dark:bg-sky-950/60 font-semibold ring-1 ring-sky-500'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50';

                  if (expired) {
                    rowBg = isSelected
                      ? 'bg-rose-100 dark:bg-rose-950/80 ring-1 ring-rose-500'
                      : 'bg-rose-50/60 dark:bg-rose-950/30';
                  } else if (nearExpiry) {
                    rowBg = isSelected
                      ? 'bg-amber-100 dark:bg-amber-950/80 ring-1 ring-amber-500'
                      : 'bg-amber-50/60 dark:bg-amber-950/30';
                  }

                  return (
                    <tr
                      key={b.id}
                      onClick={() => {
                        setSelectedIndex(idx);
                        handleSelect(b);
                      }}
                      className={`cursor-pointer transition-colors ${rowBg}`}
                    >
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 font-mono text-center">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 font-bold font-mono text-sm text-slate-900 dark:text-white">
                        {b.batch_no}
                      </td>
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 font-mono">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className={`font-bold ${expired ? 'text-rose-600' : nearExpiry ? 'text-amber-600' : ''}`}>
                            {b.exp_date_mm_yy}
                          </span>
                          {expired && (
                            <span className="text-[10px] bg-rose-600 text-white px-1 rounded-none font-bold">
                              EXPIRED
                            </span>
                          )}
                          {nearExpiry && !expired && (
                            <span className="text-[10px] bg-amber-500 text-white px-1 rounded-none font-bold">
                              EXP &lt; 90D
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-bold text-sm">
                        <span className={b.available_qty <= 10 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}>
                          {b.available_qty}
                        </span>
                      </td>
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-mono">
                        ₹{b.mrp.toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-mono text-slate-600 dark:text-slate-400">
                        ₹{b.net_landing_cost.toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-mono font-bold text-sky-700 dark:text-sky-300 text-sm">
                        ₹{b.default_sale_rate.toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-right font-mono font-bold">
                        {lastCustomerRate ? (
                          <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-sm border border-emerald-300 dark:border-emerald-800">
                            ₹{lastCustomerRate.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(b);
                          }}
                          className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-sm shadow-sm"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-amber-500 inline-block rounded-none"></span>
              <span>Expiring Soon (&lt; 90 Days)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-rose-600 inline-block rounded-none"></span>
              <span>Expired Batch</span>
            </span>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-sm hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Cancel [Esc]
            </button>
            <button
              onClick={() => {
                if (sortedBatches[selectedIndex]) handleSelect(sortedBatches[selectedIndex]);
              }}
              className="px-4 py-1.5 bg-sky-600 text-white font-bold rounded-sm hover:bg-sky-500 shadow-sm"
            >
              Choose Selected [Enter]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
