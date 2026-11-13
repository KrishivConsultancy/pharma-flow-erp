// 3-Way Smart Stock Entry Engine: Manual Grid, AI Vision Bill Scanner, and Marg CSV Importer
// Automatically handles Indian pharma schemes (e.g. 100+20), computes Net Landing Cost, and updates Vendor Khata

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Upload,
  Camera,
  FileSpreadsheet,
  Plus,
  Trash2,
  Building2,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import {
  CompanyProfile,
  Party,
  MedicineMaster,
  InventoryBatch,
  Purchase,
  PurchaseItem,
  TaxType,
  PaymentMode,
} from '../db/schema';
import { AiInvoiceScanModal } from '../components/modals/AiInvoiceScanModal';
import { PartyFormModal } from '../components/modals/PartyFormModal';
import { ExtractedInvoice, GeminiOcrService } from '../services/geminiOcrService';
import { toast } from '../services/toastService';

interface PurchaseLineRow {
  id: string;
  medicine_id?: string;
  product_name: string;
  hsn_code: string;
  pack_size: string;
  mfg_by: string;
  batch_no: string;
  exp_date_mm_yy: string;
  billed_qty: number;
  free_qty: number;
  raw_qty_input?: string; // Supports typing "100+20"
  mrp: number;
  old_mrp: number;
  purchase_rate: number;
  discount_percent: number;
  taxable_amount: number;
  gst_percent: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
  net_landing_cost: number;
}

interface PurchaseEntryPageProps {
  company: CompanyProfile;
}

