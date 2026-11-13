// Radha Drugs Wholesale Pharmaceutical ERP - Quotation & Rate Estimate Module [F9]
// Full CRUD register, status tracking, fast item lookup, zero-stock-impact guarantee & 1-click conversion to Sale Bill

import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Printer,
  Trash2,
  Edit,
  ShoppingCart,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  X,
  Calendar,
  Save,
  RotateCcw,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import {
  CompanyProfile,
  Quotation,
  QuotationItem,
  QuotationStatus,
  Party,
  MedicineMaster,
  InventoryBatch,
  TaxType,
} from '../db/schema';
import { QuotationPrintModal } from '../components/print/QuotationPrintModal';

interface QuotationsPageProps {
  company: CompanyProfile;
  onNavigateToSale?: (quotation: Quotation) => void;
}

export const QuotationsPage: React.FC<QuotationsPageProps> = ({
  company,
  onNavigateToSale,
}) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);

  // Print Modal State
  const [printQuotation, setPrintQuotation] = useState<Quotation | null>(null);
  const [printItems, setPrintItems] = useState<QuotationItem[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Form Master Data
  const [parties, setParties] = useState<Party[]>([]);
  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);

  // Editor Form Fields
  const [quoteNo, setQuoteNo] = useState<string>('');
  const [quoteDate, setQuoteDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [validUntilDate, setValidUntilDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().substring(0, 10);
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Party | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const [taxType, setTaxType] = useState<TaxType>('INTRA_STATE');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<QuotationStatus>('PENDING');

  // Editor Line Items
  interface EditorItem extends QuotationItem {
    tempKey: string;
  }
  const [items, setItems] = useState<EditorItem[]>([]);

  // Item search modal / popup state in grid
  const [activeItemRow, setActiveItemRow] = useState<number | null>(null);
  const [medSearchQuery, setMedSearchQuery] = useState<string>('');
  const [filteredMeds, setFilteredMeds] = useState<MedicineMaster[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Quotations List
  const loadQuotations = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getQuotations(statusFilter, searchQuery);
      setQuotations(data);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [statusFilter, searchQuery]);

  // Load Parties, Medicines, Batches for Editor
  const loadEditorMasterData = async () => {
    try {
      const p = await dbService.query<Party>(
        "SELECT * FROM parties WHERE party_type IN ('CUSTOMER', 'BOTH') ORDER BY name ASC"
      );
      setParties(p);

      const m = await dbService.query<MedicineMaster>(
        'SELECT * FROM medicines_master ORDER BY name ASC'
      );
      setMedicines(m);

      const b = await dbService.query<InventoryBatch>(
        'SELECT * FROM inventory_batches WHERE available_qty > 0 ORDER BY exp_date_iso ASC'
      );
      setBatches(b);
    } catch (err) {
      console.error('Failed to load master data for quotation editor:', err);
    }
  };

  useEffect(() => {
    loadEditorMasterData();
  }, []);

  // Keyboard Shortcuts (Alt+N for new quote, Escape to close editor)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'n' && !isEditorOpen) {
        e.preventDefault();
        handleOpenNewQuotation();
      } else if (e.key === 'Escape' && isEditorOpen) {
        setIsEditorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorOpen]);

  // Open New Quotation Editor
  const handleOpenNewQuotation = async () => {
    const nextNo = await dbService.getNextQuotationNo();
    setQuoteNo(nextNo);
    setQuoteDate(new Date().toISOString().substring(0, 10));
    const validD = new Date();
    validD.setDate(validD.getDate() + 15);
    setValidUntilDate(validD.toISOString().substring(0, 10));
    setSelectedCustomer(null);
    setCustomerSearch('');
    setTaxType('INTRA_STATE');
    setNotes('');
    setStatus('PENDING');
    setEditingQuotationId(null);
    setItems([createEmptyRow()]);
    setIsEditorOpen(true);
  };

  // Open Existing Quotation for Edit
  const handleEditQuotation = async (q: Quotation) => {
    const data = await dbService.getQuotationById(q.id);
    if (!data) return;

    setEditingQuotationId(q.id);
    setQuoteNo(q.quotation_no);
    setQuoteDate(q.quotation_date);
    setValidUntilDate(q.valid_until_date || '');
    setTaxType(q.tax_type);
    setNotes(q.notes || '');
    setStatus(q.status);

    const cust: Party = parties.find((p) => p.id === q.customer_id) || {
      id: q.customer_id,
      name: q.customer_name,
      legal_name: q.customer_name,
      phone: q.customer_phone || '',
      gstin: q.customer_gstin || '',
      dl_no: q.customer_dl_no || '',
      fssai_no: '',
      address: q.customer_address || '',
      city: 'BEGUSARAI',
      party_type: 'CUSTOMER',
      is_gst_registered: q.customer_gstin ? 1 : 0,
      gst_status: q.customer_gstin ? 'ACTIVE' : 'UNREGISTERED',
      opening_balance: 0,
      current_balance: 0,
      credit_limit: 0,
      state_name: 'Bihar',
      state_code: '10',
      created_at: '',
      updated_at: '',
      sync_status: 'PENDING',
    };
    setSelectedCustomer(cust);
    setCustomerSearch(q.customer_name);

    setItems(
      data.items.map((it) => ({
        ...it,
        tempKey: `it_${Math.random()}`,
      }))
    );

    setIsEditorOpen(true);
  };

  const createEmptyRow = (): EditorItem => ({
    tempKey: `it_${Date.now()}_${Math.random()}`,
    id: `QTI_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    quotation_id: '',
    medicine_id: '',
    product_name: '',
    hsn_code: '30049099',
    pack_size: '10x10',
    mfg_by: '',
    batch_no: '',
    exp_date_mm_yy: '',
    available_qty: 0,
    qty: 1,
    free_qty: 0,
    mrp: 0,
    sale_rate: 0,
    discount_percent: 0,
    taxable_amount: 0,
    gst_percent: 12,
    cgst_percent: 6,
    cgst_amount: 0,
    sgst_percent: 6,
    sgst_amount: 0,
    igst_percent: 0,
    igst_amount: 0,
    line_total: 0,
  });

  // Calculate Row Values
  const calculateRow = (row: EditorItem, isInter: boolean): EditorItem => {
    const qty = Number(row.qty) || 0;
    const rate = Number(row.sale_rate) || 0;
    const discPct = Number(row.discount_percent) || 0;
    const gstPct = Number(row.gst_percent) || 0;

    const baseAmount = qty * rate;
    const discountAmount = (baseAmount * discPct) / 100;
    const taxableAmount = Math.max(0, baseAmount - discountAmount);

    let cgstPct = 0;
    let cgstAmt = 0;
    let sgstPct = 0;
    let sgstAmt = 0;
    let igstPct = 0;
    let igstAmt = 0;

    if (isInter) {
      igstPct = gstPct;
      igstAmt = (taxableAmount * igstPct) / 100;
    } else {
      cgstPct = gstPct / 2;
      sgstPct = gstPct / 2;
      cgstAmt = (taxableAmount * cgstPct) / 100;
      sgstAmt = (taxableAmount * sgstPct) / 100;
    }

    const totalTax = isInter ? igstAmt : cgstAmt + sgstAmt;
    const lineTotal = taxableAmount + totalTax;

    return {
      ...row,
      qty,
      sale_rate: rate,
      discount_percent: discPct,
      taxable_amount: Number(taxableAmount.toFixed(2)),
      gst_percent: gstPct,
      cgst_percent: cgstPct,
      cgst_amount: Number(cgstAmt.toFixed(2)),
      sgst_percent: sgstPct,
      sgst_amount: Number(sgstAmt.toFixed(2)),
      igst_percent: igstPct,
      igst_amount: Number(igstAmt.toFixed(2)),
      line_total: Number(lineTotal.toFixed(2)),
    };
  };

  const handleItemFieldChange = (
    index: number,
    field: keyof QuotationItem,
    value: any
  ) => {
    const updated = [...items];
    const target = { ...updated[index], [field]: value };
    updated[index] = calculateRow(target, taxType === 'INTER_STATE');
    setItems(updated);
  };

  const handleSelectMedicineForRow = (index: number, med: MedicineMaster) => {
    // Find any batch in stock for this medicine to default batch, MRP & rate
    const medBatches = batches.filter((b) => b.medicine_id === med.id);
    const primaryBatch = medBatches.length > 0 ? medBatches[0] : null;

    const updated = [...items];
    const row = updated[index];

    row.medicine_id = med.id;
    row.product_name = med.name;
    row.hsn_code = med.hsn_code || '30049099';
    row.pack_size = med.pack_size || '10x10';
    row.mfg_by = med.mfg_by || '';
    row.gst_percent = med.gst_percent || 12;

    if (primaryBatch) {
      row.batch_id = primaryBatch.id;
      row.batch_no = primaryBatch.batch_no;
      row.exp_date_mm_yy = primaryBatch.exp_date_mm_yy;
      row.available_qty = primaryBatch.available_qty;
      row.mrp = primaryBatch.mrp;
      row.sale_rate = primaryBatch.default_sale_rate || primaryBatch.mrp * 0.8;
    } else {
      row.batch_no = 'TBD';
      row.exp_date_mm_yy = '';
      row.available_qty = 0;
      row.mrp = 100;
      row.sale_rate = 80;
    }

    updated[index] = calculateRow(row, taxType === 'INTER_STATE');
    setItems(updated);
    setActiveItemRow(null);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      setItems([createEmptyRow()]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleAddRow = () => {
    setItems([...items, createEmptyRow()]);
  };

  // Grand Totals Calculation
  const isInterState = taxType === 'INTER_STATE';
  const subTotal = items.reduce((sum, it) => sum + (it.taxable_amount || 0), 0);
  const totalCgst = isInterState
    ? 0
    : items.reduce((sum, it) => sum + (it.cgst_amount || 0), 0);
  const totalSgst = isInterState
    ? 0
    : items.reduce((sum, it) => sum + (it.sgst_amount || 0), 0);
  const totalIgst = isInterState
    ? items.reduce((sum, it) => sum + (it.igst_amount || 0), 0)
    : 0;
  const totalGst = totalCgst + totalSgst + totalIgst;
  const rawTotal = subTotal + totalGst;
  const roundedNet = Math.round(rawTotal);
  const roundOff = Number((roundedNet - rawTotal).toFixed(2));

  // Save Quotation
  const handleSaveQuotation = async (andPrint: boolean = false, andConvert: boolean = false) => {
    if (!selectedCustomer) {
      alert('Please select a customer for this quotation.');
      return;
    }

    const validItems = items.filter((it) => it.product_name && it.qty > 0);
    if (validItems.length === 0) {
      alert('Please add at least one product with quantity greater than zero.');
      return;
    }

    const quoteId = editingQuotationId || `QT_${Date.now()}`;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const quotationData: Quotation = {
      id: quoteId,
      quotation_no: quoteNo,
      quotation_date: quoteDate,
      valid_until_date: validUntilDate,
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      customer_phone: selectedCustomer.phone || '',
      customer_gstin: selectedCustomer.gstin || '',
      customer_dl_no: selectedCustomer.dl_no || '',
      customer_address: `${selectedCustomer.address || ''}, ${selectedCustomer.city || ''}`.trim(),
      tax_type: taxType,
      sub_total: Number(subTotal.toFixed(2)),
      bill_discount_amount: 0,
      other_adjustment: 0,
      total_cgst: Number(totalCgst.toFixed(2)),
      total_sgst: Number(totalSgst.toFixed(2)),
      total_igst: Number(totalIgst.toFixed(2)),
      total_gst: Number(totalGst.toFixed(2)),
      round_off: roundOff,
      net_amount: roundedNet,
      status: status,
      notes: notes,
      created_at: nowIso,
      updated_at: nowIso,
      sync_status: 'PENDING',
    };

    const cleanItems: QuotationItem[] = validItems.map((it, idx) => ({
      id: it.id || `QTI_${quoteId}_${idx}`,
      quotation_id: quoteId,
      medicine_id: it.medicine_id,
      batch_id: it.batch_id,
      product_name: it.product_name,
      hsn_code: it.hsn_code,
      pack_size: it.pack_size,
      mfg_by: it.mfg_by,
      batch_no: it.batch_no || 'TBD',
      exp_date_mm_yy: it.exp_date_mm_yy || '',
      available_qty: it.available_qty || 0,
      qty: Number(it.qty),
      free_qty: Number(it.free_qty || 0),
      mrp: Number(it.mrp),
      sale_rate: Number(it.sale_rate),
      discount_percent: Number(it.discount_percent || 0),
      taxable_amount: Number(it.taxable_amount),
      gst_percent: Number(it.gst_percent),
      cgst_percent: Number(it.cgst_percent || 0),
      cgst_amount: Number(it.cgst_amount || 0),
      sgst_percent: Number(it.sgst_percent || 0),
      sgst_amount: Number(it.sgst_amount || 0),
      igst_percent: Number(it.igst_percent || 0),
      igst_amount: Number(it.igst_amount || 0),
      line_total: Number(it.line_total),
    }));

    try {
      await dbService.saveQuotation(quotationData, cleanItems);
      setIsEditorOpen(false);
      await loadQuotations();

      if (andPrint) {
        setPrintQuotation(quotationData);
        setPrintItems(cleanItems);
        setIsPrintModalOpen(true);
      } else if (andConvert) {
        if (onNavigateToSale) {
          quotationData.items = cleanItems;
          onNavigateToSale(quotationData);
        }
      }
    } catch (err: any) {
      alert(`Failed to save quotation: ${err.message}`);
    }
  };

  // Open Print Modal for existing quotation
  const handlePrintClick = async (q: Quotation) => {
    const data = await dbService.getQuotationById(q.id);
    if (!data) return;
    setPrintQuotation(data.quotation);
    setPrintItems(data.items);
    setIsPrintModalOpen(true);
  };

  // Delete Quotation
  const handleDeleteQuotation = async (q: Quotation) => {
    const confirmMsg = `⚠️ Delete Quotation ${q.quotation_no} for ${q.customer_name}?\n\nThis will remove the quotation permanently. Inventory stock is not affected.`;
    if (!confirm(confirmMsg)) return;

    try {
      await dbService.deleteQuotation(q.id);
      await loadQuotations();
    } catch (err: any) {
      alert(`Failed to delete quotation: ${err.message}`);
    }
  };

  // Convert Quotation to Sale Bill
  const handleConvertClick = async (q: Quotation) => {
    const data = await dbService.getQuotationById(q.id);
    if (!data) return;
    if (onNavigateToSale) {
      data.quotation.items = data.items;
      onNavigateToSale(data.quotation);
    }
  };

  // Filter medicines when searching in grid
  useEffect(() => {
    if (!medSearchQuery.trim()) {
      setFilteredMeds(medicines.slice(0, 30));
    } else {
      const q = medSearchQuery.toUpperCase();
      setFilteredMeds(
        medicines.filter((m) => m.name.toUpperCase().includes(q)).slice(0, 30)
      );
    }
  }, [medSearchQuery, medicines]);

  // Summary Metrics
  const totalQuotesCount = quotations.length;
  const pendingQuotesCount = quotations.filter((q) => q.status === 'PENDING').length;
  const convertedQuotesCount = quotations.filter((q) => q.status === 'CONVERTED').length;
  const totalQuotesAmount = quotations.reduce((sum, q) => sum + (q.net_amount || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-xs">
      {/* 1. TOP METRICS HEADER */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm select-none">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-amber-600 rounded-sm flex items-center justify-center text-white shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
                Price Quotations &amp; Rate Estimates [F9]
              </h1>
              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-sm font-extrabold text-[10px] border border-emerald-300 dark:border-emerald-800">
                ZERO INVENTORY IMPACT
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Prepare wholesale rate estimates, print branded quotes, and convert to sale bills in 1-click
            </p>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-sm text-center">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Total Quotes</div>
            <div className="text-sm font-black text-slate-800 dark:text-white font-mono">
              {totalQuotesCount}
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-sm text-center">
            <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold">Pending</div>
            <div className="text-sm font-black text-amber-600 font-mono">
              {pendingQuotesCount}
            </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-sm text-center">
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Converted</div>
            <div className="text-sm font-black text-emerald-600 font-mono">
              {convertedQuotesCount}
            </div>
          </div>
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-3 py-1.5 rounded-sm text-center">
            <div className="text-[10px] text-sky-700 dark:text-sky-400 uppercase font-bold">Total Est. Value</div>
            <div className="text-sm font-black text-sky-700 dark:text-sky-300 font-mono">
              ₹{totalQuotesAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* New Quotation Button */}
          <button
            onClick={handleOpenNewQuotation}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-sm shadow-md flex items-center space-x-1.5 transition-all"
            title="Create New Wholesale Quotation (Alt+N)"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>New Quotation [Alt+N]</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER & SEARCH TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-3 select-none">
        {/* Status Filter Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-sm border border-slate-300 dark:border-slate-700 text-xs font-bold">
          {['ALL', 'PENDING', 'CONVERTED', 'EXPIRED', 'CANCELLED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 rounded-sm uppercase transition-all ${
                statusFilter === tab
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Quote No, Customer Name, Phone, or GSTIN..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm font-medium"
            />
          </div>
          <button
            onClick={loadQuotations}
            className="p-1.5 border border-slate-300 dark:border-slate-700 rounded-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh List"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. QUOTATION REGISTER TABLE */}
      <div className="flex-1 overflow-auto p-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 font-extrabold uppercase text-slate-700 dark:text-slate-300">
                <th className="py-2 px-3 w-10 text-center">#</th>
                <th className="py-2 px-3">Quotation No</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Valid Until</th>
                <th className="py-2 px-3">Customer / Pharmacy</th>
                <th className="py-2 px-3">Tax Type</th>
                <th className="py-2 px-3 text-right">Net Amount</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Loading quotations from local SQLite database...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="font-bold text-sm">No quotations found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "+ New Quotation [Alt+N]" to generate your first estimate
                    </p>
                  </td>
                </tr>
              ) : (
                quotations.map((q, idx) => (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-700 dark:text-sky-300">
                      {q.quotation_no}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{q.quotation_date}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {q.valid_until_date || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-white uppercase">
                        {q.customer_name}
                      </div>
                      <div className="text-[10.5px] text-slate-500 font-mono">
                        {q.customer_phone || q.customer_gstin || 'Retail / Walk-in'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] font-mono">
                      {q.tax_type === 'INTER_STATE'
                        ? 'INTER (IGST)'
                        : q.tax_type === 'NON_GST'
                        ? 'NON-GST'
                        : 'INTRA (CGST+SGST)'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                      ₹{q.net_amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm font-extrabold text-[10px] uppercase border ${
                          q.status === 'CONVERTED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                            : q.status === 'EXPIRED'
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                            : q.status === 'CANCELLED'
                            ? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {q.status}
                      </span>
                      {q.converted_invoice_no && (
                        <div className="text-[9.5px] font-mono text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                          Bill: {q.converted_invoice_no}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {/* 1-Click Convert to Sale Bill */}
                        {q.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleConvertClick(q)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm transition-all"
                            title="Convert to Wholesale Sale Bill [F1]"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Print / Preview */}
                        <button
                          onClick={() => handlePrintClick(q)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-sm transition-all"
                          title="Print or Export PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit (if pending) */}
                        {q.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleEditQuotation(q)}
                            className="p-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-sm transition-all"
                            title="Edit Quotation"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteQuotation(q)}
                          className="p-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-sm transition-all"
                          title="Delete Quotation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL: QUOTATION CREATION & EDIT DRAWER */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-700 select-none">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span className="font-extrabold text-sm uppercase tracking-wide">
                  {editingQuotationId ? `Edit Quotation [${quoteNo}]` : 'Create New Wholesale Quotation'}
                </span>
                <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-bold border border-slate-700">
                  Zero Stock Deduction
                </span>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Customer & Quotation Meta */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-300 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-3 select-none">
              {/* Quotation No */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Quotation No.
                </label>
                <input
                  type="text"
                  value={quoteNo}
                  onChange={(e) => setQuoteNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Quotation Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Quotation Date
                </label>
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Valid Until Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Valid Until Date
                </label>
                <input
                  type="date"
                  value={validUntilDate}
                  onChange={(e) => setValidUntilDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Tax Supply Type */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Tax Supply Type
                </label>
                <select
                  value={taxType}
                  onChange={(e) => {
                    const newType = e.target.value as TaxType;
                    setTaxType(newType);
                    // Recalculate all lines with new tax type
                    const isInter = newType === 'INTER_STATE';
                    setItems(items.map((row) => calculateRow(row, isInter)));
                  }}
                  className="w-full px-2.5 py-1.5 font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="INTRA_STATE">INTRA-STATE (CGST + SGST - Bihar)</option>
                  <option value="INTER_STATE">INTER-STATE (IGST - Outside Bihar)</option>
                  <option value="NON_GST">NON-GST (0% Tax Memo)</option>
                </select>
              </div>

              {/* Customer Selector Typeahead */}
              <div className="md:col-span-3 relative">
                <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Customer / Retail Pharmacy *
                </label>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  placeholder="Type to search customer by name, town, or phone..."
                  className="w-full px-2.5 py-1.5 font-bold uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />

                {/* Customer Dropdown */}
                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xl max-h-56 overflow-auto z-50 divide-y divide-slate-100 dark:divide-slate-800">
                    {parties
                      .filter(
                        (p) =>
                          p.name.toUpperCase().includes(customerSearch.toUpperCase()) ||
                          (p.city && p.city.toUpperCase().includes(customerSearch.toUpperCase())) ||
                          (p.phone && p.phone.includes(customerSearch))
                      )
                      .slice(0, 20)
                      .map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedCustomer(p);
                            setCustomerSearch(p.name);
                            setIsCustomerDropdownOpen(false);
                            // Auto detect interstate
                            if (p.state_code && p.state_code !== '10') {
                              setTaxType('INTER_STATE');
                              setItems(items.map((row) => calculateRow(row, true)));
                            }
                          }}
                          className="p-2 hover:bg-sky-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white uppercase">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {p.city || 'BEGUSARAI'} | Phone: {p.phone || 'NA'} | D.L.: {p.dl_no || 'NA'}
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <span className="text-slate-400">Bal: </span>
                            <span
                              className={`font-bold ${
                                p.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              ₹{p.current_balance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QuotationStatus)}
                  className="w-full px-2.5 py-1.5 font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  <option value="PENDING">PENDING (Issued)</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            {/* Modal Body: Line Items Grid */}
            <div className="flex-1 overflow-auto p-4 space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="font-extrabold uppercase text-slate-800 dark:text-white">
                  Quotation Particulars ({items.length} items)
                </span>
                <span className="text-[10.5px] text-slate-500">
                  Tip: Rate and scheme discounts will not alter master price memory until billed
                </span>
              </div>

              <div className="border border-slate-300 dark:border-slate-700 rounded-sm overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 font-extrabold uppercase text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-700">
                      <th className="py-2 px-2 w-8 text-center">#</th>
                      <th className="py-2 px-2 w-72">Medicine / Product *</th>
                      <th className="py-2 px-2 w-24">Pack</th>
                      <th className="py-2 px-2 w-28">Batch No</th>
                      <th className="py-2 px-2 w-20">Exp</th>
                      <th className="py-2 px-2 w-16 text-right">Qty *</th>
                      <th className="py-2 px-2 w-16 text-right">Free</th>
                      <th className="py-2 px-2 w-20 text-right">MRP</th>
                      <th className="py-2 px-2 w-24 text-right">Quoted Rate *</th>
                      <th className="py-2 px-2 w-16 text-right">Dis %</th>
                      <th className="py-2 px-2 w-16 text-right">GST %</th>
                      <th className="py-2 px-2 w-28 text-right">Line Total</th>
                      <th className="py-2 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.map((row, idx) => (
                      <tr key={row.tempKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-1 px-2 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Medicine Selector */}
                        <td className="py-1 px-2 relative">
                          <input
                            type="text"
                            value={row.product_name}
                            onChange={(e) => {
                              handleItemFieldChange(idx, 'product_name', e.target.value);
                              setMedSearchQuery(e.target.value);
                              setActiveItemRow(idx);
                            }}
                            onFocus={() => {
                              setMedSearchQuery(row.product_name || '');
                              setActiveItemRow(idx);
                            }}
                            placeholder="Type medicine name..."
                            className="w-full px-2 py-1 font-bold uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />

                          {/* Medicine Typeahead Popup */}
                          {activeItemRow === idx && (
                            <div className="absolute left-2 right-2 top-full mt-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl max-h-52 overflow-auto z-50 divide-y divide-slate-100 dark:divide-slate-800">
                              <div className="p-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                                <span>Select Medicine</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveItemRow(null)}
                                  className="text-slate-400 hover:text-black dark:hover:text-white"
                                >
                                  Close ✕
                                </button>
                              </div>
                              {filteredMeds.map((med) => {
                                const stockBatches = batches.filter((b) => b.medicine_id === med.id);
                                const totalStock = stockBatches.reduce((s, b) => s + b.available_qty, 0);

                                return (
                                  <div
                                    key={med.id}
                                    onClick={() => handleSelectMedicineForRow(idx, med)}
                                    className="p-1.5 hover:bg-sky-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                                  >
                                    <div>
                                      <div className="font-bold uppercase text-slate-900 dark:text-white">
                                        {med.name}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {med.pack_size || '10x10'} | {med.mfg_by || 'Pharma'} | GST: {med.gst_percent}%
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span
                                        className={`font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded ${
                                          totalStock > 0
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                        }`}
                                      >
                                        Stock: {totalStock}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Pack */}
                        <td className="py-1 px-2">
                          <input
                            type="text"
                            value={row.pack_size}
                            onChange={(e) => handleItemFieldChange(idx, 'pack_size', e.target.value)}
                            className="w-full px-2 py-1 font-mono uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* Batch No */}
                        <td className="py-1 px-2">
                          <input
                            type="text"
                            value={row.batch_no}
                            onChange={(e) => handleItemFieldChange(idx, 'batch_no', e.target.value)}
                            placeholder="TBD"
                            className="w-full px-2 py-1 font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* Exp Date */}
                        <td className="py-1 px-2">
                          <input
                            type="text"
                            value={row.exp_date_mm_yy}
                            onChange={(e) => handleItemFieldChange(idx, 'exp_date_mm_yy', e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-2 py-1 font-mono text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            min="1"
                            value={row.qty}
                            onChange={(e) => handleItemFieldChange(idx, 'qty', parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2 py-1 font-mono font-bold text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* Free Qty */}
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            min="0"
                            value={row.free_qty}
                            onChange={(e) => handleItemFieldChange(idx, 'free_qty', parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2 py-1 font-mono text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* MRP */}
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.mrp}
                            onChange={(e) => handleItemFieldChange(idx, 'mrp', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 font-mono text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* Quoted Rate */}
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.sale_rate}
                            onChange={(e) => handleItemFieldChange(idx, 'sale_rate', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 font-mono font-bold text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* Discount % */}
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            step="0.1"
                            value={row.discount_percent}
                            onChange={(e) => handleItemFieldChange(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 font-mono text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          />
                        </td>

                        {/* GST % */}
                        <td className="py-1 px-2">
                          <select
                            value={row.gst_percent}
                            onChange={(e) => handleItemFieldChange(idx, 'gst_percent', parseFloat(e.target.value) || 0)}
                            className="w-full px-1 py-1 font-mono text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>

                        {/* Line Total */}
                        <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{row.line_total.toFixed(2)}
                        </td>

                        {/* Delete row */}
                        <td className="py-1 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-sm font-bold flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line [Enter]</span>
              </button>
            </div>

            {/* Modal Footer: Totals & Action Buttons */}
            <div className="bg-slate-100 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 select-none">
              {/* Left: Notes */}
              <div className="flex-1 min-w-[280px]">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Quotation notes, terms, or customer special instructions..."
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-sm"
                />
              </div>

              {/* Center: Financial Summary */}
              <div className="flex items-center space-x-4 text-xs font-bold font-mono">
                <div>
                  <span className="text-slate-400">Subtotal: </span>
                  <span>₹{subTotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400">GST Tax: </span>
                  <span>₹{totalGst.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Round: </span>
                  <span>{roundOff >= 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
                </div>
                <div className="text-sm bg-sky-100 dark:bg-sky-950/80 text-sky-900 dark:text-sky-200 px-3 py-1 rounded-sm border border-sky-300 dark:border-sky-800">
                  <span className="font-extrabold">EST. TOTAL: </span>
                  <span className="font-black">₹{roundedNet.toFixed(2)}</span>
                </div>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-3 py-2 bg-slate-300 dark:bg-slate-800 hover:bg-slate-400 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-sm"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuotation(false, false)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-sm shadow-sm flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Quotation</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuotation(true, false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold rounded-sm shadow-sm flex items-center space-x-1.5 border border-slate-700"
                >
                  <Printer className="w-4 h-4 text-sky-400" />
                  <span>Save &amp; Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuotation(false, true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-sm shadow-md flex items-center space-x-1.5"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Save &amp; Convert to Bill [F1]</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: QUOTATION PRINT PREVIEW */}
      {isPrintModalOpen && printQuotation && (
        <QuotationPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          quotation={printQuotation}
          items={printItems}
          company={company}
          onConvertToSaleBill={(q) => {
            setIsPrintModalOpen(false);
            handleConvertClick(q);
          }}
        />
      )}
    </div>
  );
};
