// Parties & Khata Directory with 360° Vendor & Customer Transaction Intelligence Dossier [F4]
// Complete passbook ledger, Invoices history, Rate Watchdog, and Instant Settlement

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Building2,
  FileText,
  IndianRupee,
  Calendar,
  Download,
  Share2,
  Receipt,
  RotateCcw,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import {
  Party,
  PartyType,
  CompanyProfile,
  PartyLedgerTransaction,
  Sale,
  Purchase,
} from '../db/schema';
import { PartyFormModal } from '../components/modals/PartyFormModal';
import { PaymentEntryModal } from '../components/modals/PaymentEntryModal';
import { InvoicePrintModal } from '../components/print/InvoicePrintModal';
import { CsvExportService } from '../services/csvExportService';

type PartyFilterType = 'ALL' | 'CUSTOMER' | 'VENDOR';
type SubTabType = 'INVOICES' | 'LEDGER' | 'RATE_WATCHDOG';

interface PartiesKhataPageProps {
  company: CompanyProfile;
}

export const PartiesKhataPage: React.FC<PartiesKhataPageProps> = ({ company }) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [partyFilter, setPartyFilter] = useState<PartyFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Sub tab inside dossier
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('INVOICES');
  const [ledgerTransactions, setLedgerTransactions] = useState<PartyLedgerTransaction[]>([]);
  const [partySales, setPartySales] = useState<Sale[]>([]);
  const [partyPurchases, setPartyPurchases] = useState<Purchase[]>([]);
  const [medicineHistory, setMedicineHistory] = useState<any[]>([]);

  // Modals
  const [partyModalOpen, setPartyModalOpen] = useState<boolean>(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);

  // Print modal for re-printing invoice from history
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<Sale | null>(null);
  const [saleItemsForPrint, setSaleItemsForPrint] = useState<any[]>([]);

  const loadParties = async () => {
    try {
      const all = await dbService.query<Party>('SELECT * FROM parties ORDER BY name ASC');
      setParties(all);

      if (!selectedParty && all.length > 0) {
        handleSelectParty(all[0]);
      } else if (selectedParty) {
        // Refresh selected party
        const fresh = all.find((p) => p.id === selectedParty.id);
        if (fresh) setSelectedParty(fresh);
      }
    } catch (err) {
      console.error('Failed to load parties:', err);
    }
  };

  useEffect(() => {
    loadParties();
    const unsub = dbService.subscribe(loadParties);
    return unsub;
  }, []);

  const handleSelectParty = async (party: Party) => {
    setSelectedParty(party);

    try {
      // 1. Fetch Ledger Transactions
      const txs = await dbService.query<PartyLedgerTransaction>(
        'SELECT * FROM party_ledger_transactions WHERE party_id = ? ORDER BY transaction_date ASC, created_at ASC',
        [party.id]
      );
      setLedgerTransactions(txs);

      // 2. Fetch Invoices
      if (party.party_type === 'CUSTOMER') {
        const sales = await dbService.query<Sale>(
          'SELECT * FROM sales WHERE customer_id = ? ORDER BY sale_date DESC',
          [party.id]
        );
        setPartySales(sales);
      } else {
        const purchases = await dbService.query<Purchase>(
          'SELECT * FROM purchases WHERE vendor_id = ? ORDER BY invoice_date DESC',
          [party.id]
        );
        setPartyPurchases(purchases);
      }

      // 3. Fetch Medicine-Wise History (Rate Watchdog)
      if (party.party_type === 'CUSTOMER') {
        const medHistory = await dbService.query(`
          SELECT si.product_name, si.batch_no, si.sale_rate, si.discount_percent, s.sale_date, si.qty, si.free_qty
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE s.customer_id = ?
          ORDER BY s.sale_date DESC
        `, [party.id]);
        setMedicineHistory(medHistory);
      } else {
        const medHistory = await dbService.query(`
          SELECT pi.product_name, pi.batch_no, pi.purchase_rate, pi.net_landing_cost, p.invoice_date, pi.billed_qty, pi.free_qty
          FROM purchase_items pi
          JOIN purchases p ON pi.purchase_id = p.id
          WHERE p.vendor_id = ?
          ORDER BY p.invoice_date DESC
        `, [party.id]);
        setMedicineHistory(medHistory);
      }
    } catch (err) {
      console.error('Error fetching party dossier data:', err);
    }
  };

  const filteredParties = parties.filter((p) => {
    if (partyFilter !== 'ALL' && p.party_type !== partyFilter) return false;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.gstin || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone || '').includes(searchQuery);
    return matchesSearch;
  });

  // Export Ledger CSV
  const handleExportLedgerCsv = () => {
    if (!selectedParty) return;
    const csv = CsvExportService.generatePartyLedgerCsv(selectedParty, ledgerTransactions);
    CsvExportService.downloadCsv(csv, `${selectedParty.name.replace(/\s+/g, '_')}_Ledger.csv`);
  };

  // Open Invoice Print
  const handleReprintSale = async (sale: Sale) => {
    const items = await dbService.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    setSelectedSaleForPrint(sale);
    setSaleItemsForPrint(items);
    setPrintModalOpen(true);
  };

  // Total volume calculation for dossier
  const totalVolume = selectedParty
    ? selectedParty.party_type === 'CUSTOMER'
      ? partySales.reduce((sum, s) => sum + s.net_amount, 0)
      : partyPurchases.reduce((sum, p) => sum + p.grand_total, 0)
    : 0;

  const totalSettled = ledgerTransactions
    .filter((t) => t.voucher_type === 'PAYMENT_RECEIVED' || t.voucher_type === 'PAYMENT_MADE')
    .reduce((sum, t) => sum + (t.debit_amount || t.credit_amount), 0);

  return (
    <div className="flex-1 overflow-hidden p-3 bg-slate-100 dark:bg-slate-950 flex flex-col space-y-3">
      {/* Top Bar: Title & New Party Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2.5 rounded-sm shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-sky-600" />
            <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Clients &amp; Vendors Khata Directory [F4]
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            360° Financial Ledger, Rate Watchdog, and Cashfree GSTIN Auto-Fetch
          </p>
        </div>

        <button
          onClick={() => {
            setEditingParty(null);
            setPartyModalOpen(true);
          }}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-sm shadow-md flex items-center space-x-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ Register New Party [Alt+C]</span>
        </button>
      </div>

      {/* Main Split-Pane View: Left Directory | Right 360° Dossier */}
      <div className="flex-1 flex space-x-3 overflow-hidden">
        {/* LEFT PANE: Directory List */}
        <div className="w-80 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex flex-col flex-shrink-0">
          {/* Filters & Search */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex space-x-1 text-xs">
              {(['ALL', 'CUSTOMER', 'VENDOR'] as PartyFilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setPartyFilter(f)}
                  className={`flex-1 py-1 font-bold text-[11px] uppercase rounded-sm border ${
                    partyFilter === f
                      ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f === 'CUSTOMER' ? 'Retailers' : 'Vendors'}
                </button>
              ))}
            </div>

            <div className="flex items-center border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 rounded-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, GSTIN, Phone..."
                className="w-full bg-transparent border-none outline-none text-xs"
              />
            </div>
          </div>

          {/* Parties List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filteredParties.map((p) => {
              const isSelected = selectedParty?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectParty(p)}
                  className={`p-2.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-l-4 border-sky-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-extrabold uppercase text-slate-900 dark:text-white truncate max-w-[170px]">
                      {p.name}
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1 py-0.2 rounded-sm ${
                        p.party_type === 'CUSTOMER'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}
                    >
                      {p.party_type === 'CUSTOMER' ? 'CLIENT' : 'VENDOR'}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {p.city} • {p.phone || 'No Phone'}
                  </div>

                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {p.is_gst_registered ? p.gstin : 'NON-GST'}
                    </span>
                    <span className="font-mono font-black text-xs text-sky-700 dark:text-sky-400">
                      ₹{p.current_balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE: 360° Party Intelligence Dossier */}
        {selectedParty ? (
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex flex-col overflow-hidden">
            {/* Dossier Header */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase">
                    {selectedParty.name}
                  </h2>
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm ${
                      selectedParty.is_gst_registered
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {selectedParty.is_gst_registered ? 'GST ACTIVE' : 'UNREGISTERED NON-GST'}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  GSTIN: <span className="font-mono font-bold">{selectedParty.gstin || 'N/A'}</span> | D.L.: {selectedParty.dl_no || 'N/A'} | State: {selectedParty.state_name} ({selectedParty.state_code})
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-sm shadow-sm flex items-center space-x-1"
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>
                    {selectedParty.party_type === 'CUSTOMER' ? '+ Record Receipt' : '+ Record Payment'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setEditingParty(selectedParty);
                    setPartyModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-sm"
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* 5 Executive KPI Cards */}
            <div className="grid grid-cols-5 gap-2 p-3 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-300 dark:border-slate-800 text-xs">
              <div className="bg-white dark:bg-slate-900 p-2 rounded-sm border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Bills</span>
                <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                  {selectedParty.party_type === 'CUSTOMER' ? partySales.length : partyPurchases.length}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-sm border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Volume</span>
                <span className="font-mono font-black text-base text-sky-700 dark:text-sky-300">
                  ₹{totalVolume.toFixed(2)}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-sm border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Settled Payments</span>
                <span className="font-mono font-black text-base text-emerald-700 dark:text-emerald-400">
                  ₹{totalSettled.toFixed(2)}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-sm border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Opening Bal</span>
                <span className="font-mono font-bold text-sm text-slate-600 dark:text-slate-400">
                  ₹{(selectedParty.opening_balance || 0).toFixed(2)}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-sm border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Closing Balance</span>
                <span className="font-mono font-black text-base text-amber-700 dark:text-amber-400">
                  ₹{selectedParty.current_balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 bg-white dark:bg-slate-900 text-xs font-bold">
              <button
                onClick={() => setActiveSubTab('INVOICES')}
                className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 ${
                  activeSubTab === 'INVOICES'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Invoices &amp; Bills ({selectedParty.party_type === 'CUSTOMER' ? partySales.length : partyPurchases.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('LEDGER')}
                className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 ${
                  activeSubTab === 'LEDGER'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Complete Khata Ledger ({ledgerTransactions.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('RATE_WATCHDOG')}
                className={`py-2 px-3 border-b-2 flex items-center space-x-1.5 ${
                  activeSubTab === 'RATE_WATCHDOG'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Rate Watchdog &amp; Medicine History</span>
              </button>
            </div>

            {/* Tab 1: Invoices List */}
            {activeSubTab === 'INVOICES' && (
              <div className="flex-1 overflow-y-auto p-2">
                {selectedParty.party_type === 'CUSTOMER' ? (
                  <table className="w-full text-left border-collapse table-dense text-xs">
                    <thead>
                      <tr className="uppercase text-[10px] font-black text-slate-500">
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th className="text-right">Taxable</th>
                        <th className="text-right">GST Total</th>
                        <th className="text-right">Net Bill Amount</th>
                        <th>Payment</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {partySales.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="font-mono font-black text-slate-900 dark:text-white">{s.invoice_no}</td>
                          <td className="font-mono text-slate-500">{s.sale_date}</td>
                          <td>
                            <span className="font-bold text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                              {s.bill_type === 'GST_INVOICE' ? 'GST INVOICE' : 'SIMPLE MEMO'}
                            </span>
                          </td>
                          <td className="text-right font-mono">₹{s.sub_total.toFixed(2)}</td>
                          <td className="text-right font-mono">₹{s.total_gst.toFixed(2)}</td>
                          <td className="text-right font-mono font-black text-sky-700 dark:text-sky-400">
                            ₹{s.net_amount.toFixed(2)}
                          </td>
                          <td className="uppercase font-bold text-[10px]">{s.payment_mode}</td>
                          <td className="text-center">
                            <button
                              onClick={() => handleReprintSale(s)}
                              className="px-2 py-0.5 bg-slate-800 text-white text-[10px] font-bold rounded-sm flex items-center space-x-1 mx-auto"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View / Print</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse table-dense text-xs">
                    <thead>
                      <tr className="uppercase text-[10px] font-black text-slate-500">
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>Tax Type</th>
                        <th className="text-right">Sub-Total</th>
                        <th className="text-right">Tax Total</th>
                        <th className="text-right">Grand Total</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {partyPurchases.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="font-mono font-black text-slate-900 dark:text-white">{p.supplier_invoice_no}</td>
                          <td className="font-mono text-slate-500">{p.invoice_date}</td>
                          <td className="font-bold text-[10px]">{p.tax_type}</td>
                          <td className="text-right font-mono">₹{p.sub_total.toFixed(2)}</td>
                          <td className="text-right font-mono">₹{(p.total_cgst + p.total_sgst + p.total_igst).toFixed(2)}</td>
                          <td className="text-right font-mono font-black text-indigo-700 dark:text-indigo-400">
                            ₹{p.grand_total.toFixed(2)}
                          </td>
                          <td className="uppercase font-bold text-[10px]">{p.payment_mode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 2: Khata Ledger Statement */}
            {activeSubTab === 'LEDGER' && (
              <div className="flex-1 overflow-y-auto p-2 flex flex-col">
                <div className="pb-2 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Passbook View (Running Balance)</span>
                  <button
                    onClick={handleExportLedgerCsv}
                    className="px-2.5 py-1 bg-slate-800 text-white font-bold rounded-sm flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Ledger CSV</span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse table-dense text-xs flex-1">
                  <thead>
                    <tr className="uppercase text-[10px] font-black text-slate-500">
                      <th>Date</th>
                      <th>Voucher Type</th>
                      <th>Voucher No</th>
                      <th>Narration</th>
                      <th className="text-right">Debit (Dr)</th>
                      <th className="text-right">Credit (Cr)</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {ledgerTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="font-mono text-slate-500">{t.transaction_date}</td>
                        <td className="font-bold uppercase text-[10px]">{t.voucher_type.replace('_', ' ')}</td>
                        <td className="font-mono font-bold text-slate-800 dark:text-slate-200">{t.voucher_no}</td>
                        <td className="truncate max-w-[200px] text-slate-600 dark:text-slate-400">{t.narration}</td>
                        <td className="text-right font-mono text-rose-600 font-bold">
                          {t.debit_amount > 0 ? `₹${t.debit_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="text-right font-mono text-emerald-700 font-bold">
                          {t.credit_amount > 0 ? `₹${t.credit_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="text-right font-mono font-black text-slate-900 dark:text-white">
                          ₹{t.running_balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 3: Rate Watchdog */}
            {activeSubTab === 'RATE_WATCHDOG' && (
              <div className="flex-1 overflow-y-auto p-2">
                <div className="pb-2 text-xs font-bold text-slate-500">
                  Itemized Rate Memory &amp; Price Evolution
                </div>
                <table className="w-full text-left border-collapse table-dense text-xs">
                  <thead>
                    <tr className="uppercase text-[10px] font-black text-slate-500">
                      <th>Medicine Name</th>
                      <th>Batch</th>
                      <th>Date</th>
                      <th className="text-right">Transacted Rate (₹)</th>
                      <th className="text-right">Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {medicineHistory.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="font-bold uppercase text-slate-900 dark:text-white">{h.product_name}</td>
                        <td className="font-mono text-slate-500">{h.batch_no}</td>
                        <td className="font-mono text-slate-500">{h.sale_date || h.invoice_date}</td>
                        <td className="text-right font-mono font-black text-sky-700 dark:text-sky-400">
                          ₹{(h.sale_rate || h.purchase_rate).toFixed(2)}
                        </td>
                        <td className="text-right font-mono font-bold">
                          {(h.qty || h.billed_qty) + (h.free_qty || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm p-8 text-center text-slate-400 text-sm flex items-center justify-center">
            Select a customer or vendor from the left directory to view full 360° transaction dossier.
          </div>
        )}
      </div>

      {/* Modals */}
      {partyModalOpen && (
        <PartyFormModal
          isOpen={partyModalOpen}
          onClose={() => setPartyModalOpen(false)}
          initialParty={editingParty}
          onSaved={() => loadParties()}
        />
      )}

      {paymentModalOpen && selectedParty && (
        <PaymentEntryModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          party={selectedParty}
          onSaved={() => {
            loadParties();
            if (selectedParty) handleSelectParty(selectedParty);
          }}
        />
      )}

      {selectedSaleForPrint && (
        <InvoicePrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          sale={selectedSaleForPrint}
          items={saleItemsForPrint}
          company={company}
        />
      )}
    </div>
  );
};
