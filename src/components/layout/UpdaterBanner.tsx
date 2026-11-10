// Native Auto-Updater Notification Banner for Windows Desktop App
// Displays real-time download progress and 1-click Restart & Install trigger

import React, { useState, useEffect } from 'react';
import { DownloadCloud, RefreshCw, CheckCircle2, Sparkles, X, ArrowUpCircle } from 'lucide-react';

export interface UpdaterStatusData {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  message?: string;
}

export const UpdaterBanner: React.FC = () => {
  const [updaterData, setUpdaterData] = useState<UpdaterStatusData>({ status: 'idle' });
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || typeof electronAPI.onUpdaterStatus !== 'function') {
      return;
    }

    const unsubscribe = electronAPI.onUpdaterStatus((data: UpdaterStatusData) => {
      setUpdaterData(data);
      if (data.status === 'downloading' || data.status === 'downloaded') {
        setIsDismissed(false);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleRestartAndInstall = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && typeof electronAPI.quitAndInstall === 'function') {
      electronAPI.quitAndInstall();
    }
  };

  if (isDismissed) return null;

  // State 1: Downloading update in progress
  if (updaterData.status === 'downloading') {
    const percent = updaterData.percent ?? 0;
    return (
      <div className="bg-sky-950 text-sky-100 border-b-2 border-sky-500 px-4 py-1.5 flex items-center justify-between text-xs shadow-md select-none animate-fadeIn">
        <div className="flex items-center space-x-2.5 flex-1">
          <DownloadCloud className="w-4 h-4 text-sky-400 animate-bounce" />
          <span className="font-bold tracking-wide">
            Downloading Enterprise Update ({percent}%)...
          </span>
          <div className="flex-1 max-w-xs bg-slate-800 rounded-sm h-2.5 overflow-hidden border border-sky-600/50">
            <div
              className="bg-sky-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <span className="font-mono text-[11px] text-sky-300">
          GitHub Release Channel
        </span>
      </div>
    );
  }

  // State 2: Update downloaded & ready to install
  if (updaterData.status === 'downloaded') {
    return (
      <div className="bg-emerald-900 text-white border-b-2 border-emerald-400 px-4 py-1.5 flex items-center justify-between text-xs shadow-lg select-none">
        <div className="flex items-center space-x-2.5">
          <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
          <span className="font-black tracking-wide text-[13px]">
            Enterprise Update {updaterData.version ? `v${updaterData.version}` : ''} Ready!
          </span>
          <span className="text-emerald-200 text-xs hidden sm:inline">
            Zero-friction update from GitHub Releases.
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRestartAndInstall}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 py-1 rounded-sm shadow-md transition-all flex items-center space-x-1.5 cursor-pointer uppercase tracking-wider text-[11.5px] border border-emerald-300 animate-pulse"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Restart & Install Now</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-emerald-200 hover:text-white rounded hover:bg-emerald-800"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // State 3: Update available, starting download
  if (updaterData.status === 'available') {
    return (
      <div className="bg-slate-800 text-slate-200 border-b border-sky-700 px-4 py-1 flex items-center justify-between text-xs shadow select-none">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          <span className="font-semibold text-sky-300">
            New update detected {updaterData.version ? `(v${updaterData.version})` : ''}. Starting download in background...
          </span>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
};
