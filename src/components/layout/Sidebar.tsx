// Sidebar Navigation: Top-Tier Enterprise Command Navigation with Categorized Grouping & F-Key Badges

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
  CheckCircle2,
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

interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Trade & Billing',
    items: [
      { id: 'sales', label: 'Wholesale Sales', fKey: 'F1', icon: Receipt },
      { id: 'quotations', label: 'Price Quotations', fKey: 'F9', icon: FileSpreadsheet },
      { id: 'purchase', label: 'Stock Purchase', fKey: 'F2', icon: ShoppingCart },
      { id: 'inventory', label: 'Batch Inventory', fKey: 'F3', icon: Boxes },
    ],
  },
  {
    title: 'Accounts & Khata',
    items: [
      { id: 'parties', label: 'Parties & Khata', fKey: 'F4', icon: Users },
      { id: 'returns', label: 'Returns & Notes', fKey: 'F5', icon: RotateCcw },
      { id: 'reports', label: 'P&L & CA Pack', fKey: 'F6', icon: BarChart3 },
    ],
  },
  {
    title: 'Command & System',
    items: [
      { id: 'dashboard', label: 'Dashboard & Radar', fKey: 'F8', icon: LayoutDashboard },
      { id: 'settings', label: 'Settings & Cloud', fKey: 'F7', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col justify-between flex-shrink-0 select-none shadow-xl">
      {/* Navigation Sections */}
      <div className="p-2.5 space-y-4 overflow-y-auto flex-1">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {section.title}
            </div>

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-sm flex items-center justify-between transition-all group ${
                      isActive
                        ? 'bg-sky-600 text-white font-extrabold shadow-sm'
                        : 'bg-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-sky-400'
                        }`}
                      />
                      <span className="text-xs truncate tracking-wide font-semibold">
                        {item.label}
                      </span>
                    </div>

                    <kbd
                      className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded-sm font-extrabold flex-shrink-0 border transition-all ${
                        isActive
                          ? 'bg-sky-800 text-white border-sky-400/40 shadow-inner'
                          : 'bg-slate-800 text-amber-400 border-slate-700/80 group-hover:border-slate-600'
                      }`}
                    >
                      {item.fKey}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom App Info & SQLite Storage Card */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 text-[11px] text-slate-400 select-none">
        <div className="flex items-center justify-between font-bold text-slate-300">
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs tracking-wide">Local SQLite Engine</span>
          </div>
          <span className="flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Active</span>
          </span>
        </div>
        <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
          <span>Radha Drugs ERP v2.6</span>
          <span className="font-mono text-slate-400">Begusarai</span>
        </div>
      </div>
    </aside>
  );
};
