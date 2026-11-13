// Top Enterprise Command Bar: Company Header, Quick Search (Ctrl+K), F-Key Launcher & Live Sync Hub

import React, { useState, useEffect } from 'react';
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Moon,
  Sun,
  Calendar,
  Clock,
  Search,
  Receipt,
  FileSpreadsheet,
  ShoppingCart,
  Boxes,
  Users,
  RotateCcw,
  BarChart3,
  AlignJustify,
} from 'lucide-react';
import { CompanyProfile } from '../../db/schema';
import { supabaseSync, SyncStatus } from '../../db/supabaseSync';

interface TopHeaderProps {
  company: CompanyProfile;
  activePage: string;
  onNavigate: (page: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenCommandPalette: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  company,
  activePage,
  onNavigate,
  isDarkMode,
  onToggleDarkMode,
  onOpenCommandPalette,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'IDLE',
    lastSyncTime: null,
    pendingCount: 0,
  });
  const [currentTime, setCurrentTime] = useState<string>(
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Table Information Density: 'compact' (Marg speed) | 'standard' | 'comfortable'
  const [tableDensity, setTableDensity] = useState<'compact' | 'standard' | 'comfortable'>(() => {
    return (localStorage.getItem('rd_table_density') as any) || 'compact';
  });

  useEffect(() => {
    document.body.classList.remove('density-compact', 'density-comfortable');
    if (tableDensity === 'compact') {
      document.body.classList.add('density-compact');
    } else if (tableDensity === 'comfortable') {
      document.body.classList.add('density-comfortable');
    }
    localStorage.setItem('rd_table_density', tableDensity);
  }, [tableDensity]);

  const cycleDensity = () => {
    setTableDensity((prev) => {
      if (prev === 'compact') return 'standard';
      if (prev === 'standard') return 'comfortable';
      return 'compact';
    });
  };

  useEffect(() => {
    const unsub = supabaseSync.subscribe((status) => {
      setSyncStatus(status);
    });
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const handleManualSync = async () => {
    await supabaseSync.syncNow();
  };

  const quickNavKeys = [
    { key: 'F1', label: 'Sales Bill', page: 'sales', icon: Receipt },
    { key: 'F9', label: 'Quotes', page: 'quotations', icon: FileSpreadsheet },
    { key: 'F2', label: 'Purchase', page: 'purchase', icon: ShoppingCart },
    { key: 'F3', label: 'Stock', page: 'inventory', icon: Boxes },
    { key: 'F4', label: 'Khata', page: 'parties', icon: Users },
    { key: 'F5', label: 'Returns', page: 'returns', icon: RotateCcw },
    { key: 'F6', label: 'P&L Reports', page: 'reports', icon: BarChart3 },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 px-3.5 py-2 flex items-center justify-between select-none shadow-md z-40">
      {/* 1. Left: Company Identity */}
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-sky-600 rounded-sm flex items-center justify-center font-black text-white text-sm shadow-md border border-sky-400">
            RD
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-sm tracking-wider uppercase text-white">
                {company.company_name}
              </span>
              <span className="text-[9.5px] bg-slate-800 text-sky-400 px-1.5 py-0.2 rounded font-bold border border-slate-700">
                BEGUSARAI
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center space-x-2">
              <span>GSTIN: <span className="font-mono text-slate-300 font-semibold">{company.gstin}</span></span>
              <span className="text-slate-600">•</span>
              <span>D.L.: <span className="font-mono text-slate-300">{company.dl_no}</span></span>
            </div>
          </div>
        </div>

        {/* Global Quick Search / Command Palette Bar */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden xl:flex items-center space-x-2 bg-slate-800/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/80 px-3 py-1 rounded-sm text-xs transition-all w-64 justify-between shadow-inner"
          title="Open Global Command Search (Ctrl+K)"
        >
          <div className="flex items-center space-x-2 truncate">
            <Search className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span className="text-[11px] truncate">Search or jump to...</span>
          </div>
          <kbd className="font-mono text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 2. Center: Quick F-Key Action Bar */}
      <div className="hidden lg:flex items-center space-x-1">
        {quickNavKeys.map((btn) => {
          const isActive = activePage === btn.page;
          const Icon = btn.icon;

          return (
            <button
              key={btn.key}
              onClick={() => onNavigate(btn.page)}
              className={`px-2 py-1 rounded-sm border font-bold flex items-center space-x-1.5 transition-all text-xs ${
                isActive
                  ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="font-mono font-extrabold text-[9.5px] bg-slate-900 text-amber-400 px-1 py-0.2 rounded border border-slate-700/60">
                {btn.key}
              </span>
              <span className="text-[11px] tracking-tight">{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Right: Cloud Sync, Live Time, FY & Dark Mode */}
      <div className="flex items-center space-x-2">
        {/* Financial Year Pill */}
        <div className="hidden md:flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-sm text-xs font-mono font-bold text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400 font-sans text-[10px] uppercase font-bold">FY:</span>
          <span className="text-sky-300">{company.financial_year}</span>
        </div>

        {/* Cloud Sync Status Button */}
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
              ? `${syncStatus.pendingCount} Pending`
              : 'Cloud Synced'}
          </span>
        </button>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-sm text-xs font-mono font-bold text-slate-300">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span>{currentTime}</span>
        </div>

        {/* Table Information Density Switcher */}
        <button
          onClick={cycleDensity}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-sm border border-slate-700 transition-colors flex items-center space-x-1 text-xs"
          title={`Table Information Density: ${tableDensity.toUpperCase()} (Click to toggle)`}
        >
          <AlignJustify className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-mono text-[10px] uppercase font-bold text-slate-300 hidden sm:inline">
            {tableDensity === 'compact' ? 'Compact' : tableDensity === 'standard' ? 'Normal' : 'Spacious'}
          </span>
        </button>

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
