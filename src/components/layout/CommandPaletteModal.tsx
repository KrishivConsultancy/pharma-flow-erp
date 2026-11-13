// Global Command Palette & Instant Search Hub [Ctrl+K]
// High-speed navigation, live medicine stock lookup & customer balance jump

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Receipt,
  ShoppingCart,
  Boxes,
  Users,
  RotateCcw,
  BarChart3,
  Settings,
  LayoutDashboard,
  FileSpreadsheet,
  ArrowRight,
  Pill,
  Building2,
  X,
  CornerDownLeft,
} from 'lucide-react';
import { dbService } from '../../db/databaseService';
import { MedicineMaster, Party, InventoryBatch } from '../../db/schema';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, params?: any) => void;
}

interface PaletteItem {
  id: string;
  category: 'NAVIGATION' | 'MEDICINE' | 'CUSTOMER';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      const loadData = async () => {
        try {
          const [m, p, b] = await Promise.all([
            dbService.query<MedicineMaster>('SELECT * FROM medicines_master LIMIT 200'),
            dbService.query<Party>('SELECT * FROM parties LIMIT 150'),
            dbService.query<InventoryBatch>('SELECT medicine_id, available_qty FROM inventory_batches WHERE available_qty > 0'),
          ]);
          setMedicines(m);
          setParties(p);
          setBatches(b);
        } catch (e) {
          console.error('Error fetching command palette data:', e);
        }
      };
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Static Navigation Items
  const navItems: PaletteItem[] = [
    {
      id: 'nav-sales',
      category: 'NAVIGATION',
      title: 'Wholesale Sales Billing',
      subtitle: 'Create GST Tax Invoice or Simple Cash Memo',
      badge: 'F1',
      badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300 dark:border-sky-700',
      icon: Receipt,
      action: () => {
        onNavigate('sales');
        onClose();
      },
    },
    {
      id: 'nav-quotes',
      category: 'NAVIGATION',
      title: 'Price Quotations & Rate Estimates',
      subtitle: 'Prepare estimates with zero stock deduction',
      badge: 'F9',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700',
      icon: FileSpreadsheet,
      action: () => {
        onNavigate('quotations');
        onClose();
      },
    },
    {
      id: 'nav-purchase',
      category: 'NAVIGATION',
      title: 'Stock Purchase Entry',
      subtitle: 'Smart 3-way inward with scheme 100+20 math',
      badge: 'F2',
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
      icon: ShoppingCart,
      action: () => {
        onNavigate('purchase');
        onClose();
      },
    },
    {
      id: 'nav-inventory',
      category: 'NAVIGATION',
      title: 'Batch Inventory & FEFO Radar',
      subtitle: 'Live warehouse stock valuation & expiry monitor',
      badge: 'F3',
      badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      icon: Boxes,
      action: () => {
        onNavigate('inventory');
        onClose();
      },
    },
    {
      id: 'nav-parties',
      category: 'NAVIGATION',
      title: 'Parties & Khata Directory',
      subtitle: 'Chemists, Doctors & Suppliers Udhaar Ledgers',
      badge: 'F4',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-700',
      icon: Users,
      action: () => {
        onNavigate('parties');
        onClose();
      },
    },
    {
      id: 'nav-returns',
      category: 'NAVIGATION',
      title: 'Returns & Supplier Debit Notes',
      subtitle: 'Expiry breakage & sale returns management',
      badge: 'F5',
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700',
      icon: RotateCcw,
      action: () => {
        onNavigate('returns');
        onClose();
      },
    },
    {
      id: 'nav-reports',
      category: 'NAVIGATION',
      title: 'P&L Reports & GST CA Pack',
      subtitle: 'GSTR-1 JSON export, gross margins & balance sheet',
      badge: 'F6',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      icon: BarChart3,
      action: () => {
        onNavigate('reports');
        onClose();
      },
    },
    {
      id: 'nav-dashboard',
      category: 'NAVIGATION',
      title: 'Command Center & Expiry Radar',
      subtitle: 'Executive KPIs, 90-day radar & shortage book',
      badge: 'F8',
      badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300 dark:border-sky-700',
      icon: LayoutDashboard,
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      category: 'NAVIGATION',
      title: 'Company Settings & Cloud Disaster Recovery',
      subtitle: 'Radha Drugs profile, series & SQLite backup',
      badge: 'F7',
      badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      icon: Settings,
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
  ];

  // Dynamic Medicine Search Items
  const qClean = query.trim().toUpperCase();
  const matchedNav = navItems.filter(
    (item) =>
      item.title.toUpperCase().includes(qClean) ||
      (item.subtitle && item.subtitle.toUpperCase().includes(qClean)) ||
      (item.badge && item.badge.toUpperCase().includes(qClean))
  );

  const matchedMedicines: PaletteItem[] =
    qClean.length >= 2
      ? medicines
          .filter(
            (m) =>
              m.name.toUpperCase().includes(qClean) ||
              (m.salt_composition && m.salt_composition.toUpperCase().includes(qClean))
          )
          .slice(0, 5)
          .map((m) => {
            const stockCount = batches
              .filter((b) => b.medicine_id === m.id)
              .reduce((sum, b) => sum + b.available_qty, 0);

            return {
              id: `med-${m.id}`,
              category: 'MEDICINE',
              title: m.name,
              subtitle: `${m.pack_size || '10x10'} • ${m.mfg_by || 'Pharma'} • GST: ${m.gst_percent}%`,
              badge: `${stockCount} In Stock`,
              badgeColor:
                stockCount > 0
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700',
              icon: Pill,
              action: () => {
                onNavigate('inventory', { searchQuery: m.name });
                onClose();
              },
            };
          })
      : [];

  const matchedParties: PaletteItem[] =
    qClean.length >= 2
      ? parties
          .filter(
            (p) =>
              p.name.toUpperCase().includes(qClean) ||
              (p.phone && p.phone.includes(qClean)) ||
              (p.city && p.city.toUpperCase().includes(qClean))
          )
          .slice(0, 5)
          .map((p) => ({
            id: `party-${p.id}`,
            category: 'CUSTOMER',
            title: p.name,
            subtitle: `${p.city || 'Begusarai'} • Phone: ${p.phone || 'NA'} • ${p.party_type}`,
            badge: `₹${(p.current_balance || 0).toFixed(0)} Due`,
            badgeColor:
              p.current_balance > 0
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
            icon: Building2,
            action: () => {
              onNavigate('parties', { partyId: p.id });
              onClose();
            },
          }))
      : [];

  const allFilteredItems = [...matchedNav, ...matchedMedicines, ...matchedParties];

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allFilteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allFilteredItems.length) % Math.max(1, allFilteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allFilteredItems[selectedIndex]) {
        allFilteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-slate-200 dark:border-slate-800 p-3.5 flex items-center bg-slate-50 dark:bg-slate-950">
          <Search className="w-5 h-5 text-sky-600 dark:text-sky-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search module, jump to F-Key, lookup medicine stock, or chemist khata..."
            className="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white outline-none placeholder:text-slate-400 border-none shadow-none focus:ring-0"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/50">
          {allFilteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No matching commands, medicines, or parties found.
            </div>
          ) : (
            allFilteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-sm flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs uppercase tracking-wide truncate">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div
                          className={`text-[10.5px] truncate ${
                            isSelected ? 'text-sky-100' : 'text-slate-400'
                          }`}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0 pl-3">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-sm border ${
                          isSelected
                            ? 'bg-white text-sky-800 border-white'
                            : item.badgeColor || 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <CornerDownLeft
                      className={`w-3.5 h-3.5 ${
                        isSelected ? 'text-white' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between text-[10.5px] text-slate-500 select-none">
          <div className="flex items-center space-x-3">
            <span>
              <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1 py-0.5 rounded text-[9px] mr-1">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1 py-0.5 rounded text-[9px] mr-1">
                Enter
              </kbd>
              Select
            </span>
            <span>
              <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1 py-0.5 rounded text-[9px] mr-1">
                Esc
              </kbd>
              Close
            </span>
          </div>
          <div className="font-bold text-sky-600 dark:text-sky-400">Radha Drugs Quick Search</div>
        </div>
      </div>
    </div>
  );
};
