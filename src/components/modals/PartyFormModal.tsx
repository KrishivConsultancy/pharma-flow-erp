// Party Registration Modal: GST Registered (Cashfree Auto-Fetch) + Non-GST Unregistered
// Instant onboarding for retail chemists, doctors, and pharmaceutical vendors

import React, { useState, useEffect } from 'react';
import { X, Zap, CheckCircle2, AlertCircle, Building2, User, Phone, MapPin, FileCheck } from 'lucide-react';
import { Party, PartyType } from '../../db/schema';
import { cashfreeService, GST_STATE_MAP } from '../../services/cashfreeService';
import { dbService } from '../../db/databaseService';

interface PartyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPartyType?: PartyType;
  initialParty?: Party | null;
  onSaved?: (party: Party) => void;
}

export const PartyFormModal: React.FC<PartyFormModalProps> = ({
  isOpen,
  onClose,
  defaultPartyType = 'CUSTOMER',
  initialParty = null,
  onSaved,
}) => {
  const [partyType, setPartyType] = useState<PartyType>(defaultPartyType);
  const [isGstRegistered, setIsGstRegistered] = useState<number>(1);
  const [gstin, setGstin] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [legalName, setLegalName] = useState<string>('');
  const [dlNo, setDlNo] = useState<string>('');
  const [fssaiNo, setFssaiNo] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('BEGUSARAI');
  const [stateName, setStateName] = useState<string>('BIHAR');
  const [stateCode, setStateCode] = useState<string>('10');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [creditLimit, setCreditLimit] = useState<number>(100000);

  const [isLoadingGstin, setIsLoadingGstin] = useState<boolean>(false);
  const [gstinFeedback, setGstinFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (initialParty) {
      setPartyType(initialParty.party_type);
      setIsGstRegistered(initialParty.is_gst_registered);
      setGstin(initialParty.gstin || '');
      setName(initialParty.name || '');
      setLegalName(initialParty.legal_name || '');
      setDlNo(initialParty.dl_no || '');
      setFssaiNo(initialParty.fssai_no || '');
      setPhone(initialParty.phone || '');
      setAddress(initialParty.address || '');
      setCity(initialParty.city || 'BEGUSARAI');
      setStateName(initialParty.state_name || 'BIHAR');
      setStateCode(initialParty.state_code || '10');
      setOpeningBalance(initialParty.opening_balance || 0);
      setCreditLimit(initialParty.credit_limit || 100000);
      setGstinFeedback(null);
    } else {
      setPartyType(defaultPartyType);
      setIsGstRegistered(1);
      setGstin('');
      setName('');
      setLegalName('');
      setDlNo('');
      setFssaiNo('');
      setPhone('');
      setAddress('');
      setCity('BEGUSARAI');
      setStateName('BIHAR');
      setStateCode('10');
      setOpeningBalance(0);
      setCreditLimit(100000);
      setGstinFeedback(null);
    }
  }, [isOpen, initialParty, defaultPartyType]);

  // Handle GSTIN live lookup via Cashfree service
  const handleAutoFetchGstin = async () => {
    const cleanGstin = gstin.trim().toUpperCase();
    if (!cleanGstin) {
      setGstinFeedback({ type: 'error', message: 'Please enter a 15-character GSTIN number' });
      return;
    }

    setIsLoadingGstin(true);
    setGstinFeedback({ type: 'info', message: 'Fetching registered GST particulars...' });

    try {
      const res = await cashfreeService.verifyGstin(cleanGstin);
      if (res.valid) {
        setName(res.trade_name || res.legal_name);
        setLegalName(res.legal_name || res.trade_name);
        setAddress(res.address);
        setCity(res.city || 'BEGUSARAI');
        setStateName(res.state_name);
        setStateCode(res.state_code);

        setGstinFeedback({
          type: 'success',
          message: `${res.message || 'Details retrieved!'} (${res.source.replace('_', ' ')})`,
        });
      } else {
        setGstinFeedback({
          type: 'error',
          message: res.message || 'Invalid GSTIN or verification failed',
        });
      }
    } catch (err: any) {
      setGstinFeedback({
        type: 'error',
        message: err.message || 'GSTIN fetch failed',
      });
    } finally {
      setIsLoadingGstin(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter party name / shop name.');
      return;
    }

    const partyId = initialParty?.id || `PARTY_${Date.now()}`;
    const partyData: Partial<Party> = {
      id: partyId,
      party_type: partyType,
      is_gst_registered: isGstRegistered,
      gstin: isGstRegistered ? gstin.toUpperCase().trim() : '',
      name: name.toUpperCase().trim(),
      legal_name: (legalName || name).toUpperCase().trim(),
      dl_no: dlNo.trim(),
      fssai_no: fssaiNo.trim(),
      phone: phone.trim(),
      address: address.toUpperCase().trim(),
      city: (city || 'BEGUSARAI').toUpperCase().trim(),
      state_name: stateName.toUpperCase().trim(),
      state_code: stateCode.trim(),
      opening_balance: Number(openingBalance) || 0,
      credit_limit: Number(creditLimit) || 100000,
      gst_status: isGstRegistered ? 'ACTIVE' : 'UNREGISTERED',
    };

    try {
      await dbService.upsertParty(partyData);
      if (onSaved) {
        onSaved(partyData as Party);
      }
      onClose();
    } catch (err: any) {
      alert('Failed to save party: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-700 w-full max-w-2xl shadow-2xl rounded-sm flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wide">
              {initialParty ? 'Edit Party Profile' : 'New Client / Vendor Registration'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Party Type & Registration Status Switcher */}
          <div className="grid grid-cols-2 gap-3 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Party Role
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setPartyType('CUSTOMER')}
                  className={`flex-1 py-1.5 font-bold uppercase rounded-sm border transition-colors ${
                    partyType === 'CUSTOMER'
                      ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  Customer (Retailer / Doctor)
                </button>
                <button
                  type="button"
                  onClick={() => setPartyType('VENDOR')}
                  className={`flex-1 py-1.5 font-bold uppercase rounded-sm border transition-colors ${
                    partyType === 'VENDOR'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  Vendor (Pharma Company)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                GST Registration
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsGstRegistered(1)}
                  className={`flex-1 py-1.5 font-bold uppercase rounded-sm border transition-colors ${
                    isGstRegistered === 1
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  ● GST Registered
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsGstRegistered(0);
                    setGstin('');
                    setGstinFeedback(null);
                  }}
                  className={`flex-1 py-1.5 font-bold uppercase rounded-sm border transition-colors ${
                    isGstRegistered === 0
                      ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  ○ Unregistered / Non-GST
                </button>
              </div>
            </div>
          </div>

          {/* GSTIN Box (Shown only if GST Registered) */}
          {isGstRegistered === 1 && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-300 dark:border-sky-800 rounded-sm">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                15-Digit GSTIN Number (e.g. 10BTCPS4963A1Z2)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="Enter 15-char GSTIN"
                  className="flex-1 px-3 py-1.5 font-mono text-sm uppercase font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={handleAutoFetchGstin}
                  disabled={isLoadingGstin}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-sm flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>{isLoadingGstin ? 'Fetching...' : '⚡ Auto-Fetch GST'}</span>
                </button>
              </div>

              {gstinFeedback && (
                <div
                  className={`mt-2 p-2 rounded-sm text-xs font-semibold flex items-center space-x-1.5 ${
                    gstinFeedback.type === 'success'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : gstinFeedback.type === 'error'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                  }`}
                >
                  {gstinFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>{gstinFeedback.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Primary Name & Legal Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Trade Name / Medical Store / Doctor Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. KHUSHI MEDICO or DR. R.K. SHARMA"
                className="w-full px-3 py-1.5 font-bold uppercase border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Legal Entity Name (GST Registered)
              </label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. KHUSHI MEDICO PROPRIETORSHIP"
                className="w-full px-3 py-1.5 uppercase border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Licenses & Contact */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Drug License No. (D.L.)
              </label>
              <input
                type="text"
                value={dlNo}
                onChange={(e) => setDlNo(e.target.value)}
                placeholder="e.g. 142/142A"
                className="w-full px-3 py-1.5 uppercase border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone / WhatsApp Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9835466285"
                className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                FSSAI License No. (Optional)
              </label>
              <input
                type="text"
                value={fssaiNo}
                onChange={(e) => setFssaiNo(e.target.value)}
                placeholder="14-digit FSSAI"
                className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Address & City */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Address / Village / Mohalla
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. MAIN ROAD, PIPRA DEWASH"
                className="w-full px-3 py-1.5 uppercase border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                City / District
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-1.5 uppercase border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* State Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                State &amp; State Code
              </label>
              <select
                value={stateCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setStateCode(code);
                  setStateName(GST_STATE_MAP[code] || 'OTHER');
                }}
                className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 font-bold"
              >
                {Object.entries(GST_STATE_MAP).map(([code, sname]) => (
                  <option key={code} value={code}>
                    {code} - {sname} {code === '10' ? '(BIHAR - INTRA STATE)' : '(INTER STATE)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Credit Limit (₹)
              </label>
              <input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Opening Balance (Only shown for new parties) */}
          {!initialParty && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800">
              <label className="block font-bold text-amber-900 dark:text-amber-200 mb-1">
                Opening Balance / Old Udhaar (₹)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-48 px-3 py-1.5 font-mono font-bold text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
                />
                <span className="text-[11px] text-amber-800 dark:text-amber-300">
                  {partyType === 'CUSTOMER'
                    ? '(Amount this customer owes Radha Drugs from past years)'
                    : '(Amount Radha Drugs owes this vendor from past bills)'}
                </span>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 border-t border-slate-300 dark:border-slate-700 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-sm hover:bg-slate-300"
            >
              Cancel [Esc]
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-sm shadow-md"
            >
              Save Party Profile [F10]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
