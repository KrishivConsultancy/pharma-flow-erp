// Radha Drugs Wholesale Pharmaceutical ERP - Root Application Controller
// Offline-first SQLite persistence, global F-key router, and high-contrast Enterprise UI

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { dbService } from './db/databaseService';
import { CompanyProfile } from './db/schema';
import { SEED_COMPANY_PROFILE } from './db/seedData';
import { TopHeader } from './components/layout/TopHeader';
import { Sidebar } from './components/layout/Sidebar';
import { UpdaterBanner } from './components/layout/UpdaterBanner';
import { CommandPaletteModal } from './components/layout/CommandPaletteModal';
import { ToastContainer } from './components/common/ToastContainer';

// Route Code-Splitting: Lazy-load heavy operational modules to accelerate initial dashboard boot
import { DashboardPage } from './pages/DashboardPage';
const SalesBillingPage = lazy(() => import('./pages/SalesBillingPage').then(m => ({ default: m.SalesBillingPage })));
const PurchaseEntryPage = lazy(() => import('./pages/PurchaseEntryPage').then(m => ({ default: m.PurchaseEntryPage })));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage').then(m => ({ default: m.QuotationsPage })));
const InventoryBatchesPage = lazy(() => import('./pages/InventoryBatchesPage').then(m => ({ default: m.InventoryBatchesPage })));
const PartiesKhataPage = lazy(() => import('./pages/PartiesKhataPage').then(m => ({ default: m.PartiesKhataPage })));
const ReturnsAdjustmentsPage = lazy(() => import('./pages/ReturnsAdjustmentsPage').then(m => ({ default: m.ReturnsAdjustmentsPage })));
const ReportsProfitLossPage = lazy(() => import('./pages/ReportsProfitLossPage').then(m => ({ default: m.ReportsProfitLossPage })));
const SettingsBackupPage = lazy(() => import('./pages/SettingsBackupPage').then(m => ({ default: m.SettingsBackupPage })));

// Lightweight Route Loading Skeleton for zero layout shift
const RouteLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-50 dark:bg-slate-950">
    <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading Module...</span>
  </div>
);

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [pageParams, setPageParams] = useState<any>({});
  const [company, setCompany] = useState<CompanyProfile>(SEED_COMPANY_PROFILE);
  const [isDbReady, setIsDbReady] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('radha_theme') === 'dark';
  });

  // Apply dark mode class to html document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('radha_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('radha_theme', 'light');
    }
  }, [isDarkMode]);

  // Load SQLite database and company profile on initial mount
  useEffect(() => {
    const initDb = async () => {
      try {
        await dbService.getDb();
        const profiles = await dbService.query<CompanyProfile>(
          "SELECT * FROM company_profile WHERE id = 'RADHA_DRUGS_MAIN'"
        );
        if (profiles.length > 0) {
          setCompany(profiles[0]);
        }
        setIsDbReady(true);
      } catch (err) {
        console.error('Fatal database initialization error:', err);
      }
    };
    initDb();
  }, []);

  // Global Keyboard Shortcuts Router (F1 - F8)
  useEffect(() => {
    const handleGlobalFKeys = (e: KeyboardEvent) => {
      // Global Command Palette Shortcut (Ctrl+K or Cmd+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Avoid overriding inside normal text fields if they need F keys (though F1-F8 are generally safe)
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setActivePage('sales');
          break;
        case 'F2':
          e.preventDefault();
          setActivePage('purchase');
          break;
        case 'F3':
          e.preventDefault();
          setActivePage('inventory');
          break;
        case 'F4':
          e.preventDefault();
          setActivePage('parties');
          break;
        case 'F5':
          e.preventDefault();
          setActivePage('returns');
          break;
        case 'F6':
          e.preventDefault();
          setActivePage('reports');
          break;
        case 'F7':
          e.preventDefault();
          setActivePage('settings');
          break;
        case 'F8':
          e.preventDefault();
          setActivePage('dashboard');
          break;
        case 'F9':
          e.preventDefault();
          setActivePage('quotations');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalFKeys);
    return () => window.removeEventListener('keydown', handleGlobalFKeys);
  }, []);

  const handleNavigate = (page: string, params?: any) => {
    setActivePage(page);
    setPageParams(params || {});
  };

  if (!isDbReady) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white space-y-3">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-base font-black uppercase tracking-wider">
          Initializing Radha Drugs Local SQLite Engine...
        </div>
        <div className="text-xs text-slate-400">Loading wholesale inventory, batches &amp; customer ledgers</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans">
      {/* Top Enterprise Header */}
      <TopHeader
        company={company}
        activePage={activePage}
        onNavigate={handleNavigate}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Global Command Palette [Ctrl+K] */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* GitHub Native Auto-Updater Notification Banner */}
      <UpdaterBanner />

      {/* Global Non-blocking Toast & Confirmation Notification System */}
      <ToastContainer />

      {/* Main Split Layout: Sidebar + Active Page */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />

        <main className="flex-1 flex flex-col overflow-hidden">
          <Suspense fallback={<RouteLoadingFallback />}>
            {activePage === 'dashboard' && (
              <DashboardPage company={company} onNavigate={handleNavigate} />
            )}
            {activePage === 'sales' && (
              <SalesBillingPage
                company={company}
                initialMode={pageParams?.mode}
                initialQuotation={pageParams?.quotationToConvert}
              />
            )}
            {activePage === 'quotations' && (
              <QuotationsPage
                company={company}
                onNavigateToSale={(quotation) => {
                  handleNavigate('sales', { quotationToConvert: quotation });
                }}
              />
            )}
            {activePage === 'purchase' && (
              <PurchaseEntryPage company={company} />
            )}
            {activePage === 'inventory' && (
              <InventoryBatchesPage company={company} onNavigate={handleNavigate} />
            )}
            {activePage === 'parties' && (
              <PartiesKhataPage company={company} />
            )}
            {activePage === 'returns' && (
              <ReturnsAdjustmentsPage company={company} initialBatchId={pageParams?.batchId} />
            )}
            {activePage === 'reports' && (
              <ReportsProfitLossPage company={company} />
            )}
            {activePage === 'settings' && (
              <SettingsBackupPage
                company={company}
                onCompanyUpdated={(updated) => setCompany(updated)}
              />
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default App;
