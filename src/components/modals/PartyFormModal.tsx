// Party Registration Modal: GST Registered (Cashfree Auto-Fetch) + Non-GST Unregistered
// Instant onboarding for retail chemists, doctors, and pharmaceutical vendors

import React, { useState, useEffect, useRef } from 'react';
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

  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // Handle GSTIN live lookup via Multi-Tier Cashfree / Public service
  const handleAutoFetchGstin = async (gstinToFetch?: string) => {
    const cleanGstin = (gstinToFetch || gstin).trim().toUpperCase();
    if (!cleanGstin || cleanGstin.length < 2) {
      setGstinFeedback({ type: 'error', message: 'Please enter a 15-character GSTIN number' });
      return;
    }

    // Instant Tier 3 Extraction
    const offline = cashfreeService.extractOfflineDetails(cleanGstin);
    setStateName(offline.state_name);
    setStateCode(offline.state_code);
    if (!city || city === 'BEGUSARAI') {
      setCity(offline.city || 'BEGUSARAI');
    }

    if (cleanGstin.length !== 15) {
      setGstinFeedback({
        type: 'info',
        message: `State resolved: ${offline.state_name} (${offline.state_code}). Enter all 15 characters to fetch registered Trade Name.`,
      });
      return;
    }

    setIsLoadingGstin(true);
    setGstinFeedback({ type: 'info', message: 'Connecting to GSTIN verification directory...' });

    try {
      const res = await cashfreeService.verifyGstin(cleanGstin);
      if (res.valid) {
        if (res.trade_name) setName(res.trade_name);
        if (res.legal_name) setLegalName(res.legal_name);
        if (res.address) setAddress(res.address);
        if (res.city) setCity(res.city);
        if (res.state_name) setStateName(res.state_name);
        if (res.state_code) setStateCode(res.state_code);

        const isIpBlock = Boolean(res.message && (res.message.includes('IP not whitelisted') || res.message.includes('ip_validation_failed')));

        setGstinFeedback({
          type: isIpBlock ? 'error' : (res.trade_name ? 'success' : 'info'),
          message: (isIpBlock && res.message)
            ? res.message
            : res.trade_name
            ? `Verified: ${res.trade_name} (${res.source.replace('_', ' ')})`
            : `State & PAN Extracted: ${res.state_name} | ${res.pan} (${res.constitution}). Please type Trade Name below.`,
        });

        if (!res.trade_name) {
          setTimeout(() => nameInputRef.current?.focus(), 100);
        }
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
      setTimeout(() => nameInputRef.current?.focus(), 100);
    } finally {
      setIsLoadingGstin(false);
    }
  };

  const handleGstinInputChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setGstin(clean);
    if (clean.length === 15) {
      handleAutoFetchGstin(clean);
    } else if (clean.length >= 2) {
      const code = clean.substring(0, 2);
      const name = GST_STATE_MAP[code];
      if (name) {
        setStateName(name);
        setStateCode(code);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter party name / shop name.');
      nameInputRef.current?.focus();
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
                  Vendor (Pharma Wholesaler / Co.)
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
                15-Digit GSTIN Number (Auto-fetches on 15 chars)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => handleGstinInputChange(e.target.value)}
                  placeholder="e.g. 10BTCPS4963A1Z2"
                  className="flex-1 px-3 py-1.5 font-mono text-sm uppercase font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => handleAutoFetchGstin()}
                  disabled={isLoadingGstin}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-sm flex items-center space-x-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>{isLoadingGstin ? 'Verifying...' : '⚡ Verify GSTIN'}</span>
                </button>
              </div>

              {gstinFeedback && (
                <div
                  className={`mt-2 p-2 rounded-sm text-xs font-semibold flex items-center space-x-1.5 ${
                    gstinFeedback.type === 'success'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : gstinFeedback.type === 'error'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-sky-950/60 dark:text-sky-200'
                  }`}
                >
                  {gstinFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
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
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. KHUSHI MEDICO or DR. R.K. SHARMA"
                className="w-full px-3 py-1.5 font-bold uppercase border border-slate-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-2 focus:ring-sky-500"
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

          {/* Licenses & Phone */}
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
                className="w-full px-3 py-1.5 uppercase font-mono border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                FSSAI License No.
              </label>
              <input
                type="text"
                value={fssaiNo}
                onChange={(e) => setFssaiNo(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-1.5 font-mono border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp / Phone *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full px-3 py-1.5 font-mono border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Address, City, State */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Address / Market Location
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. MAIN ROAD, NEAR HOSPITAL CHOWK"
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
                className="w-full px-3 py-1.5 uppercase font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                State Name
              </label>
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3 py-1.5 uppercase font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                State Code
              </label>
              <input
                type="text"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-full px-3 py-1.5 font-mono font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Financial Balances */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Opening Balance (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 font-mono font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-[10px] text-slate-500">
                {partyType === 'CUSTOMER' ? 'Amount Customer Owes to Radha Drugs' : 'Amount Radha Drugs Owes to Supplier'}
              </span>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Credit Limit (₹)
              </label>
              <input
                type="number"
                step="1000"
                value={creditLimit}
                onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 100000)}
                className="w-full px-3 py-1.5 font-mono font-bold border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-[10px] text-slate-500">Maximum credit outstanding threshold</span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-sm shadow-md"
            >
              {initialParty ? 'Save Changes' : 'Register Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
