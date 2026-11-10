// Radha Drugs Wholesale Pharmaceutical ERP - Schema Definitions
// Complete SQLite / Supabase Compatible Schema

export interface CompanyProfile {
  id: string;
  company_name: string;
  tagline: string;
  address_line1: string;
  city_district: string;
  state_name: string;
  state_code: string;
  pincode: string;
  phone: string;
  gstin: string;
  dl_no: string;
  dl_valid_upto: string;
  fssai_no: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  upi_id: string;
  gst_invoice_prefix: string;
  gst_invoice_next_no: number;
  simple_bill_prefix: string;
  simple_bill_next_no: number;
  financial_year: string;
  terms_conditions: string; // JSON array of clauses
}

export type PartyType = 'CUSTOMER' | 'VENDOR';
export type GstStatus = 'ACTIVE' | 'CANCELLED' | 'UNREGISTERED';

export interface Party {
  id: string;
  party_type: PartyType;
  is_gst_registered: number; // 1 or 0
  gstin: string;
  name: string;
  legal_name: string;
  dl_no: string;
  fssai_no: string;
  phone: string;
  address: string;
  city: string;
  state_name: string;
  state_code: string;
  opening_balance: number;
  current_balance: number; // Customer: +ve = Receivable; Vendor: +ve = Payable
  credit_limit: number;
  gst_status: GstStatus;
  created_at: string;
  updated_at: string;
  sync_status: 'PENDING' | 'SYNCED';
}

export interface MedicineMaster {
  id: string;
  name: string;
  hsn_code: string;
  pack_size: string;
  mfg_by: string;
  salt_composition: string;
  gst_percent: number;
  barcode_gtin: string;
  min_stock_alert: number;
  default_discount_percent: number;
  updated_at: string;
  sync_status: 'PENDING' | 'SYNCED';
}

export interface InventoryBatch {
  id: string;
  medicine_id: string;
  batch_no: string;
  exp_date_mm_yy: string;
  exp_date_iso: string;
  mrp: number;
  old_mrp: number;
  purchase_rate: number;
  purchase_discount_percent: number;
  gst_percent: number;
  scheme_billed_qty: number;
  scheme_free_qty: number;
  net_landing_cost: number;
  default_sale_rate: number;
  available_qty: number;
  last_vendor_id: string;
  rack_location: string;
  updated_at: string;
  sync_status: 'PENDING' | 'SYNCED';
  // Joined fields for display
  medicine_name?: string;
  hsn_code?: string;
  pack_size?: string;
  mfg_by?: string;
  vendor_name?: string;
  min_stock_alert?: number;
}

export type TaxType = 'INTRA_STATE' | 'INTER_STATE' | 'NON_GST';
export type PaymentMode = 'CREDIT' | 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'PARTIAL';
export type EntrySource = 'MANUAL' | 'AI_OCR_SCAN' | 'CSV_IMPORT';

