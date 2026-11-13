// Sidebar Navigation: High-Contrast Rectangular Enterprise Bar with F1-F8 Shortcut Badges

import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  Boxes,
  Users,
  RotateCcw,
  BarChart3,
  Settings,
  Database,
  FileSpreadsheet,
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  fKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard & Radar', fKey: 'F8', icon: LayoutDashboard },
  { id: 'sales', label: 'Wholesale Sales [F1]', fKey: 'F1', icon: Receipt },
  { id: 'quotations', label: 'Quotations & Est. [F9]', fKey: 'F9', icon: FileSpreadsheet },
  { id: 'purchase', label: 'Stock Purchase [F2]', fKey: 'F2', icon: ShoppingCart },
  { id: 'inventory', label: 'Batch Inventory [F3]', fKey: 'F3', icon: Boxes },
  { id: 'parties', label: 'Parties & Khata [F4]', fKey: 'F4', icon: Users },
  { id: 'returns', label: 'Returns & Credit [F5]', fKey: 'F5', icon: RotateCcw },
  { id: 'reports', label: 'P&L & CA Pack [F6]', fKey: 'F6', icon: BarChart3 },
  { id: 'settings', label: 'Settings & Cloud [F7]', fKey: 'F7', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col justify-between flex-shrink-0 select-none">
      {/* Navigation List */}
      <nav className="p-2 space-y-1">
        <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
          Navigation Modules
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full text-left px-2.5 py-2.5 rounded-sm flex items-center justify-between transition-colors border ${
                isActive
                  ? 'bg-sky-600 text-white border-sky-400 font-extrabold shadow-sm'
                  : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="text-xs truncate tracking-wide">{item.label}</span>
              </div>

              <kbd
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none font-extrabold flex-shrink-0 ${
                  isActive
                    ? 'bg-sky-800 text-white'
                    : 'bg-slate-800 text-amber-400 border border-slate-700'
                }`}
              >
                {item.fKey}
              </kbd>
            </button>
          );
        })}
      </nav>

      {/* Bottom App Info & System Status */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center space-x-1.5 font-bold text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local SQLite Engine</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          Radha Drugs Wholesale ERP v2.6
        </div>
        <div className="text-[10px] text-slate-500">
          Hajipur, Begusarai, Bihar
        </div>
      </div>
    </aside>
  );
};
