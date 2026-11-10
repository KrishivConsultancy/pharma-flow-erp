// Top Enterprise Header: Company Badge, FY 2026-27 Selector, Cloud Sync Pill, Quick F-Key Bar

import React, { useState, useEffect } from 'react';
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Moon,
  Sun,
  ShieldCheck,
  Calendar,
  Clock,
} from 'lucide-react';
import { CompanyProfile } from '../../db/schema';
import { supabaseSync, SyncStatus } from '../../db/supabaseSync';

interface TopHeaderProps {
  company: CompanyProfile;
  activePage: string;
  onNavigate: (page: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  company,
  activePage,
  onNavigate,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'IDLE',
    lastSyncTime: null,
    pendingCount: 0,
  });
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const unsub = supabaseSync.subscribe((status) => {
      setSyncStatus(status);
    });
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const handleManualSync = async () => {
    await supabaseSync.syncNow();
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-700 px-3 py-1.5 flex items-center justify-between select-none shadow-md">
      {/* Left: Company Badge & Location */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-sky-600 rounded-sm flex items-center justify-center font-black text-white text-base shadow-sm border border-sky-400">
            RD
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-base tracking-wider uppercase text-white">
                {company.company_name}
              </span>
              <span className="text-[10px] bg-slate-800 text-sky-400 px-1.5 py-0.2 rounded-sm font-bold border border-slate-700">
                BEGUSARAI
              </span>
            </div>
            <div className="text-[10.5px] text-slate-400 font-medium">
              GSTIN: <span className="font-mono text-slate-300 font-semibold">{company.gstin}</span> | D.L.: {company.dl_no}
            </div>
          </div>
        </div>

        {/* Financial Year Selector */}
        <div className="hidden md:flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-sm text-xs ml-2">
          <Calendar className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400 font-medium">FY:</span>
          <span className="font-black text-sky-300 font-mono">{company.financial_year}</span>
        </div>
      </div>

      {/* Center: Quick F-Key Bar */}
      <div className="hidden lg:flex items-center space-x-1 text-xs">
        {[
          { key: 'F1', label: 'Sales Bill', page: 'sales' },
          { key: 'F2', label: 'Purchase Entry', page: 'purchase' },
          { key: 'F3', label: 'Stock Batches', page: 'inventory' },
          { key: 'F4', label: 'Parties Khata', page: 'parties' },
          { key: 'F5', label: 'Returns', page: 'returns' },
          { key: 'F6', label: 'P&L Reports', page: 'reports' },
        ].map((btn) => (
          <button
            key={btn.key}
            onClick={() => onNavigate(btn.page)}
            className={`px-2 py-1 rounded-sm border font-bold flex items-center space-x-1 transition-all ${
              activePage === btn.page
                ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <span className="bg-slate-900/80 text-amber-400 px-1 py-0.2 rounded text-[10px] font-mono">
              {btn.key}
            </span>
            <span className="text-[11px]">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Right: Cloud Sync Pill, Time & Dark Mode */}
      <div className="flex items-center space-x-2">
        {/* Sync Status Button */}
        <button
          onClick={handleManualSync}
          disabled={syncStatus.state === 'SYNCING'}
          className={`px-2.5 py-1 rounded-sm border flex items-center space-x-1.5 text-xs font-bold transition-all ${
            syncStatus.state === 'SYNCING'
              ? 'bg-amber-950/60 text-amber-300 border-amber-700'
              : syncStatus.state === 'ERROR'
              ? 'bg-rose-950/60 text-rose-300 border-rose-700'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
          title="Click to Sync SQLite Database to Supabase Cloud"
        >
          {syncStatus.state === 'SYNCING' ? (
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          ) : syncStatus.state === 'ERROR' ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
          )}

          <span className="text-[11px]">
            {syncStatus.state === 'SYNCING'
              ? 'Syncing...'
              : syncStatus.pendingCount > 0
              ? `${syncStatus.pendingCount} Pending Sync`
              : 'Cloud Synced'}
          </span>

          {syncStatus.lastSyncTime && (
            <span className="font-mono text-[10px] text-slate-400 border-l border-slate-700 pl-1.5 ml-0.5">
              {syncStatus.lastSyncTime}
            </span>
          )}
        </button>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center space-x-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded-sm text-xs font-mono font-bold text-slate-300">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span>{currentTime}</span>
        </div>

        {/* Dark/Light Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-sm border border-slate-700 transition-colors"
          title={isDarkMode ? 'Switch to High-Contrast Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
        </button>
      </div>
    </header>
  );
};