export interface Purchase {
  id: string;
  supplier_invoice_no: string;
  invoice_date: string;
  vendor_id: string;
  tax_type: TaxType;
  sub_total: number;
  discount_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  payment_mode: PaymentMode;
  entry_source: EntrySource;
  notes: string;
  created_at: string;
  sync_status: 'PENDING' | 'SYNCED';
  vendor_name?: string;
  vendor_gstin?: string;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  medicine_id: string;
  batch_id: string;
  product_name: string;
  hsn_code: string;
  pack_size: string;
  mfg_by: string;
  batch_no: string;
  exp_date_mm_yy: string;
  billed_qty: number;
  free_qty: number;
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

export type BillType = 'GST_INVOICE' | 'SIMPLE_BILL';

export interface Sale {
  id: string;
  invoice_no: string;
  bill_type: BillType;
  sale_date: string;
  customer_id: string;
  tax_type: TaxType;
  customer_previous_balance: number;
  sub_total: number;
  bill_discount_amount: number;
  other_adjustment: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_gst: number;
  round_off: number;
  net_amount: number;
  amount_received: number;
  payment_mode: PaymentMode;
  total_cost_of_goods: number;
  net_profit: number;
  is_cancelled: number;
  created_at: string;
  sync_status: 'PENDING' | 'SYNCED';
  customer_name?: string;
  customer_phone?: string;
  customer_dl_no?: string;
  customer_gstin?: string;
  customer_address?: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  medicine_id: string;
  batch_id: string;
  product_name: string;
  hsn_code: string;
  pack_size: string;
  mfg_by: string;
  batch_no: string;
  exp_date_mm_yy: string;
  qty: number;
  free_qty: number;
  mrp: number;
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
  net_landing_cost_snapshot: number;
  line_profit: number;
}

export type AdjustmentType =
  | 'SALES_RETURN_CREDIT_NOTE'
  | 'PURCHASE_RETURN_DEBIT_NOTE'
  | 'EXPIRY_BREAKAGE_WRITE_OFF'
  | 'STOCK_SURPLUS'
  | 'STOCK_SHORTAGE';

export interface ReturnAdjustment {
  id: string;
  voucher_no: string;
  adjustment_type: AdjustmentType;
  voucher_date: string;
  party_id: string | null;
  medicine_id: string;
  batch_id: string;
  batch_no: string;
  qty: number;
  unit_rate: number;
  gst_percent: number;
  total_amount: number;
  reason: string;
  created_at: string;
  sync_status: 'PENDING' | 'SYNCED';
  party_name?: string;
  medicine_name?: string;
}

export type VoucherType =
  | 'OPENING_BAL'
  | 'SALE_INVOICE'
  | 'PURCHASE_BILL'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_MADE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

export interface PartyLedgerTransaction {
  id: string;
  party_id: string;
  transaction_date: string;
  voucher_type: VoucherType;
  voucher_no: string;
  reference_id: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  payment_method: string;
  narration: string;
  created_at: string;
}

export interface CustomerRateMemory {
  id: string;
  customer_id: string;
  medicine_id: string;
  last_sale_rate: number;
  last_discount_percent: number;
  updated_at: string;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  created_at: string;
  error_message: string;
}

// SQL DDL Schema creation commands
export const SQL_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS company_profile (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  tagline TEXT,
  address_line1 TEXT,
  city_district TEXT,
  state_name TEXT,
  state_code TEXT,
  pincode TEXT,
  phone TEXT,
  gstin TEXT,
  dl_no TEXT,
  dl_valid_upto TEXT,
  fssai_no TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_ifsc TEXT,
  upi_id TEXT,
  gst_invoice_prefix TEXT DEFAULT 'T',
  gst_invoice_next_no INTEGER DEFAULT 1157,
  simple_bill_prefix TEXT DEFAULT 'S',
  simple_bill_next_no INTEGER DEFAULT 101,
  financial_year TEXT DEFAULT '2026-27',
  terms_conditions TEXT
);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  party_type TEXT NOT NULL, -- 'CUSTOMER' | 'VENDOR'
  is_gst_registered INTEGER DEFAULT 1,
  gstin TEXT,
  name TEXT NOT NULL,
  legal_name TEXT,
  dl_no TEXT,
  fssai_no TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state_name TEXT DEFAULT 'BIHAR',
  state_code TEXT DEFAULT '10',
  opening_balance REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  credit_limit REAL DEFAULT 100000,
  gst_status TEXT DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS medicines_master (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  hsn_code TEXT DEFAULT '3004',
  pack_size TEXT,
  mfg_by TEXT,
  salt_composition TEXT,
  gst_percent REAL DEFAULT 5,
  barcode_gtin TEXT,
  min_stock_alert INTEGER DEFAULT 20,
  default_discount_percent REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL REFERENCES medicines_master(id),
  batch_no TEXT NOT NULL,
  exp_date_mm_yy TEXT NOT NULL,
  exp_date_iso TEXT NOT NULL,
  mrp REAL NOT NULL,
  old_mrp REAL DEFAULT 0,
  purchase_rate REAL NOT NULL,
  purchase_discount_percent REAL DEFAULT 0,
  gst_percent REAL NOT NULL,
  scheme_billed_qty INTEGER DEFAULT 0,
  scheme_free_qty INTEGER DEFAULT 0,
  net_landing_cost REAL NOT NULL,
  default_sale_rate REAL NOT NULL,
  available_qty INTEGER NOT NULL DEFAULT 0,
  last_vendor_id TEXT REFERENCES parties(id),
  rack_location TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'PENDING',
  UNIQUE (medicine_id, batch_no)
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_invoice_no TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES parties(id),
  tax_type TEXT NOT NULL,
  sub_total REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  total_cgst REAL DEFAULT 0,
  total_sgst REAL DEFAULT 0,
  total_igst REAL DEFAULT 0,
  round_off REAL DEFAULT 0,
  grand_total REAL NOT NULL,
  amount_paid REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'CREDIT',
  entry_source TEXT DEFAULT 'MANUAL',
  notes TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  hsn_code TEXT,
  pack_size TEXT,
  mfg_by TEXT,
  batch_no TEXT NOT NULL,
  exp_date_mm_yy TEXT NOT NULL,
  billed_qty INTEGER NOT NULL,
  free_qty INTEGER DEFAULT 0,
  mrp REAL NOT NULL,
  old_mrp REAL DEFAULT 0,
  purchase_rate REAL NOT NULL,
  discount_percent REAL DEFAULT 0,
  taxable_amount REAL NOT NULL,
  gst_percent REAL NOT NULL,
  cgst_amount REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  line_total REAL NOT NULL,
  net_landing_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  bill_type TEXT NOT NULL, -- 'GST_INVOICE' | 'SIMPLE_BILL'
  sale_date TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES parties(id),
  tax_type TEXT NOT NULL,
  customer_previous_balance REAL NOT NULL,
  sub_total REAL NOT NULL,
  bill_discount_amount REAL DEFAULT 0,
  other_adjustment REAL DEFAULT 0,
  total_cgst REAL DEFAULT 0,
  total_sgst REAL DEFAULT 0,
  total_igst REAL DEFAULT 0,
  total_gst REAL DEFAULT 0,
  round_off REAL DEFAULT 0,
  net_amount REAL NOT NULL,
  amount_received REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'CREDIT',
  total_cost_of_goods REAL NOT NULL,
  net_profit REAL NOT NULL,
  is_cancelled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  hsn_code TEXT,
  pack_size TEXT,
  mfg_by TEXT,
  batch_no TEXT NOT NULL,
  exp_date_mm_yy TEXT NOT NULL,
  qty INTEGER NOT NULL,
  free_qty INTEGER DEFAULT 0,
  mrp REAL NOT NULL,
  sale_rate REAL NOT NULL,
  discount_percent REAL DEFAULT 0,
  taxable_amount REAL NOT NULL,
  gst_percent REAL NOT NULL,
  cgst_percent REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_percent REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_percent REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  line_total REAL NOT NULL,
  net_landing_cost_snapshot REAL NOT NULL,
  line_profit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS returns_adjustments (
  id TEXT PRIMARY KEY,
  voucher_no TEXT NOT NULL,
  adjustment_type TEXT NOT NULL,
  voucher_date TEXT NOT NULL,
  party_id TEXT REFERENCES parties(id),
  medicine_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_rate REAL NOT NULL,
  gst_percent REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS party_ledger_transactions (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties(id),
  transaction_date TEXT NOT NULL,
  voucher_type TEXT NOT NULL,
  voucher_no TEXT NOT NULL,
  reference_id TEXT,
  debit_amount REAL DEFAULT 0,
  credit_amount REAL DEFAULT 0,
  running_balance REAL NOT NULL,
  payment_method TEXT,
  narration TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_rate_memory (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  last_sale_rate REAL NOT NULL,
  last_discount_percent REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (customer_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE'
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batches_med ON inventory_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_exp ON inventory_batches(exp_date_iso);
CREATE INDEX IF NOT EXISTS idx_ledger_party ON party_ledger_transactions(party_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_cust ON sales(customer_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_purchases_vend ON purchases(vendor_id, invoice_date);
`;