export const PurchaseEntryPage: React.FC<PurchaseEntryPageProps> = ({ company }) => {
  const [vendors, setVendors] = useState<Party[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<Party | null>(null);
  const [vendorError, setVendorError] = useState<boolean>(false);

  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CREDIT');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [items, setItems] = useState<PurchaseLineRow[]>([]);
  const [medicinesMaster, setMedicinesMaster] = useState<MedicineMaster[]>([]);

  // Modals
  const [aiScannerOpen, setAiScannerOpen] = useState<boolean>(false);
  const [partyModalOpen, setPartyModalOpen] = useState<boolean>(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const vendorSelectRef = useRef<HTMLSelectElement>(null);

  // Load vendors & medicines catalog
  const loadMasterData = async () => {
    try {
      const vends = await dbService.query<Party>(
        "SELECT * FROM parties WHERE party_type = 'VENDOR' ORDER BY name ASC"
      );
      setVendors(vends);

      // Do NOT auto-select the first vendor to prevent accidental ledger booking
      if (selectedVendorId) {
        const found = vends.find(v => v.id === selectedVendorId);
        if (found) setSelectedVendor(found);
      }

      const meds = await dbService.query<MedicineMaster>('SELECT * FROM medicines_master ORDER BY name ASC');
      setMedicinesMaster(meds);
    } catch (err) {
      console.error('Failed to load purchase master data:', err);
    }
  };

  useEffect(() => {
    loadMasterData();
    const unsub = dbService.subscribe(loadMasterData);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10' || (e.altKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleSavePurchaseBill();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleAddNewRow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsub();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [items, selectedVendor, supplierInvoiceNo, invoiceDate, paymentMode, amountPaid, notes]);

  const isInterState = selectedVendor ? selectedVendor.state_code !== '10' : true;

  // Exact Indian Pharma Net Landing Cost formula:
  // Net Landing Cost = (Billed Qty * Purchase Rate * (1 - Disc/100)) / (Billed Qty + Free Qty)
  const calculateRowMath = (row: Partial<PurchaseLineRow>): PurchaseLineRow => {
    let billed = Number(row.billed_qty) || 0;
    let free = Number(row.free_qty) || 0;

    // Check raw_qty_input for "100+20" syntax
    if (row.raw_qty_input && row.raw_qty_input.includes('+')) {
      const parsed = GeminiOcrService.parseSchemeQuantity(row.raw_qty_input);
      billed = parsed.billedQty;
      free = parsed.freeQty;
    }

    const rate = Number(row.purchase_rate) || 0;
    const disc = Number(row.discount_percent) || 0;
    const gst = Number(row.gst_percent ?? 5);

    const rawTaxable = billed * rate * (1 - disc / 100);
    const taxableAmount = Math.round(rawTaxable * 100) / 100;

    const totalUnits = billed + free;
    const landing = totalUnits > 0 ? Math.round((taxableAmount / totalUnits) * 100) / 100 : rate;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gst > 0) {
      if (isInterState) {
        igst = Math.round((taxableAmount * gst) / 100 * 100) / 100;
      } else {
        cgst = Math.round((taxableAmount * (gst / 2)) / 100 * 100) / 100;
        sgst = Math.round((taxableAmount * (gst / 2)) / 100 * 100) / 100;
      }
    }

    const lineTotal = Math.round((taxableAmount + cgst + sgst + igst) * 100) / 100;

    return {
      id: row.id || `PITEM_${Date.now()}_${Math.random().toString().slice(-4)}`,
      medicine_id: row.medicine_id,
      product_name: row.product_name ? row.product_name.toUpperCase() : '',
      hsn_code: row.hsn_code || '30049099',
      pack_size: row.pack_size || '',
      mfg_by: row.mfg_by || '',
      batch_no: row.batch_no ? row.batch_no.toUpperCase() : '',
      exp_date_mm_yy: row.exp_date_mm_yy || '05/28',
      billed_qty: billed,
      free_qty: free,
      raw_qty_input: row.raw_qty_input || `${billed}${free > 0 ? `+${free}` : ''}`,
      mrp: Number(row.mrp) || 0,
      old_mrp: Number(row.old_mrp) || 0,
      purchase_rate: rate,
      discount_percent: disc,
      taxable_amount: taxableAmount,
      gst_percent: gst,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      line_total: lineTotal,
      net_landing_cost: landing,
    };
  };

  // Add empty row
  const handleAddNewRow = () => {
    const empty = calculateRowMath({
      product_name: '',
      billed_qty: 0,
      free_qty: 0,
      raw_qty_input: '',
      purchase_rate: 0,
      mrp: 0,
      gst_percent: 12,
    });
    setItems((prev) => [...prev, empty]);
  };

  // Preload initial row if empty
  useEffect(() => {
    if (items.length === 0) {
      handleAddNewRow();
    }
  }, []);

  // Update line item
  const handleUpdateItem = (index: number, field: keyof PurchaseLineRow, val: any) => {
    const newItems = [...items];
    const target = { ...newItems[index], [field]: val };

    // Auto-fill from medicines_master if matched
    if (field === 'product_name') {
      const match = medicinesMaster.find((m) => m.name.toLowerCase() === String(val).toLowerCase());
      if (match) {
        target.medicine_id = match.id;
        target.hsn_code = match.hsn_code;
        target.pack_size = match.pack_size;
        target.mfg_by = match.mfg_by;
        target.gst_percent = match.gst_percent;
      }
    }

    newItems[index] = calculateRowMath(target);
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      handleAddNewRow();
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Handle transfer from AI Scanner Modal
  const handleApplyAiExtraction = async (extracted: ExtractedInvoice) => {
    // If supplier matches a known vendor, select them
    let matchedVendor = vendors.find(
      (v) =>
        (extracted.vendor_gstin && v.gstin && v.gstin.trim().toUpperCase() === extracted.vendor_gstin.trim().toUpperCase()) ||
        (extracted.vendor_name && v.name.toLowerCase().includes(extracted.vendor_name.toLowerCase()))
    );

    // If not found in current vendors list, auto-create vendor in DB so the user isn't blocked
    if (!matchedVendor && extracted.vendor_name && extracted.vendor_name.trim().length > 0) {
      const newVendorId = `PARTY_VEND_${Date.now()}`;
      const stateCode = extracted.vendor_gstin && extracted.vendor_gstin.length >= 2
        ? extracted.vendor_gstin.substring(0, 2)
        : '10';
      const autoVendor: Party = {
        id: newVendorId,
        party_type: 'VENDOR',
        is_gst_registered: extracted.vendor_gstin ? 1 : 0,
        gstin: extracted.vendor_gstin || '',
        name: extracted.vendor_name.trim().toUpperCase(),
        legal_name: extracted.vendor_name.trim().toUpperCase(),
        dl_no: extracted.vendor_dl_no || '',
        fssai_no: '',
        phone: '',
        address: extracted.vendor_address || '',
        city: '',
        state_name: stateCode === '10' ? 'BIHAR' : 'Other State',
        state_code: stateCode,
        opening_balance: 0,
        current_balance: 0,
        credit_limit: 500000,
        gst_status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'PENDING',
      };

      try {
        await dbService.query(
          `INSERT INTO parties (id, name, party_type, gstin, state_code, state_name, address, city, current_balance, credit_limit, created_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            autoVendor.id,
            autoVendor.name,
            autoVendor.party_type,
            autoVendor.gstin,
            autoVendor.state_code,
            autoVendor.state_name,
            autoVendor.address,
            autoVendor.city,
            autoVendor.current_balance,
            autoVendor.credit_limit,
            autoVendor.created_at,
            autoVendor.sync_status,
          ]
        );
        matchedVendor = autoVendor;
        setVendors((prev) => [...prev, autoVendor]);
      } catch (e) {
        console.warn('Could not auto-register extracted vendor:', e);
      }
    }

    if (matchedVendor) {
      setSelectedVendorId(matchedVendor.id);
      setSelectedVendor(matchedVendor);
    }

    if (extracted.invoice_no) setSupplierInvoiceNo(extracted.invoice_no);
    if (extracted.invoice_date) setInvoiceDate(extracted.invoice_date);

    // Convert items into PurchaseLineRow
    const convertedRows: PurchaseLineRow[] = extracted.items.map((it) => {
      const matchedMed = medicinesMaster.find(
        (m) => m.name.toLowerCase() === it.product_name.toLowerCase()
      );
      return calculateRowMath({
        medicine_id: matchedMed?.id,
        product_name: it.product_name,
        hsn_code: it.hsn_code,
        pack_size: it.pack_size,
        mfg_by: it.mfg_by,
        batch_no: it.batch_no,
        exp_date_mm_yy: it.exp_date_mm_yy,
        billed_qty: it.billed_qty,
        free_qty: it.free_qty,
        raw_qty_input: `${it.billed_qty}${it.free_qty > 0 ? `+${it.free_qty}` : ''}`,
        mrp: it.mrp,
        old_mrp: it.old_mrp,
        purchase_rate: it.purchase_rate,
        discount_percent: it.discount_percent,
        gst_percent: it.gst_percent,
      });
    });

    if (convertedRows.length > 0) {
      setItems(convertedRows);
    }
  };

  // Handle CSV Import
  const handleCsvFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        toast.error('Invalid CSV file: at least one header and one data row required.');
        return;
      }

      const rows: PurchaseLineRow[] = [];
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 5) continue;

        // Assumes standard Marg/Medisoft columns: Item, Pack, Mfg, Batch, Exp, Qty, Free, MRP, Rate, GST
        const name = cols[0] || 'MEDICINE';
        const pack = cols[1] || '';
        const mfg = cols[2] || '';
        const batch = cols[3] || 'B' + Date.now().toString().slice(-4);
        const exp = cols[4] || '05/28';
        const rawQty = cols[5] || '10';
        const free = parseInt(cols[6], 10) || 0;
        const mrp = parseFloat(cols[7]) || 0;
        const rate = parseFloat(cols[8]) || 0;
        const gst = parseFloat(cols[9]) || 5;

        rows.push(
          calculateRowMath({
            product_name: name,
            pack_size: pack,
            mfg_by: mfg,
            batch_no: batch,
            exp_date_mm_yy: exp,
            raw_qty_input: rawQty,
            free_qty: free,
            mrp,
            purchase_rate: rate,
            gst_percent: gst,
          })
        );
      }

      if (rows.length > 0) {
        setItems(rows);
        toast.success(`Successfully imported ${rows.length} items from CSV!`);
      }
    };
    reader.readAsText(file);
  };

  // Bill Totals Calculation
  const subTotal = items.reduce((sum, it) => sum + it.taxable_amount, 0);
  const totalCgst = items.reduce((sum, it) => sum + it.cgst_amount, 0);
  const totalSgst = items.reduce((sum, it) => sum + it.sgst_amount, 0);
  const totalIgst = items.reduce((sum, it) => sum + it.igst_amount, 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const rawGrand = subTotal + totalGst;
  const grandTotal = Math.round(rawGrand);
  const roundOff = Math.round((grandTotal - rawGrand) * 100) / 100;

  // ATOMIC COMMIT: Save Purchase Bill & Add to Physical Stock
  const handleSavePurchaseBill = async () => {
    if (!selectedVendor) {
      setVendorError(true);
      toast.error('Please select a supplier / vendor first.', { title: 'Vendor Required' });
      vendorSelectRef.current?.focus();
      return;
    }
    setVendorError(false);

    if (!supplierInvoiceNo.trim()) {
      toast.error('Please enter supplier invoice number.', { title: 'Invoice Number Required' });
      return;
    }

    const validItems = items.filter((it) => it.product_name && (it.billed_qty + it.free_qty) > 0 && it.batch_no);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item with batch and quantity.', { title: 'Empty Inward Bill' });
      return;
    }

    const purchaseId = `PURCHASE_${Date.now()}`;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const purchaseHeader: Purchase = {
      id: purchaseId,
      supplier_invoice_no: supplierInvoiceNo.trim(),
      invoice_date: invoiceDate,
      vendor_id: selectedVendor.id,
      tax_type: isInterState ? 'INTER_STATE' : 'INTRA_STATE',
      sub_total: subTotal,
      discount_amount: 0,
      total_cgst: totalCgst,
      total_sgst: totalSgst,
      total_igst: totalIgst,
      round_off: roundOff,
      grand_total: grandTotal,
      amount_paid: paymentMode === 'CREDIT' ? 0 : amountPaid > 0 ? amountPaid : grandTotal,
      payment_mode: paymentMode,
      entry_source: 'MANUAL',
      notes: notes.trim(),
      created_at: nowIso,
      sync_status: 'PENDING',
    };

    // Auto-learn new medicines
    const newMedicines: Partial<MedicineMaster>[] = [];
    const purchaseItems: PurchaseItem[] = validItems.map((it, idx) => {
      const medId = it.medicine_id || `MED_${it.product_name.replace(/[^A-Z0-9]/g, '_')}`;
      if (!it.medicine_id) {
        newMedicines.push({
          id: medId,
          name: it.product_name,
          hsn_code: it.hsn_code,
          pack_size: it.pack_size,
          mfg_by: it.mfg_by,
          gst_percent: it.gst_percent,
        });
      }

      return {
        id: `PITEM_${purchaseId}_${idx + 1}`,
        purchase_id: purchaseId,
        medicine_id: medId,
        batch_id: `BATCH_${medId}_${it.batch_no}`,
        product_name: it.product_name,
        hsn_code: it.hsn_code,
        pack_size: it.pack_size,
        mfg_by: it.mfg_by,
        batch_no: it.batch_no,
        exp_date_mm_yy: it.exp_date_mm_yy,
        billed_qty: it.billed_qty,
        free_qty: it.free_qty,
        mrp: it.mrp,
        old_mrp: it.old_mrp,
        purchase_rate: it.purchase_rate,
        discount_percent: it.discount_percent,
        taxable_amount: it.taxable_amount,
        gst_percent: it.gst_percent,
        cgst_amount: it.cgst_amount,
        sgst_amount: it.sgst_amount,
        igst_amount: it.igst_amount,
        line_total: it.line_total,
        net_landing_cost: it.net_landing_cost,
      };
    });

    try {
      await dbService.savePurchaseTransaction(purchaseHeader, purchaseItems, newMedicines);
      toast.success(`Purchase Bill ${supplierInvoiceNo} saved successfully! ${validItems.length} batches added to inventory.`, { title: 'Stock Inward Recorded' });

      // Reset
      setSupplierInvoiceNo('');
      setItems([]);
      handleAddNewRow();
    } catch (err: any) {
      toast.error('Failed to save purchase bill: ' + err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* 1. TOP 3-WAY INWARD ENTRY TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Stock Inward / Purchase Entry Engine [F2]
            </h1>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-extrabold px-2 py-0.5 rounded-sm border border-indigo-300 dark:border-indigo-800">
              Auto-Scheme 100+20 Math
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Type Qty as "100+20" to automatically compute Scheme Landing Cost and add total 120 units to physical stock.
          </p>
        </div>

        {/* 3 Entry Modes Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* AI Scanner Button */}
          <button
            type="button"
            onClick={() => setAiScannerOpen(true)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-sm shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>📷 AI Bill Scanner</span>
          </button>

          {/* CSV Import */}
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-sm shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Marg CSV</span>
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvFileImport}
          />
        </div>
      </div>

      {/* 2. VENDOR & INVOICE HEADER DETAILS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm text-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Vendor Selector */}
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Supplier / Wholesaler *
            </label>
            <div className="flex space-x-2">
              <select
                ref={vendorSelectRef}
                value={selectedVendorId}
                onChange={(e) => {
                  const found = vendors.find((v) => v.id === e.target.value);
                  if (found) {
                    setSelectedVendorId(found.id);
                    setSelectedVendor(found);
                    setVendorError(false);
                  }
                }}
                className={`flex-1 px-3 py-1.5 font-bold uppercase text-xs border rounded-sm ${
                  vendorError
                    ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50 dark:bg-rose-950/20'
                    : 'border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <option value="" disabled>
                  -- Select Supplier / Vendor [Alt+V] --
                </option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.city}, {v.state_name}) - GST: {v.gstin || 'UNREGISTERED'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setPartyModalOpen(true)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-sm flex items-center space-x-1"
                title="Register New Supplier"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Vendor</span>
              </button>
            </div>
          </div>

          {/* Supplier Bill No */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Supplier Invoice No *
            </label>
            <input
              type="text"
              required
              value={supplierInvoiceNo}
              onChange={(e) => setSupplierInvoiceNo(e.target.value)}
              placeholder="e.g. 26-27/014704"
              className="w-full px-3 py-1.5 font-mono font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {/* Invoice Date */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Invoice Date *
            </label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-1.5 font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      {/* 3. PURCHASE LINE ITEMS GRID */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex-1 flex flex-col min-h-[340px]">
        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200">
              Purchased Medicine Items ({items.length} Rows)
            </span>
            <span className="text-[11px] text-slate-500">
              • Scheme Syntax: Type "100+20" in Qty. Net Landing Cost calculates automatically.
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddNewRow}
            className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-sm flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item Row</span>
          </button>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse table-dense">
            <thead>
              <tr className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                <th className="w-8 text-center">#</th>
                <th className="min-w-[180px]">Product / Formulation</th>
                <th className="w-20">Pack</th>
                <th className="w-16">Mfg</th>
                <th className="w-24">Batch No</th>
                <th className="w-20">Exp (MM/YY)</th>
                <th className="w-24 text-center">Qty + Free (e.g. 100+20)</th>
                <th className="w-20 text-right">MRP (₹)</th>
                <th className="w-20 text-right">Old MRP</th>
                <th className="w-24 text-right">Purchase Rate</th>
                <th className="w-16 text-right">Disc %</th>
                <th className="w-16 text-right">GST %</th>
                <th className="w-24 text-right">Landing Cost</th>
                <th className="w-28 text-right">Taxable Amt</th>
                <th className="w-10 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-xs">
              {items.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="text-center font-mono text-slate-400">{idx + 1}</td>

                  {/* Product Name */}
                  <td>
                    <input
                      type="text"
                      value={row.product_name}
                      onChange={(e) => handleUpdateItem(idx, 'product_name', e.target.value.toUpperCase())}
                      placeholder="e.g. PARAFIC 650"
                      className="w-full px-2 py-1 font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Pack */}
                  <td>
                    <input
                      type="text"
                      value={row.pack_size}
                      onChange={(e) => handleUpdateItem(idx, 'pack_size', e.target.value.toUpperCase())}
                      placeholder="10*10"
                      className="w-full px-1.5 py-1 uppercase font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Mfg */}
                  <td>
                    <input
                      type="text"
                      value={row.mfg_by}
                      onChange={(e) => handleUpdateItem(idx, 'mfg_by', e.target.value.toUpperCase())}
                      placeholder="AKUMS"
                      className="w-full px-1.5 py-1 uppercase font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Batch No */}
                  <td>
                    <input
                      type="text"
                      value={row.batch_no}
                      onChange={(e) => handleUpdateItem(idx, 'batch_no', e.target.value.toUpperCase())}
                      placeholder="AVF03AGB"
                      className="w-full px-1.5 py-1 font-mono font-bold uppercase border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Exp Date */}
                  <td>
                    <input
                      type="text"
                      value={row.exp_date_mm_yy}
                      onChange={(e) => handleUpdateItem(idx, 'exp_date_mm_yy', e.target.value)}
                      placeholder="07/28"
                      className="w-full px-1.5 py-1 font-mono text-center border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Scheme Qty Input (Allows 100+20) */}
                  <td>
                    <input
                      type="text"
                      value={row.raw_qty_input}
                      onChange={(e) => handleUpdateItem(idx, 'raw_qty_input', e.target.value)}
                      placeholder="100+20"
                      className="w-full px-1.5 py-1 font-mono font-bold text-center border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sky-700 dark:text-sky-300"
                    />
                  </td>

                  {/* MRP */}
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={row.mrp}
                      onChange={(e) => handleUpdateItem(idx, 'mrp', parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-1 text-right font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Old MRP */}
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={row.old_mrp}
                      onChange={(e) => handleUpdateItem(idx, 'old_mrp', parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-1 text-right font-mono text-slate-400 border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Purchase Rate */}
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={row.purchase_rate}
                      onChange={(e) => handleUpdateItem(idx, 'purchase_rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-1 text-right font-mono font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* Disc % */}
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      value={row.discount_percent}
                      onChange={(e) => handleUpdateItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                      className="w-full px-1.5 py-1 text-right font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </td>

                  {/* GST % */}
                  <td>
                    <select
                      value={row.gst_percent}
                      onChange={(e) => handleUpdateItem(idx, 'gst_percent', parseFloat(e.target.value) || 0)}
                      className="w-full px-1 py-1 text-right font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                    </select>
                  </td>

                  {/* Calculated Net Landing Cost */}
                  <td className="text-right font-mono font-black text-sky-700 dark:text-sky-300">
                    ₹{row.net_landing_cost.toFixed(2)}
                  </td>

                  {/* Taxable Amount */}
                  <td className="text-right font-mono font-black text-slate-900 dark:text-white">
                    ₹{row.taxable_amount.toFixed(2)}
                  </td>

                  {/* Delete Row */}
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Remove Row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. SETTLEMENT & SAVE FOOTER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Payment to Vendor */}
        <div className="flex items-center space-x-3">
          <div>
            <span className="font-bold text-slate-500 uppercase block mb-1">Payment Status</span>
            <div className="flex space-x-1">
              {['CREDIT', 'BANK_TRANSFER', 'CASH', 'UPI'].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setPaymentMode(m as PaymentMode)}
                  className={`px-3 py-1 font-bold rounded-sm border ${
                    paymentMode === m
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {paymentMode !== 'CREDIT' && (
            <div>
              <span className="font-bold text-slate-500 uppercase block mb-1">Amount Paid Today (₹)</span>
              <input
                type="number"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-28 px-2 py-1 font-mono font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}
        </div>

        {/* Totals & Submit */}
        <div className="flex items-center space-x-4">
          <div className="text-right space-y-0.5">
            <div className="text-slate-500">
              Taxable Sub-Total: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹{subTotal.toFixed(2)}</span>
            </div>
            <div className="text-slate-500">
              {isInterState ? 'IGST' : 'CGST + SGST'}: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹{totalGst.toFixed(2)}</span>
            </div>
            <div className="font-extrabold text-sm text-slate-900 dark:text-white">
              GRAND TOTAL: <span className="font-mono font-black text-base text-indigo-700 dark:text-indigo-400">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePurchaseBill}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-sm shadow-md flex items-center space-x-2 transition-all transform hover:-translate-y-0.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve &amp; Add Stock [F10]</span>
          </button>
        </div>
      </div>

      {/* AI Invoice Scan Modal */}
      {aiScannerOpen && (
        <AiInvoiceScanModal
          isOpen={aiScannerOpen}
          onClose={() => setAiScannerOpen(false)}
          onInvoiceExtracted={handleApplyAiExtraction}
        />
      )}

      {/* New Vendor Modal */}
      {partyModalOpen && (
        <PartyFormModal
          isOpen={partyModalOpen}
          onClose={() => setPartyModalOpen(false)}
          defaultPartyType="VENDOR"
          onSaved={(newVendor) => {
            setVendors([...vendors, newVendor]);
            setSelectedVendorId(newVendor.id);
            setSelectedVendor(newVendor);
          }}
        />
      )}
    </div>
  );
};
