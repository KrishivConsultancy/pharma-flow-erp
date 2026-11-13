// Quick Cash / UPI / Bank Receipt & Payment Voucher Modal
// Instantly settles customer receipts and vendor payments with running balance update

import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, IndianRupee, Check } from 'lucide-react';
import { Party } from '../../db/schema';
import { dbService } from '../../db/databaseService';
import { toast } from '../../services/toastService';

interface PaymentEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: Party | null;
  defaultVoucherType?: 'PAYMENT_RECEIVED' | 'PAYMENT_MADE';
  onSaved?: () => void;
}

export const PaymentEntryModal: React.FC<PaymentEntryModalProps> = ({
  isOpen,
  onClose,
  party,
  defaultVoucherType,
  onSaved,
}) => {
  const [voucherType, setVoucherType] = useState<'PAYMENT_RECEIVED' | 'PAYMENT_MADE'>('PAYMENT_RECEIVED');
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [narration, setNarration] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (party) {
      const vType = defaultVoucherType || (party.party_type === 'CUSTOMER' ? 'PAYMENT_RECEIVED' : 'PAYMENT_MADE');
      setVoucherType(vType);
      setAmount('');
      setPaymentMode('CASH');
      setTransactionDate(new Date().toISOString().substring(0, 10));
      setNarration('');
    }
  }, [isOpen, party, defaultVoucherType]);

  if (!isOpen || !party) return null;

  const currentBal = party.current_balance || 0;
  const numAmount = parseFloat(amount) || 0;
  const projectedBalance = voucherType === 'PAYMENT_RECEIVED'
    ? currentBal - numAmount
    : currentBal - numAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      toast.error('Please enter a valid payment amount greater than zero.', { title: 'Invalid Amount' });
      return;
    }

    setIsSubmitting(true);
    try {
      await dbService.recordPaymentTransaction({
        party_id: party.id,
        amount: numAmount,
        payment_mode: paymentMode,
        transaction_date: transactionDate,
        narration: narration.trim() || `${voucherType === 'PAYMENT_RECEIVED' ? 'Receipt' : 'Payment'} via ${paymentMode}`,
        voucher_type: voucherType,
      });

      toast.success(`₹${numAmount.toFixed(2)} voucher recorded for ${party.name}`);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Payment settlement failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      style={{ animation: 'backdropFadeIn 150ms ease-out forwards' }}
    >
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-700 w-full max-w-lg shadow-2xl rounded-sm flex flex-col modal-surface">
        {/* Header */}
        <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
            <span className="font-extrabold text-base uppercase text-slate-900 dark:text-white">
              {voucherType === 'PAYMENT_RECEIVED' ? 'Payment Receipt Voucher' : 'Payment Made Voucher'}
            </span>
          </div>

          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {/* Party Card Banner */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex justify-between items-center">
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-bold">Party / Account</div>
              <div className="font-black text-sm text-slate-900 dark:text-white uppercase">{party.name}</div>
              <div className="text-[10px] text-slate-500">{party.city} • {party.phone || 'No Phone'}</div>
            </div>

            <div className="text-right">
              <div className="text-[11px] text-slate-500 uppercase font-bold">Current Khata Due</div>
              <div className="font-mono font-black text-base text-sky-700 dark:text-sky-300">
                ₹{currentBal.toFixed(2)}
              </div>
              <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                {party.party_type === 'CUSTOMER' ? '(Receivable)' : '(Payable)'}
              </div>
            </div>
          </div>

          {/* Voucher Direction Switcher */}
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setVoucherType('PAYMENT_RECEIVED')}
              className={`flex-1 py-2 font-bold uppercase rounded-sm border flex items-center justify-center space-x-1.5 ${
                voucherType === 'PAYMENT_RECEIVED'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Money Received (Receipt)</span>
            </button>
            <button
              type="button"
              onClick={() => setVoucherType('PAYMENT_MADE')}
              className={`flex-1 py-2 font-bold uppercase rounded-sm border flex items-center justify-center space-x-1.5 ${
                voucherType === 'PAYMENT_MADE'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Money Paid Out</span>
            </button>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Settlement Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 font-mono font-black text-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Voucher Date *
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'].map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`py-1.5 font-bold uppercase text-[11px] rounded-sm border ${
                    paymentMode === mode
                      ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Narration / Cheque / UTR No.
            </label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Paid via PhonePe UPI or Cheque #441029"
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>

          {/* Balance Preview Card */}
          {numAmount > 0 && (
            <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-sm flex justify-between items-center text-xs">
              <span className="font-semibold text-sky-900 dark:text-sky-200">New Closing Balance:</span>
              <span className="font-mono font-black text-sm text-sky-800 dark:text-sky-300">
                ₹{projectedBalance.toFixed(2)}
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-300 dark:border-slate-700 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-sm hover:bg-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-sm shadow-md flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Record Voucher [Enter]</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
