// Settings, Company Profile, Supabase Cloud Auth & 1-Click JSON/SQLite Backup Hub [F7]

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Database,
  Cloud,
  Download,
  Upload,
  RefreshCw,
  Save,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Key,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { CompanyProfile } from '../db/schema';
import { dbService } from '../db/databaseService';
import { supabaseSync, SyncStatus } from '../db/supabaseSync';
import { cashfreeService } from '../services/cashfreeService';
import { geminiOcrService } from '../services/geminiOcrService';

interface SettingsBackupPageProps {
  company: CompanyProfile;
  onCompanyUpdated: (updated: CompanyProfile) => void;
}

export const SettingsBackupPage: React.FC<SettingsBackupPageProps> = ({
  company,
  onCompanyUpdated,
}) => {
  // Company Profile State
  const [profile, setProfile] = useState<CompanyProfile>(company);

  // Cloud API Credentials State
  const [supabaseUrl, setSupabaseUrl] = useState<string>(
    localStorage.getItem('radha_supabase_url') || (import.meta as any).env.VITE_SUPABASE_URL || ''
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>(
    localStorage.getItem('radha_supabase_anon_key') || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || ''
  );
  const [cashfreeId, setCashfreeId] = useState<string>(
    localStorage.getItem('cashfree_client_id') || (import.meta as any).env.VITE_CASHFREE_CLIENT_ID || 'CF1181570DBDGAKS3N65S73BH449G'
  );
  const [cashfreeSecret, setCashfreeSecret] = useState<string>(
    localStorage.getItem('cashfree_client_secret') || (import.meta as any).env.VITE_CASHFREE_CLIENT_SECRET || 'cfsk_ma_prod_c321adcc81d634dbc34a7c7465b03e00_d478ef0e'
  );
  const [cashfreeSandbox, setCashfreeSandbox] = useState<boolean>(
    localStorage.getItem('cashfree_sandbox') === 'true'
  );
  const [geminiKey, setGeminiKey] = useState<string>(
    geminiOcrService.getApiKey() || (import.meta as any).env.VITE_GEMINI_API_KEY || ''
  );

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'IDLE',
    lastSyncTime: null,
    pendingCount: 0,
  });
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(company);
  }, [company]);

  useEffect(() => {
    const unsub = supabaseSync.subscribe((status) => {
      setSyncStatus(status);
    });
    return unsub;
  }, []);

  // Save Company Profile
  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.exec(
        `UPDATE company_profile SET
          company_name = ?, tagline = ?, address_line1 = ?, city_district = ?,
          state_name = ?, state_code = ?, pincode = ?, phone = ?, gstin = ?,
          dl_no = ?, dl_valid_upto = ?, fssai_no = ?, bank_name = ?,
          bank_account_no = ?, bank_ifsc = ?, upi_id = ?, gst_invoice_prefix = ?,
          gst_invoice_next_no = ?, simple_bill_prefix = ?, simple_bill_next_no = ?,
          financial_year = ?
        WHERE id = 'RADHA_DRUGS_MAIN'`,
        [
          profile.company_name, profile.tagline, profile.address_line1, profile.city_district,
          profile.state_name, profile.state_code, profile.pincode, profile.phone, profile.gstin,
          profile.dl_no, profile.dl_valid_upto, profile.fssai_no, profile.bank_name,
          profile.bank_account_no, profile.bank_ifsc, profile.upi_id, profile.gst_invoice_prefix,
          profile.gst_invoice_next_no, profile.simple_bill_prefix, profile.simple_bill_next_no,
          profile.financial_year
        ]
      );
      onCompanyUpdated(profile);
      setStatusMessage({ type: 'success', text: 'Company profile successfully saved to SQLite database!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to update company profile: ' + err.message });
    }
  };

  // Save Cloud & API Credentials
  const handleSaveApiKeys = () => {
    localStorage.setItem('radha_supabase_url', supabaseUrl);
    localStorage.setItem('radha_supabase_anon_key', supabaseAnonKey);
    supabaseSync.initClient(supabaseUrl, supabaseAnonKey);

    cashfreeService.setCredentials(cashfreeId, cashfreeSecret, cashfreeSandbox);
    geminiOcrService.setApiKey(geminiKey);

    setStatusMessage({ type: 'success', text: 'API & Cloud credentials securely stored in local storage!' });
  };

  // 1-Click Sync Now
  const handleSyncNow = async () => {
    const res = await supabaseSync.syncNow();
    setStatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  // 1-Click Restore From Supabase Cloud
  const handleRestoreFromCloud = async () => {
    const confirmRestore = confirm(
      'Are you sure you want to restore the entire database from Supabase Cloud? Any unsynced local changes will be replaced.'
    );
    if (!confirmRestore) return;

    try {
      const res = await supabaseSync.restoreFromCloud();
      setStatusMessage({ type: 'success', text: res.message });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Cloud restore failed: ' + err.message });
    }
  };

  // 1-Click Download Local JSON Backup
  const handleDownloadBackup = async () => {
    try {
      const jsonStr = await dbService.exportEntireDatabaseJson();
      const dateStr = new Date().toISOString().substring(0, 10);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Radha_Drugs_Backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'Full database JSON backup downloaded successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Backup export failed: ' + err.message });
    }
  };

  // 1-Click Restore Local Backup File
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const content = reader.result as string;
        await dbService.importEntireDatabaseJson(content);
        setStatusMessage({ type: 'success', text: 'Database successfully restored from JSON backup file!' });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: 'Failed to restore backup: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  // Wipe & Factory Reset Database
  const handleWipeAndReset = async () => {
    const confirmWipe = window.confirm(
      '⚠️ CRITICAL WARNING: WIPE & FACTORY RESET DATABASE\n\nThis will permanently delete:\n- ALL Sales & Purchase Invoices\n- ALL Inventory Batches (Stock valuation to ₹0)\n- ALL Customers & Vendors\n- ALL Ledger Transactions\n\nThe official Radha Drugs company profile will be preserved.\n\nAre you sure you want to completely wipe the database?'
    );
    if (!confirmWipe) return;

    try {
      await dbService.wipeAndResetDatabase();
      alert('✅ Database completely wiped to 0. Clean production state ready.');
      window.location.reload();
    } catch (err: any) {
      alert('Failed to reset database: ' + err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-950 text-xs">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-sky-600" />
            <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Company Configuration &amp; Cloud Disaster Recovery Hub [F7]
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure Radha Drugs company profile, Supabase Cloud sync, and local disaster recovery backups
          </p>
        </div>
      </div>

      {/* Status Feedback Notification */}
      {statusMessage && (
        <div
          className={`p-3 rounded-sm border font-bold flex items-center space-x-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TWO COLUMN GRID: Left Company Profile | Right Cloud & Backups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* COLUMN 1: Company Profile Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 rounded-sm shadow-sm">
          <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800 mb-3 flex items-center space-x-1.5">
            <Building2 className="w-4 h-4 text-sky-600" />
            <span>Radha Drugs Master Profile &amp; Series</span>
          </h2>

          <form onSubmit={handleSaveCompanyProfile} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={profile.company_name}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={profile.tagline}
                  onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Address Line
                </label>
                <input
                  type="text"
                  value={profile.address_line1}
                  onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })}
                  className="w-full px-2.5 py-1.5 uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  City / District
                </label>
                <input
                  type="text"
                  value={profile.city_district}
                  onChange={(e) => setProfile({ ...profile, city_district: e.target.value })}
                  className="w-full px-2.5 py-1.5 uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={profile.gstin}
                  onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 font-mono font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Drug License (D.L.)
                </label>
                <input
                  type="text"
                  value={profile.dl_no}
                  onChange={(e) => setProfile({ ...profile, dl_no: e.target.value })}
                  className="w-full px-2.5 py-1.5 font-mono font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={profile.bank_name}
                  onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Bank Account No
                </label>
                <input
                  type="text"
                  value={profile.bank_account_no}
                  onChange={(e) => setProfile({ ...profile, bank_account_no: e.target.value })}
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  UPI ID (QR Print)
                </label>
                <input
                  type="text"
                  value={profile.upi_id}
                  onChange={(e) => setProfile({ ...profile, upi_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Series Configuration */}
            <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  GST Invoice Next No.
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={profile.gst_invoice_prefix}
                    onChange={(e) => setProfile({ ...profile, gst_invoice_prefix: e.target.value })}
                    className="w-12 px-2 py-1 font-mono font-bold uppercase text-center border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    value={profile.gst_invoice_next_no}
                    onChange={(e) => setProfile({ ...profile, gst_invoice_next_no: parseInt(e.target.value, 10) || 1157 })}
                    className="flex-1 px-2 py-1 font-mono font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Simple Bill Next No.
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={profile.simple_bill_prefix}
                    onChange={(e) => setProfile({ ...profile, simple_bill_prefix: e.target.value })}
                    className="w-12 px-2 py-1 font-mono font-bold uppercase text-center border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    value={profile.simple_bill_next_no}
                    onChange={(e) => setProfile({ ...profile, simple_bill_next_no: parseInt(e.target.value, 10) || 101 })}
                    className="flex-1 px-2 py-1 font-mono font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-sm shadow-md flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Company Profile</span>
              </button>
            </div>
          </form>
        </div>

        {/* COLUMN 2: Cloud Sync & Local Disaster Recovery Hub */}
        <div className="space-y-4">
          {/* Supabase Cloud & External APIs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 rounded-sm shadow-sm space-y-3">
            <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-1.5">
              <Cloud className="w-4 h-4 text-sky-600" />
              <span>Supabase Cloud Sync &amp; API Integrations</span>
            </h2>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Supabase Anon / Public Key
              </label>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Cashfree Client ID
                </label>
                <input
                  type="text"
                  value={cashfreeId}
                  onChange={(e) => setCashfreeId(e.target.value)}
                  placeholder="CF_APP_..."
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Cashfree Secret
                </label>
                <input
                  type="password"
                  value={cashfreeSecret}
                  onChange={(e) => setCashfreeSecret(e.target.value)}
                  placeholder="CF_SECRET_..."
                  className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Gemini Flash Vision API Key (For Bill Scanner)
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-2.5 py-1.5 font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={handleSaveApiKeys}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-sm shadow-sm"
              >
                Save API Keys
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleSyncNow}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-sm flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Now</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestoreFromCloud}
                  className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded-sm"
                >
                  Restore From Cloud
                </button>
              </div>
            </div>
          </div>

          {/* Local 1-Click Backup & Factory Reset */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 rounded-sm shadow-sm space-y-3">
            <h2 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-1.5">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>1-Click Offline JSON Disaster Recovery</span>
            </h2>

            <p className="text-slate-500">
              Download the entire SQLite database into a single portable backup file. Keep it on a USB pendrive for 100% data security.
            </p>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold rounded-sm shadow-sm flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download Full Backup (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold rounded-sm shadow-sm flex items-center justify-center space-x-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>Restore from Backup File</span>
              </button>
              <input
                ref={backupFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileRestore}
              />
            </div>

            {/* Wipe & Factory Reset Database */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-sm border border-rose-200 dark:border-rose-900">
              <div>
                <div className="font-bold text-rose-800 dark:text-rose-200">Wipe &amp; Factory Reset Database (0 Bills, 0 Stock)</div>
                <div className="text-[10px] text-rose-600 dark:text-rose-400">Completely clears all bills, inventory batches, and parties to 0 while keeping Radha Drugs profile intact.</div>
              </div>

              <button
                type="button"
                onClick={handleWipeAndReset}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-black rounded-sm text-xs shadow-sm flex items-center space-x-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Wipe Database to 0</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
