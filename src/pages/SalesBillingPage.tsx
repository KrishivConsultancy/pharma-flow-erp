// Wholesale Sales Billing Engine: Dual-Mode (GST Tax Invoice vs Simple Non-GST Memo)
// Ultra-fast keyboard entry, FEFO batch picker, Loss Guard alert, and atomic transaction settlement

import React, { useState, useEffect, useRef } from 'react';
import {
  Receipt,
  FileText,
  UserPlus,
  Search,
  Plus,
  Trash2,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CreditCard,
  Percent,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { dbService } from '../db/databaseService';
import {
  CompanyProfile,
  Party,
  MedicineMaster,
  InventoryBatch,
  Sale,
  SaleItem,
  BillType,
  PaymentMode,
  TaxType,
} from '../db/schema';
import { BatchPickerModal } from '../components/modals/BatchPickerModal';
import { PartyFormModal } from '../components/modals/PartyFormModal';
import { InvoicePrintModal } from '../components/print/InvoicePrintModal';

interface BillLineItem {
  id: string;
  medicine_id: string;
  batch_id: string;
  product_name: string;
  hsn_code: string;
  pack_size: string;
  mfg_by: string;
  batch_no: string;
  exp_date_mm_yy: string;
  available_qty: number;
  qty: number;
  free_qty: number;
  mrp: number;
  net_landing_cost: number;
  sale_rate: number;
  discount_percent: number;
  taxable_amount: number;
  gst_percent: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  line_total: number;
  line_profit: number;
}

interface SalesBillingPageProps {
  company: CompanyProfile;
  initialMode?: BillType;
}

export const SalesBillingPage: React.FC<SalesBillingPageProps> = ({
  company,
  initialMode = 'GST_INVOICE',
}) => {
  const [billType, setBillType] = useState<BillType>(initialMode);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Party | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [items, setItems] = useState<BillLineItem[]>([]);

  // Adjustments & Settlements
  const [billDiscountAmount, setBillDiscountAmount] = useState<number>(0);
  const [otherAdjustment, setOtherAdjustment] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CREDIT');
  const [amountReceived, setAmountReceived] = useState<number>(0);

  // Medicines & Batches Catalog Cache
  const [medicines, setMedicines] = useState<MedicineMaster[]>([]);
  const [allBatches, setAllBatches] = useState<InventoryBatch[]>([]);

  // Modals state
  const [batchPickerOpen, setBatchPickerOpen] = useState<boolean>(false);
  const [activePickerRowIndex, setActivePickerRowIndex] = useState<number | null>(null);
  const [currentMedicineForPicker, setCurrentMedicineForPicker] = useState<MedicineMaster | null>(null);
  const [partyModalOpen, setPartyModalOpen] = useState<boolean>(false);
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [savedSaleForPrint, setSavedSaleForPrint] = useState<Sale | null>(null);
  const [savedItemsForPrint, setSavedItemsForPrint] = useState<SaleItem[]>([]);

  // Search input dropdown states
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Load customer directory & inventory master
  const loadMasterData = async () => {
    try {
      const custs = await dbService.query<Party>(
        "SELECT * FROM parties WHERE party_type = 'CUSTOMER' ORDER BY name ASC"
      );
      setCustomers(custs);

      // Pre-select first customer (Khushi Medico) if none selected
      if (!selectedCustomerId && custs.length > 0) {
        handleSelectCustomer(custs[0]);
      }

      const meds = await dbService.query<MedicineMaster>(
        'SELECT * FROM medicines_master ORDER BY name ASC'
      );
      setMedicines(meds);

      const batches = await dbService.query<InventoryBatch>(`
        SELECT b.*, m.name as medicine_name, m.pack_size, m.mfg_by
        FROM inventory_batches b
        JOIN medicines_master m ON b.medicine_id = m.id
        WHERE b.available_qty > 0
        ORDER BY b.exp_date_iso ASC
      `);
      setAllBatches(batches);

      // Fetch invoice series next number from company_profile
      const profs = await dbService.query<CompanyProfile>("SELECT * FROM company_profile WHERE id = 'RADHA_DRUGS_MAIN'");
      if (profs.length > 0) {
        const prof = profs[0];
        if (billType === 'GST_INVOICE') {
          const nextNum = prof.gst_invoice_next_no || 1157;
          setInvoiceNo(`${prof.gst_invoice_prefix || 'T'}${String(nextNum).padStart(6, '0')}`);
        } else {
          const nextNum = prof.simple_bill_next_no || 101;
          setInvoiceNo(`${prof.simple_bill_prefix || 'S'}${String(nextNum).padStart(6, '0')}`);
        }
      }
    } catch (err) {
      console.error('Failed to load sales master data:', err);
    }
  };

  useEffect(() => {
    loadMasterData();
    const unsub = dbService.subscribe(loadMasterData);
    return unsub;
  }, [billType]);

  // Handle switching Customer
  const handleSelectCustomer = (cust: Party) => {
    setSelectedCustomerId(cust.id);
    setSelectedCustomer(cust);

    // Auto-Rule 2: If customer is not GST registered, auto-toggle to Simple Bill
    if (cust.is_gst_registered === 0 && billType === 'GST_INVOICE') {
      setBillType('SIMPLE_BILL');
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Barcode rapid scan detection
      const now = Date.now();
      if (now - lastKeyTimeRef.current > 100) {
        barcodeBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter' && barcodeBufferRef.current.length >= 6) {
        // Matched a scanned barcode
        handleBarcodeScanned(barcodeBufferRef.current);
        barcodeBufferRef.current = '';
        return;
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }

      if (e.key === 'F10') {
        e.preventDefault();
        handleSaveAndPrintBill();
      } else if (e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setBillType('GST_INVOICE');
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setBillType('SIMPLE_BILL');
      } else if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setPartyModalOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleAddNewRow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedCustomer, billType, billDiscountAmount, otherAdjustment, paymentMode, amountReceived]);

  // Barcode scanned lookup
  const handleBarcodeScanned = (barcode: string) => {
    const matchedBatch = allBatches.find(
      (b) => b.batch_no.toUpperCase() === barcode.toUpperCase()
    );
    if (matchedBatch) {
      const med = medicines.find((m) => m.id === matchedBatch.medicine_id);
      if (med) {
        applyBatchToRow(items.length, med, matchedBatch);
      }
    }
  };

  // Recalculate row math
  const calculateRowMath = (
    row: Partial<BillLineItem>,
    isGstMode: boolean,
    isInterState: boolean
  ): BillLineItem => {
    const qty = Number(row.qty) || 0;
    const free = Number(row.free_qty) || 0;
    const rate = Number(row.sale_rate) || 0;
    const disc = Number(row.discount_percent) || 0;
    const mrp = Number(row.mrp) || 0;
    const landing = Number(row.net_landing_cost) || 0;

    // Radha Drugs Taxable Amount formula: Qty * Rate * (1 - Disc%/100)
    const rawTaxable = qty * rate * (1 - disc / 100);
    const taxableAmount = Math.round(rawTaxable * 100) / 100;

    const gstPercent = isGstMode ? (row.gst_percent ?? 5) : 0;
    let cgstPercent = 0;
    let cgstAmount = 0;
    let sgstPercent = 0;
    let sgstAmount = 0;
    let igstPercent = 0;
    let igstAmount = 0;

    if (isGstMode && gstPercent > 0) {
      if (isInterState) {
        igstPercent = gstPercent;
        igstAmount = Math.round((taxableAmount * igstPercent) / 100 * 100) / 100;
      } else {
        cgstPercent = gstPercent / 2;
        sgstPercent = gstPercent / 2;
        cgstAmount = Math.round((taxableAmount * cgstPercent) / 100 * 100) / 100;
        sgstAmount = Math.round((taxableAmount * sgstPercent) / 100 * 100) / 100;
      }
    }

    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const lineTotal = Math.round((taxableAmount + totalTax) * 100) / 100;
    const costOfGoods = (qty + free) * landing;
    const lineProfit = Math.round((taxableAmount - costOfGoods) * 100) / 100;

    return {
      id: row.id || `LINE_${Date.now()}_${Math.random().toString().slice(-4)}`,
      medicine_id: row.medicine_id || '',
      batch_id: row.batch_id || '',
      product_name: row.product_name || '',
      hsn_code: row.hsn_code || '3004',
      pack_size: row.pack_size || '',
      mfg_by: row.mfg_by || '',
      batch_no: row.batch_no || '',
      exp_date_mm_yy: row.exp_date_mm_yy || '',
      available_qty: row.available_qty || 0,
      qty,
      free_qty: free,
      mrp,
      net_landing_cost: landing,
      sale_rate: rate,
      discount_percent: disc,
      taxable_amount: taxableAmount,
      gst_percent: gstPercent,
      cgst_percent: cgstPercent,
      cgst_amount: cgstAmount,
      sgst_percent: sgstPercent,
      sgst_amount: sgstAmount,
      igst_percent: igstPercent,
      igst_amount: igstAmount,
      line_total: lineTotal,
      line_profit: lineProfit,
    };
  };

  const isInterState = selectedCustomer ? selectedCustomer.state_code !== '10' : false;

  // Add new empty row
  const handleAddNewRow = () => {
    const emptyRow = calculateRowMath(
      {
        product_name: '',
        qty: 1,
        free_qty: 0,
        sale_rate: 0,
        discount_percent: 0,
        gst_percent: 5,
      },
      billType === 'GST_INVOICE',
      isInterState
    );
    setItems([...items, emptyRow]);
  };

  // Ensure at least 1 row on start
  useEffect(() => {
    if (items.length === 0) {
      // Preload with Dispo 10ML as example or empty
      const medDispo = medicines.find((m) => m.name === 'DISPO 10ML');
      const batchDispo = allBatches.find((b) => b.batch_no === '635106NH2');
      if (medDispo && batchDispo) {
        const item1 = calculateRowMath(
          {
            medicine_id: medDispo.id,
            batch_id: batchDispo.id,
            product_name: medDispo.name,
            hsn_code: medDispo.hsn_code,
            pack_size: medDispo.pack_size,
            mfg_by: medDispo.mfg_by,
            batch_no: batchDispo.batch_no,
            exp_date_mm_yy: batchDispo.exp_date_mm_yy,
            available_qty: batchDispo.available_qty,
            qty: 20,
            free_qty: 0,
            mrp: batchDispo.mrp,
            net_landing_cost: batchDispo.net_landing_cost,
            sale_rate: 240.0,
            discount_percent: 0,
            gst_percent: medDispo.gst_percent,
          },
          billType === 'GST_INVOICE',
          isInterState
        );
        setItems([item1]);
      } else {
        handleAddNewRow();
      }
    }
  }, [medicines, allBatches]);

  // Open Batch Picker for row
  const handleOpenBatchPicker = (index: number, med: MedicineMaster) => {
    setActivePickerRowIndex(index);
    setCurrentMedicineForPicker(med);
    setBatchPickerOpen(true);
  };

  // Apply selected batch to row
  const applyBatchToRow = async (rowIndex: number, med: MedicineMaster, batch: InventoryBatch) => {
    // Check customer rate memory for (customer_id, medicine_id)
    let prefilledRate = batch.default_sale_rate;
    let prefilledDisc = 0;

    if (selectedCustomerId) {
      const memory = await dbService.query(
        'SELECT last_sale_rate, last_discount_percent FROM customer_rate_memory WHERE customer_id = ? AND medicine_id = ?',
        [selectedCustomerId, med.id]
      );
      if (memory.length > 0) {
        prefilledRate = memory[0].last_sale_rate;
        prefilledDisc = memory[0].last_discount_percent || 0;
      }
    }

    const updatedRow = calculateRowMath(
      {
        ...items[rowIndex],
        medicine_id: med.id,
        batch_id: batch.id,
        product_name: med.name,
        hsn_code: med.hsn_code,
        pack_size: med.pack_size,
        mfg_by: med.mfg_by,
        batch_no: batch.batch_no,
        exp_date_mm_yy: batch.exp_date_mm_yy,
        available_qty: batch.available_qty,
        qty: items[rowIndex]?.qty || 1,
        free_qty: items[rowIndex]?.free_qty || 0,
        mrp: batch.mrp,
        net_landing_cost: batch.net_landing_cost,
        sale_rate: prefilledRate,
        discount_percent: prefilledDisc,
        gst_percent: med.gst_percent,
      },
      billType === 'GST_INVOICE',
      isInterState
    );

    const newItems = [...items];
    newItems[rowIndex] = updatedRow;
    setItems(newItems);
    setBatchPickerOpen(false);
  };

  // Update line item property
  const handleUpdateItem = (index: number, field: keyof BillLineItem, val: any) => {
    const newItems = [...items];
    const target = { ...newItems[index], [field]: val };
    newItems[index] = calculateRowMath(target, billType === 'GST_INVOICE', isInterState);
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      handleAddNewRow();
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // Bill Totals Calculation
  const subTotal = items.reduce((sum, it) => sum + it.taxable_amount, 0);
  const totalCgst = items.reduce((sum, it) => sum + it.cgst_amount, 0);
  const totalSgst = items.reduce((sum, it) => sum + it.sgst_amount, 0);
  const totalIgst = items.reduce((sum, it) => sum + it.igst_amount, 0);
  const totalGst = totalCgst + totalSgst + totalIgst;

  const rawNet = subTotal + totalGst - billDiscountAmount + otherAdjustment;
  const netAmount = Math.round(rawNet);
  const roundOff = Math.round((netAmount - rawNet) * 100) / 100;

  const totalCostOfGoods = items.reduce(
    (sum, it) => sum + (it.qty + it.free_qty) * it.net_landing_cost,
    0
  );
  const totalBillProfit = subTotal - billDiscountAmount + otherAdjustment - totalCostOfGoods;

  // Customer current balance snapshot
  const customerPreviousBalance = selectedCustomer ? selectedCustomer.current_balance : 0;
  const projectedCustomerBalance = customerPreviousBalance + netAmount - amountReceived;

  // ATOMIC COMMIT: Save & Print Bill [F10]
  const handleSaveAndPrintBill = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer for this wholesale bill.');
      return;
    }

    const validItems = items.filter((it) => it.product_name && it.qty > 0 && it.batch_no);
    if (validItems.length === 0) {
      alert('Please add at least one valid medicine with batch number and quantity.');
      return;
    }

    // Check for stock insufficiency
    for (const it of validItems) {
      const totalUnits = it.qty + it.free_qty;
      if (totalUnits > it.available_qty) {
        const proceed = confirm(
          `Stock Warning: Batch ${it.batch_no} of ${it.product_name} only has ${it.available_qty} units available. You are billing ${totalUnits} units. Proceed with negative stock override?`
        );
        if (!proceed) return;
      }
    }

    const saleId = `SALE_${Date.now()}`;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const saleHeader: Sale = {
      id: saleId,
      invoice_no: invoiceNo,
      bill_type: billType,
      sale_date: invoiceDate,
      customer_id: selectedCustomer.id,
      tax_type: billType === 'SIMPLE_BILL' ? 'NON_GST' : isInterState ? 'INTER_STATE' : 'INTRA_STATE',
      customer_previous_balance: customerPreviousBalance,
      sub_total: subTotal,
      bill_discount_amount: billDiscountAmount,
      other_adjustment: otherAdjustment,
      total_cgst: totalCgst,
      total_sgst: totalSgst,
      total_igst: totalIgst,
      total_gst: totalGst,
      round_off: roundOff,
      net_amount: netAmount,
      amount_received: paymentMode === 'CREDIT' ? 0 : amountReceived > 0 ? amountReceived : netAmount,
      payment_mode: paymentMode,
      total_cost_of_goods: totalCostOfGoods,
      net_profit: totalBillProfit,
      is_cancelled: 0,
      created_at: nowIso,
      sync_status: 'PENDING',
      customer_name: selectedCustomer.name,
      customer_phone: selectedCustomer.phone,
      customer_dl_no: selectedCustomer.dl_no,
      customer_gstin: selectedCustomer.gstin,
      customer_address: `${selectedCustomer.address || ''}, ${selectedCustomer.city || ''}`,
    };

    const saleItemRows: SaleItem[] = validItems.map((it, idx) => ({
      id: `SITEM_${saleId}_${idx + 1}`,
      sale_id: saleId,
      medicine_id: it.medicine_id,
      batch_id: it.batch_id,
      product_name: it.product_name,
      hsn_code: it.hsn_code,
      pack_size: it.pack_size,
      mfg_by: it.mfg_by,
      batch_no: it.batch_no,
      exp_date_mm_yy: it.exp_date_mm_yy,
      qty: it.qty,
      free_qty: it.free_qty,
      mrp: it.mrp,
      sale_rate: it.sale_rate,
      discount_percent: it.discount_percent,
      taxable_amount: it.taxable_amount,
      gst_percent: it.gst_percent,
      cgst_percent: it.cgst_percent,
      cgst_amount: it.cgst_amount,
      sgst_percent: it.sgst_percent,
      sgst_amount: it.sgst_amount,
      igst_percent: it.igst_percent,
      igst_amount: it.igst_amount,
      line_total: it.line_total,
      net_landing_cost_snapshot: it.net_landing_cost,
      line_profit: it.line_profit,
    }));

    try {
      // Execute Atomic Database Transaction
      await dbService.saveSaleTransaction(saleHeader, saleItemRows);

      // Open Print Modal Immediately
      setSavedSaleForPrint(saleHeader);
      setSavedItemsForPrint(saleItemRows);
      setPrintModalOpen(true);

      // Reset bill for next transaction
      handleAddNewRow();
      setBillDiscountAmount(0);
      setOtherAdjustment(0);
      setAmountReceived(0);
      setPaymentMode('CREDIT');
    } catch (err: any) {
      alert('Failed to save bill transaction: ' + err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* 1. TOP CONTROL BAR: MODE SWITCHER & CUSTOMER COMBOBOX */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Dual Mode Switcher */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-slate-500">Bill Mode:</span>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-sm border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setBillType('GST_INVOICE')}
                className={`px-3 py-1 text-xs font-bold rounded-sm flex items-center space-x-1.5 transition-colors ${
                  billType === 'GST_INVOICE'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>GST Tax Invoice [Alt+G]</span>
              </button>
              <button
                type="button"
                onClick={() => setBillType('SIMPLE_BILL')}
                className={`px-3 py-1 text-xs font-bold rounded-sm flex items-center space-x-1.5 transition-colors ${
                  billType === 'SIMPLE_BILL'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Simple Non-GST Bill [Alt+S]</span>
              </button>
            </div>
          </div>

          {/* Invoice No & Date */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1">
              <span className="font-bold text-slate-500">Invoice No:</span>
              <span className="font-mono font-black text-sm text-sky-700 dark:text-sky-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-sm border border-slate-300 dark:border-slate-700">
                {invoiceNo}
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <span className="font-bold text-slate-500">Date:</span>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="px-2 py-0.5 font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Customer Selection Row */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex-1 flex items-center space-x-2 min-w-[300px]">
            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">Customer:</span>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value);
                if (found) handleSelectCustomer(found);
              }}
              className="flex-1 px-3 py-1.5 font-bold uppercase text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city}) - {c.is_gst_registered ? `GST: ${c.gstin}` : 'UNREGISTERED NON-GST'}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setPartyModalOpen(true)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-sm flex items-center space-x-1 flex-shrink-0 shadow-sm"
              title="Add New Customer [Alt+C]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ New Client [Alt+C]</span>
            </button>
          </div>

          {/* Customer Metadata Snapshot */}
          {selectedCustomer && (
            <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/80 px-3 py-1 rounded-sm border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Previous Bal (Udhaar)</span>
                <span className="font-mono font-black text-sm text-amber-700 dark:text-amber-400">
                  ₹{customerPreviousBalance.toFixed(2)}
                </span>
              </div>
              <div className="border-l border-slate-300 dark:border-slate-700 pl-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Tax Classification</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-sm ${
                    selectedCustomer.is_gst_registered
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {selectedCustomer.is_gst_registered
                    ? isInterState
                      ? 'INTER-STATE (IGST)'
                      : 'INTRA-STATE BIHAR (CGST+SGST)'
                    : 'NON-GST UNREGISTERED'}
                </span>
              </div>
              <div className="border-l border-slate-300 dark:border-slate-700 pl-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Drug License</span>
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  {selectedCustomer.dl_no || 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. LINE-ITEM GRID */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-sm shadow-sm flex-1 flex flex-col min-h-[340px]">
        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200">
              Bill Line Items ({items.length} Rows)
            </span>
            <span className="text-[11px] text-slate-500">
              • Press Enter to select FEFO batch. USB Barcode scanners supported.
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddNewRow}
            className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-sm flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row [Alt+A]</span>
          </button>
        </div>

        {/* Dense Data Grid Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse table-dense">
            <thead>
              <tr className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                <th className="w-8 text-center">#</th>
                <th className="min-w-[200px]">Medicine Name</th>
                <th className="w-24">Batch No</th>
                <th className="w-20">Exp.</th>
                <th className="w-20 text-right">Avail</th>
                <th className="w-16 text-center">Qty</th>
                <th className="w-16 text-center">Free</th>
                <th className="w-20 text-right">MRP (₹)</th>
                <th className="w-24 text-right">Sale Rate (₹)</th>
                <th className="w-16 text-right">Disc %</th>
                {billType === 'GST_INVOICE' && (
                  <>
                    <th className="w-16 text-right">GST %</th>
                    <th className="w-20 text-right">GST Amt</th>
                  </>
                )}
                <th className="w-28 text-right">Amount (₹)</th>
                <th className="w-10 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {items.map((row, idx) => {
                // Loss Guard calculation
                const effectiveRealization =
                  (row.qty * row.sale_rate * (1 - row.discount_percent / 100)) /
                  ((row.qty + row.free_qty) || 1);
                const isBelowCost =
                  row.net_landing_cost > 0 && effectiveRealization < row.net_landing_cost;

                return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="text-center font-mono text-slate-400 text-xs">{idx + 1}</td>

                    {/* Medicine Name with Autocomplete Trigger */}
                    <td className="relative">
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={row.product_name}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            handleUpdateItem(idx, 'product_name', val);
                            setSearchTerm(val);
                            setActiveSearchIndex(idx);
                          }}
                          onFocus={() => {
                            setActiveSearchIndex(idx);
                            setSearchTerm(row.product_name);
                          }}
                          placeholder="Type 2+ letters e.g. DISPO"
                          className="w-full px-2 py-1 font-bold uppercase text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>

                      {/* Medicine Search Dropdown */}
                      {activeSearchIndex === idx && searchTerm.length >= 1 && (
                        <div className="absolute left-0 top-full z-40 w-80 bg-white dark:bg-slate-900 border-2 border-slate-700 shadow-xl max-h-48 overflow-y-auto">
                          {medicines
                            .filter((m) => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((m) => (
                              <div
                                key={m.id}
                                onClick={() => {
                                  setActiveSearchIndex(null);
                                  handleOpenBatchPicker(idx, m);
                                }}
                                className="p-2 border-b border-slate-200 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 cursor-pointer text-xs"
                              >
                                <div className="font-extrabold text-slate-900 dark:text-white uppercase">
                                  {m.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Pack: {m.pack_size} • Mfg: {m.mfg_by} • GST: {m.gst_percent}%
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </td>

                    {/* Batch No & Selector Button */}
                    <td>
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={row.batch_no}
                          readOnly
                          onClick={() => {
                            const med = medicines.find((m) => m.name === row.product_name);
                            if (med) handleOpenBatchPicker(idx, med);
                          }}
                          placeholder="Batch"
                          className="w-full px-1.5 py-1 font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const med = medicines.find((m) => m.name === row.product_name);
                            if (med) handleOpenBatchPicker(idx, med);
                          }}
                          className="p-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded text-slate-700 dark:text-slate-200"
                          title="Open Batch Selector"
                        >
                          <Boxes className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Expiry */}
                    <td className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {row.exp_date_mm_yy || '-'}
                    </td>

                    {/* Available Stock */}
                    <td className="text-right font-mono text-xs">
                      <span className={row.available_qty <= 10 ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                        {row.available_qty}
                      </span>
                    </td>

                    {/* Qty */}
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => handleUpdateItem(idx, 'qty', parseInt(e.target.value, 10) || 0)}
                        className="w-full px-1.5 py-1 text-center font-bold font-mono text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>

                    {/* Free Qty */}
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={row.free_qty}
                        onChange={(e) => handleUpdateItem(idx, 'free_qty', parseInt(e.target.value, 10) || 0)}
                        className="w-full px-1.5 py-1 text-center font-mono text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>

                    {/* MRP */}
                    <td className="text-right font-mono text-xs text-slate-500">
                      {row.mrp ? row.mrp.toFixed(2) : '0.00'}
                    </td>

                    {/* Sale Rate (With Loss Guard Warning) */}
                    <td>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={row.sale_rate}
                          onChange={(e) => handleUpdateItem(idx, 'sale_rate', parseFloat(e.target.value) || 0)}
                          className={`w-full px-1.5 py-1 text-right font-mono font-bold text-xs border ${
                            isBelowCost
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 ring-1 ring-rose-500'
                              : 'border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white'
                          }`}
                        />
                        {isBelowCost && (
                          <div className="absolute right-0 -bottom-4 z-20 text-[9px] bg-rose-600 text-white px-1 font-bold whitespace-nowrap shadow-sm">
                            ⚠️ Below Cost (Cost: ₹{row.net_landing_cost.toFixed(2)})
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Disc % */}
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={row.discount_percent}
                        onChange={(e) => handleUpdateItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-1 text-right font-mono text-xs border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>

                    {/* GST Columns (If in GST Invoice Mode) */}
                    {billType === 'GST_INVOICE' && (
                      <>
                        <td className="text-right font-mono text-xs">
                          {row.gst_percent}%
                        </td>
                        <td className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                          {(row.cgst_amount + row.sgst_amount + row.igst_amount).toFixed(2)}
                        </td>
                      </>
                    )}

                    {/* Taxable Amount */}
                    <td className="text-right font-mono font-black text-xs text-slate-900 dark:text-white">
                      ₹{row.taxable_amount.toFixed(2)}
                    </td>

                    {/* Delete Row Action */}
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete Row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. FOOTER: SETTLEMENT, TOTALS & SAVE BUTTON [F10] */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Left: Payment Settlement Options */}
        <div className="flex items-center space-x-3 text-xs">
          <div>
            <span className="font-bold text-slate-500 uppercase block mb-1">Payment Method</span>
            <div className="flex space-x-1">
              {[
                { id: 'CREDIT', label: 'Credit (Udhaar)' },
                { id: 'CASH', label: 'Cash Paid' },
                { id: 'UPI', label: 'UPI Paid' },
                { id: 'PARTIAL', label: 'Partial Cash' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    setPaymentMode(m.id as PaymentMode);
                    if (m.id === 'CASH' || m.id === 'UPI') {
                      setAmountReceived(netAmount);
                    } else if (m.id === 'CREDIT') {
                      setAmountReceived(0);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-sm font-bold border transition-colors ${
                    paymentMode === m.id
                      ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'PARTIAL' && (
            <div>
              <span className="font-bold text-slate-500 uppercase block mb-1">Cash Paid Today (₹)</span>
              <input
                type="number"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                className="w-28 px-2 py-1 font-mono font-bold border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          {/* New Customer Udhaar projection */}
          <div className="border-l border-slate-300 dark:border-slate-700 pl-3">
            <span className="font-bold text-slate-500 uppercase block mb-1">Projected Total Udhaar</span>
            <span className="font-mono font-black text-sm text-amber-700 dark:text-amber-400">
              ₹{projectedCustomerBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Right: Bill Totals & Save Button */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="text-right space-y-0.5">
            <div className="text-slate-500">
              Sub-Total: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹{subTotal.toFixed(2)}</span>
            </div>
            {billType === 'GST_INVOICE' && (
              <div className="text-slate-500">
                GST: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹{totalGst.toFixed(2)}</span>
              </div>
            )}
            <div className="text-slate-900 dark:text-white font-extrabold text-sm">
              NET AMOUNT: <span className="font-mono font-black text-base text-sky-700 dark:text-sky-400">₹{netAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Save & Print [F10] */}
          <button
            type="button"
            onClick={handleSaveAndPrintBill}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-sm shadow-md flex items-center space-x-2 transition-all transform hover:-translate-y-0.5"
          >
            <Printer className="w-4 h-4" />
            <span>Save &amp; Print Bill</span>
            <kbd className="bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold">
              F10
            </kbd>
          </button>
        </div>
      </div>

      {/* FEFO Batch Picker Modal */}
      {batchPickerOpen && activePickerRowIndex !== null && currentMedicineForPicker && (
        <BatchPickerModal
          isOpen={batchPickerOpen}
          onClose={() => setBatchPickerOpen(false)}
          medicineName={currentMedicineForPicker.name}
          batches={allBatches.filter((b) => b.medicine_id === currentMedicineForPicker.id)}
          lastCustomerRate={items[activePickerRowIndex]?.sale_rate}
          onSelectBatch={(batch) => applyBatchToRow(activePickerRowIndex, currentMedicineForPicker, batch)}
        />
      )}

      {/* New Party Modal */}
      {partyModalOpen && (
        <PartyFormModal
          isOpen={partyModalOpen}
          onClose={() => setPartyModalOpen(false)}
          defaultPartyType="CUSTOMER"
          onSaved={(newParty) => {
            setCustomers([...customers, newParty]);
            handleSelectCustomer(newParty);
          }}
        />
      )}

      {/* Invoice Print Modal */}
      {savedSaleForPrint && (
        <InvoicePrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          sale={savedSaleForPrint}
          items={savedItemsForPrint}
          company={company}
        />
      )}
    </div>
  );
};
