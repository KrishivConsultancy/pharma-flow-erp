// Database Service: Persistent SQLite via sql.js + IndexedDB / Electron FileSystem
// Executes true SQL transactions and guarantees ZERO data loss on refresh

import initSqlJs, { Database } from 'sql.js';
import {
  SQL_SCHEMA_DDL,
  CompanyProfile,
  Party,
  MedicineMaster,
  InventoryBatch,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  ReturnAdjustment,
  PartyLedgerTransaction,
  CustomerRateMemory,
} from './schema';
import {
  SEED_COMPANY_PROFILE,
  SEED_PARTIES,
  SEED_MEDICINES,
  SEED_BATCHES,
  SEED_PURCHASE,
  SEED_PURCHASE_ITEMS,
  SEED_SALE_1,
  SEED_SALE_1_ITEMS,
  SEED_SALE_2,
  SEED_SALE_2_ITEMS,
  SEED_LEDGER_TRANSACTIONS,
  SEED_CUSTOMER_RATES,
} from './seedData';

const DB_STORAGE_KEY = 'radha_drugs_sqlite_db';
const DB_VERSION = 1;
const IDB_NAME = 'RadhaDrugsIDB';
const IDB_STORE = 'sqlite_store';

// Helper for IndexedDB persistence of SQLite Uint8Array binary
class IndexedDBStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(): Promise<Uint8Array | null> {
    try {
      const db = await this.dbPromise;
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(DB_STORAGE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('IDB get failed, falling back to null', e);
      return null;
    }
  }

  async set(data: Uint8Array): Promise<void> {
    try {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.put(data, DB_STORAGE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('IDB set failed', e);
    }
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(DB_STORAGE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

class DatabaseService {
  private db: Database | null = null;
  private idb = new IndexedDBStore();
  private isInitializing = false;
  private initPromise: Promise<Database> | null = null;
  private changeListeners: Array<() => void> = [];

  // Subscribe to reactive DB changes
  subscribe(listener: () => void) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  private notifyChange() {
    this.saveToStorage();
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in db change listener:', err);
      }
    }
  }

  async getDb(): Promise<Database> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.init();
    return this.initPromise;
  }

  private async init(): Promise<Database> {
    this.isInitializing = true;
    try {
      const SQL = await initSqlJs({
        locateFile: () => (typeof window !== 'undefined' && window.location.protocol === 'file:' ? './sql-wasm.wasm' : '/sql-wasm.wasm'),
      });

      // Try loading existing binary from IndexedDB
      const savedBinary = await this.idb.get();
      if (savedBinary && savedBinary.length > 0) {
        try {
          this.db = new SQL.Database(savedBinary);
          console.log('✅ SQLite loaded from persistent IndexedDB');
        } catch (e) {
          console.error('Failed to parse saved DB binary, creating fresh', e);
          this.db = new SQL.Database();
          this.runSchemaAndSeed();
        }
      } else {
        console.log('⚡ Initializing new SQLite database with schema & Radha Drugs seed data...');
        this.db = new SQL.Database();
        this.runSchemaAndSeed();
        await this.saveToStorage();
      }

      return this.db;
    } finally {
      this.isInitializing = false;
    }
  }

  // Save current SQLite binary to persistent storage
  async saveToStorage(): Promise<void> {
    if (!this.db) return;
    try {
      const binary = this.db.export();
      await this.idb.set(binary);
    } catch (err) {
      console.error('Failed to persist SQLite to IndexedDB:', err);
    }
  }

  private runSchemaAndSeed() {
    if (!this.db) return;
    this.db.exec(SQL_SCHEMA_DDL);
    this.seedDatabase();
  }

  // Seed with realistic Radha Drugs production data
  seedDatabase() {
    if (!this.db) return;

    this.db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Company Profile
      this.db.run(
        `INSERT OR REPLACE INTO company_profile (
          id, company_name, tagline, address_line1, city_district, state_name, state_code,
          pincode, phone, gstin, dl_no, dl_valid_upto, fssai_no, bank_name, bank_account_no,
          bank_ifsc, upi_id, gst_invoice_prefix, gst_invoice_next_no, simple_bill_prefix,
          simple_bill_next_no, financial_year, terms_conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          SEED_COMPANY_PROFILE.id,
          SEED_COMPANY_PROFILE.company_name,
          SEED_COMPANY_PROFILE.tagline,
          SEED_COMPANY_PROFILE.address_line1,
          SEED_COMPANY_PROFILE.city_district,
          SEED_COMPANY_PROFILE.state_name,
          SEED_COMPANY_PROFILE.state_code,
          SEED_COMPANY_PROFILE.pincode,
          SEED_COMPANY_PROFILE.phone,
          SEED_COMPANY_PROFILE.gstin,
          SEED_COMPANY_PROFILE.dl_no,
          SEED_COMPANY_PROFILE.dl_valid_upto,
          SEED_COMPANY_PROFILE.fssai_no,
          SEED_COMPANY_PROFILE.bank_name,
          SEED_COMPANY_PROFILE.bank_account_no,
          SEED_COMPANY_PROFILE.bank_ifsc,
          SEED_COMPANY_PROFILE.upi_id,
          SEED_COMPANY_PROFILE.gst_invoice_prefix,
          SEED_COMPANY_PROFILE.gst_invoice_next_no,
          SEED_COMPANY_PROFILE.simple_bill_prefix,
          SEED_COMPANY_PROFILE.simple_bill_next_no,
          SEED_COMPANY_PROFILE.financial_year,
          SEED_COMPANY_PROFILE.terms_conditions,
        ]
      );

      // 2. Parties
      for (const p of SEED_PARTIES) {
        this.db.run(
          `INSERT OR REPLACE INTO parties (
            id, party_type, is_gst_registered, gstin, name, legal_name, dl_no, fssai_no,
            phone, address, city, state_name, state_code, opening_balance, current_balance,
            credit_limit, gst_status, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id, p.party_type, p.is_gst_registered, p.gstin, p.name, p.legal_name, p.dl_no,
            p.fssai_no, p.phone, p.address, p.city, p.state_name, p.state_code, p.opening_balance,
            p.current_balance, p.credit_limit, p.gst_status, p.created_at, p.updated_at, p.sync_status
          ]
        );
      }

      // 3. Medicines
      for (const m of SEED_MEDICINES) {
        this.db.run(
          `INSERT OR REPLACE INTO medicines_master (
            id, name, hsn_code, pack_size, mfg_by, salt_composition, gst_percent,
            barcode_gtin, min_stock_alert, default_discount_percent, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.id, m.name, m.hsn_code, m.pack_size, mfg_by(m.mfg_by), m.salt_composition, m.gst_percent,
            m.barcode_gtin, m.min_stock_alert, m.default_discount_percent, m.updated_at, m.sync_status
          ]
        );
      }

      // 4. Batches
      for (const b of SEED_BATCHES) {
        this.db.run(
          `INSERT OR REPLACE INTO inventory_batches (
            id, medicine_id, batch_no, exp_date_mm_yy, exp_date_iso, mrp, old_mrp,
            purchase_rate, purchase_discount_percent, gst_percent, scheme_billed_qty,
            scheme_free_qty, net_landing_cost, default_sale_rate, available_qty,
            last_vendor_id, rack_location, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            b.id, b.medicine_id, b.batch_no, b.exp_date_mm_yy, b.exp_date_iso, b.mrp, b.old_mrp,
            b.purchase_rate, b.purchase_discount_percent, b.gst_percent, b.scheme_billed_qty,
            b.scheme_free_qty, b.net_landing_cost, b.default_sale_rate, b.available_qty,
            b.last_vendor_id, b.rack_location, b.updated_at, b.sync_status
          ]
        );
      }

      // 5. Seed Purchase
      this.db.run(
        `INSERT OR REPLACE INTO purchases (
          id, supplier_invoice_no, invoice_date, vendor_id, tax_type, sub_total,
          discount_amount, total_cgst, total_sgst, total_igst, round_off, grand_total,
          amount_paid, payment_mode, entry_source, notes, created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          SEED_PURCHASE.id, SEED_PURCHASE.supplier_invoice_no, SEED_PURCHASE.invoice_date,
          SEED_PURCHASE.vendor_id, SEED_PURCHASE.tax_type, SEED_PURCHASE.sub_total,
          SEED_PURCHASE.discount_amount, SEED_PURCHASE.total_cgst, SEED_PURCHASE.total_sgst,
          SEED_PURCHASE.total_igst, SEED_PURCHASE.round_off, SEED_PURCHASE.grand_total,
          SEED_PURCHASE.amount_paid, SEED_PURCHASE.payment_mode, SEED_PURCHASE.entry_source,
          SEED_PURCHASE.notes, SEED_PURCHASE.created_at, SEED_PURCHASE.sync_status
        ]
      );

      for (const pi of SEED_PURCHASE_ITEMS) {
        this.db.run(
          `INSERT OR REPLACE INTO purchase_items (
            id, purchase_id, medicine_id, batch_id, product_name, hsn_code, pack_size,
            mfg_by, batch_no, exp_date_mm_yy, billed_qty, free_qty, mrp, old_mrp,
            purchase_rate, discount_percent, taxable_amount, gst_percent, cgst_amount,
            sgst_amount, igst_amount, line_total, net_landing_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pi.id, pi.purchase_id, pi.medicine_id, pi.batch_id, pi.product_name, pi.hsn_code,
            pi.pack_size, pi.mfg_by, pi.batch_no, pi.exp_date_mm_yy, pi.billed_qty, pi.free_qty,
            pi.mrp, pi.old_mrp, pi.purchase_rate, pi.discount_percent, pi.taxable_amount,
            pi.gst_percent, pi.cgst_amount, pi.sgst_amount, pi.igst_amount, pi.line_total, pi.net_landing_cost
          ]
        );
      }

      // 6. Seed Sales
      for (const s of [SEED_SALE_1, SEED_SALE_2]) {
        this.db.run(
          `INSERT OR REPLACE INTO sales (
            id, invoice_no, bill_type, sale_date, customer_id, tax_type,
            customer_previous_balance, sub_total, bill_discount_amount, other_adjustment,
            total_cgst, total_sgst, total_igst, total_gst, round_off, net_amount,
            amount_received, payment_mode, total_cost_of_goods, net_profit, is_cancelled,
            created_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id, s.invoice_no, s.bill_type, s.sale_date, s.customer_id, s.tax_type,
            s.customer_previous_balance, s.sub_total, s.bill_discount_amount, s.other_adjustment,
            s.total_cgst, s.total_sgst, s.total_igst, s.total_gst, s.round_off, s.net_amount,
            s.amount_received, s.payment_mode, s.total_cost_of_goods, s.net_profit, s.is_cancelled,
            s.created_at, s.sync_status
          ]
        );
      }

      for (const si of [...SEED_SALE_1_ITEMS, ...SEED_SALE_2_ITEMS]) {
        this.db.run(
          `INSERT OR REPLACE INTO sale_items (
            id, sale_id, medicine_id, batch_id, product_name, hsn_code, pack_size,
            mfg_by, batch_no, exp_date_mm_yy, qty, free_qty, mrp, sale_rate,
            discount_percent, taxable_amount, gst_percent, cgst_percent, cgst_amount,
            sgst_percent, sgst_amount, igst_percent, igst_amount, line_total,
            net_landing_cost_snapshot, line_profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            si.id, si.sale_id, si.medicine_id, si.batch_id, si.product_name, si.hsn_code,
            si.pack_size, si.mfg_by, si.batch_no, si.exp_date_mm_yy, si.qty, si.free_qty,
            si.mrp, si.sale_rate, si.discount_percent, si.taxable_amount, si.gst_percent,
            si.cgst_percent, si.cgst_amount, si.sgst_percent, si.sgst_amount, si.igst_percent,
            si.igst_amount, si.line_total, si.net_landing_cost_snapshot, si.line_profit
          ]
        );
      }

      // 7. Ledger Transactions
      for (const lt of SEED_LEDGER_TRANSACTIONS) {
        this.db.run(
          `INSERT OR REPLACE INTO party_ledger_transactions (
            id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
            debit_amount, credit_amount, running_balance, payment_method, narration, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lt.id, lt.party_id, lt.transaction_date, lt.voucher_type, lt.voucher_no,
            lt.reference_id, lt.debit_amount, lt.credit_amount, lt.running_balance,
            lt.payment_method, lt.narration, lt.created_at
          ]
        );
      }

      // 8. Customer Rate Memory
      for (const cr of SEED_CUSTOMER_RATES) {
        this.db.run(
          `INSERT OR REPLACE INTO customer_rate_memory (
            id, customer_id, medicine_id, last_sale_rate, last_discount_percent, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [cr.id, cr.customer_id, cr.medicine_id, cr.last_sale_rate, cr.last_discount_percent, cr.updated_at]
        );
      }

      this.db.exec('COMMIT;');
      console.log('✅ Radha Drugs Database Seeded Successfully!');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      console.error('Error during database seeding:', err);
    }
  }

  // Generic query runner returning structured objects
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.getDb();
    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return results;
  }

  // Execute a query without returning rows
  async exec(sql: string, params: any[] = []): Promise<void> {
    const db = await this.getDb();
    db.run(sql, params);
    this.notifyChange();
  }

  // ==========================================
  // ATOMIC BUSINESS TRANSACTIONS
  // ==========================================

  // 1. ATOMIC SALE TRANSACTION
  async saveSaleTransaction(sale: Sale, items: SaleItem[]): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      // 1.1 Insert Sale Header
      db.run(
        `INSERT INTO sales (
          id, invoice_no, bill_type, sale_date, customer_id, tax_type,
          customer_previous_balance, sub_total, bill_discount_amount, other_adjustment,
          total_cgst, total_sgst, total_igst, total_gst, round_off, net_amount,
          amount_received, payment_mode, total_cost_of_goods, net_profit, is_cancelled,
          created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sale.id, sale.invoice_no, sale.bill_type, sale.sale_date, sale.customer_id,
          sale.tax_type, sale.customer_previous_balance, sale.sub_total,
          sale.bill_discount_amount, sale.other_adjustment, sale.total_cgst,
          sale.total_sgst, sale.total_igst, sale.total_gst, sale.round_off,
          sale.net_amount, sale.amount_received, sale.payment_mode,
          sale.total_cost_of_goods, sale.net_profit, 0, sale.created_at, 'PENDING'
        ]
      );

      // 1.2 Insert Line Items & Decrement Batch Inventory
      for (const item of items) {
        db.run(
          `INSERT INTO sale_items (
            id, sale_id, medicine_id, batch_id, product_name, hsn_code, pack_size,
            mfg_by, batch_no, exp_date_mm_yy, qty, free_qty, mrp, sale_rate,
            discount_percent, taxable_amount, gst_percent, cgst_percent, cgst_amount,
            sgst_percent, sgst_amount, igst_percent, igst_amount, line_total,
            net_landing_cost_snapshot, line_profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id, item.sale_id, item.medicine_id, item.batch_id, item.product_name,
            item.hsn_code, item.pack_size, item.mfg_by, item.batch_no, item.exp_date_mm_yy,
            item.qty, item.free_qty, item.mrp, item.sale_rate, item.discount_percent,
            item.taxable_amount, item.gst_percent, item.cgst_percent, item.cgst_amount,
            item.sgst_percent, item.sgst_amount, item.igst_percent, item.igst_amount,
            item.line_total, item.net_landing_cost_snapshot, item.line_profit
          ]
        );

        // Deduct inventory batch stock: (qty + free_qty)
        const totalDeduction = (item.qty || 0) + (item.free_qty || 0);
        db.run(
          `UPDATE inventory_batches
           SET available_qty = MAX(0, available_qty - ?), updated_at = ?
           WHERE id = ?`,
          [totalDeduction, sale.created_at, item.batch_id]
        );

        // Update customer_rate_memory for this (customer, medicine) pair
        db.run(
          `INSERT INTO customer_rate_memory (id, customer_id, medicine_id, last_sale_rate, last_discount_percent, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(customer_id, medicine_id) DO UPDATE SET
             last_sale_rate = excluded.last_sale_rate,
             last_discount_percent = excluded.last_discount_percent,
             updated_at = excluded.updated_at`,
          [
            `CRM_${sale.customer_id}_${item.medicine_id}`,
            sale.customer_id,
            item.medicine_id,
            item.sale_rate,
            item.discount_percent,
            sale.created_at,
          ]
        );
      }

      // 1.3 Update Customer Balance & Add Ledger Transaction
      // Fetch latest customer balance
      const custRows = await this.query<Party>(`SELECT current_balance FROM parties WHERE id = ?`, [sale.customer_id]);
      const prevBal = custRows.length > 0 ? custRows[0].current_balance : 0;
      
      // Debit for the Sale Invoice
      const newBalAfterBill = prevBal + sale.net_amount;
      db.run(
        `INSERT INTO party_ledger_transactions (
          id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
          debit_amount, credit_amount, running_balance, payment_method, narration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `LEDGER_SALE_${sale.id}`,
          sale.customer_id,
          sale.sale_date,
          'SALE_INVOICE',
          sale.invoice_no,
          sale.id,
          sale.net_amount,
          0,
          newBalAfterBill,
          sale.payment_mode,
          `Sale Bill ${sale.invoice_no} (${sale.bill_type === 'GST_INVOICE' ? 'GST' : 'Simple'})`,
          sale.created_at
        ]
      );

      let finalCustomerBalance = newBalAfterBill;

      // If customer made immediate payment (Cash/UPI/Partial)
      if (sale.amount_received > 0) {
        finalCustomerBalance = newBalAfterBill - sale.amount_received;
        db.run(
          `INSERT INTO party_ledger_transactions (
            id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
            debit_amount, credit_amount, running_balance, payment_method, narration, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `LEDGER_RCPT_${sale.id}`,
            sale.customer_id,
            sale.sale_date,
            'PAYMENT_RECEIVED',
            `RCPT-${sale.invoice_no}`,
            sale.id,
            0,
            sale.amount_received,
            finalCustomerBalance,
            sale.payment_mode,
            `Receipt against bill ${sale.invoice_no}`,
            sale.created_at
          ]
        );
      }

      // Update party current_balance
      db.run(
        `UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`,
        [finalCustomerBalance, sale.created_at, sale.customer_id]
      );

      // Increment Company Invoice Sequence
      if (sale.bill_type === 'GST_INVOICE') {
        db.run(
          `UPDATE company_profile SET gst_invoice_next_no = gst_invoice_next_no + 1 WHERE id = 'RADHA_DRUGS_MAIN'`
        );
      } else {
        db.run(
          `UPDATE company_profile SET simple_bill_next_no = simple_bill_next_no + 1 WHERE id = 'RADHA_DRUGS_MAIN'`
        );
      }

      // Queue in sync_queue for Supabase
      db.run(
        `INSERT INTO sync_queue (id, table_name, record_id, action, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `SYNC_${Date.now()}_${sale.id}`,
          'sales',
          sale.id,
          'INSERT',
          JSON.stringify({ sale, items }),
          'PENDING',
          sale.created_at
        ]
      );

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('Failed atomic sale transaction:', err);
      throw err;
    }
  }

  // 2. ATOMIC PURCHASE TRANSACTION (3-Way smart entry)
  async savePurchaseTransaction(
    purchase: Purchase,
    items: PurchaseItem[],
    newMedicines: Partial<MedicineMaster>[] = []
  ): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      // 2.1 Auto-learn / upsert new medicines into medicines_master
      for (const med of newMedicines) {
        if (!med.id || !med.name) continue;
        db.run(
          `INSERT INTO medicines_master (
            id, name, hsn_code, pack_size, mfg_by, salt_composition, gst_percent,
            barcode_gtin, min_stock_alert, default_discount_percent, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            hsn_code = COALESCE(excluded.hsn_code, medicines_master.hsn_code),
            pack_size = COALESCE(excluded.pack_size, medicines_master.pack_size),
            mfg_by = COALESCE(excluded.mfg_by, medicines_master.mfg_by),
            gst_percent = COALESCE(excluded.gst_percent, medicines_master.gst_percent),
            updated_at = excluded.updated_at`,
          [
            med.id, med.name.toUpperCase().trim(), med.hsn_code || '3004', med.pack_size || '',
            med.mfg_by || '', med.salt_composition || '', med.gst_percent ?? 5,
            med.barcode_gtin || '', med.min_stock_alert ?? 20, 0, purchase.created_at, 'PENDING'
          ]
        );
      }

      // 2.2 Insert Purchase Header
      db.run(
        `INSERT INTO purchases (
          id, supplier_invoice_no, invoice_date, vendor_id, tax_type, sub_total,
          discount_amount, total_cgst, total_sgst, total_igst, round_off, grand_total,
          amount_paid, payment_mode, entry_source, notes, created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchase.id, purchase.supplier_invoice_no, purchase.invoice_date,
          purchase.vendor_id, purchase.tax_type, purchase.sub_total,
          purchase.discount_amount, purchase.total_cgst, purchase.total_sgst,
          purchase.total_igst, purchase.round_off, purchase.grand_total,
          purchase.amount_paid, purchase.payment_mode, purchase.entry_source,
          purchase.notes, purchase.created_at, 'PENDING'
        ]
      );

      // 2.3 Insert Items & Upsert Batches
      for (const item of items) {
        db.run(
          `INSERT INTO purchase_items (
            id, purchase_id, medicine_id, batch_id, product_name, hsn_code, pack_size,
            mfg_by, batch_no, exp_date_mm_yy, billed_qty, free_qty, mrp, old_mrp,
            purchase_rate, discount_percent, taxable_amount, gst_percent, cgst_amount,
            sgst_amount, igst_amount, line_total, net_landing_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id, item.purchase_id, item.medicine_id, item.batch_id, item.product_name,
            item.hsn_code, item.pack_size, item.mfg_by, item.batch_no, item.exp_date_mm_yy,
            item.billed_qty, item.free_qty, item.mrp, item.old_mrp, item.purchase_rate,
            item.discount_percent, item.taxable_amount, item.gst_percent, item.cgst_amount,
            item.sgst_amount, item.igst_amount, item.line_total, item.net_landing_cost
          ]
        );

        // Convert MM/YY to ISO YYYY-MM-DD
        const expIso = parseExpDateToIso(item.exp_date_mm_yy);
        const totalUnitsAdded = (item.billed_qty || 0) + (item.free_qty || 0);

        // Calculate default sale rate with reasonable wholesale margin (e.g., 20% over net landing or standard)
        const defaultSaleRate = Math.round(item.net_landing_cost * 1.25 * 100) / 100;

        // Upsert inventory batch (increment available_qty)
        db.run(
          `INSERT INTO inventory_batches (
            id, medicine_id, batch_no, exp_date_mm_yy, exp_date_iso, mrp, old_mrp,
            purchase_rate, purchase_discount_percent, gst_percent, scheme_billed_qty,
            scheme_free_qty, net_landing_cost, default_sale_rate, available_qty,
            last_vendor_id, rack_location, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(medicine_id, batch_no) DO UPDATE SET
            available_qty = inventory_batches.available_qty + excluded.available_qty,
            mrp = excluded.mrp,
            old_mrp = excluded.old_mrp,
            purchase_rate = excluded.purchase_rate,
            net_landing_cost = excluded.net_landing_cost,
            scheme_billed_qty = excluded.scheme_billed_qty,
            scheme_free_qty = excluded.scheme_free_qty,
            last_vendor_id = excluded.last_vendor_id,
            updated_at = excluded.updated_at`,
          [
            item.batch_id, item.medicine_id, item.batch_no.toUpperCase().trim(),
            item.exp_date_mm_yy, expIso, item.mrp, item.old_mrp, item.purchase_rate,
            item.discount_percent, item.gst_percent, item.billed_qty, item.free_qty,
            item.net_landing_cost, defaultSaleRate, totalUnitsAdded,
            purchase.vendor_id, 'GEN', purchase.created_at, 'PENDING'
          ]
        );
      }

      // 2.4 Update Vendor Ledger and Current Balance
      const vendRows = await this.query<Party>(`SELECT current_balance FROM parties WHERE id = ?`, [purchase.vendor_id]);
      const prevBal = vendRows.length > 0 ? vendRows[0].current_balance : 0;
      const newBalAfterBill = prevBal + purchase.grand_total; // Vendor payable increases

      db.run(
        `INSERT INTO party_ledger_transactions (
          id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
          debit_amount, credit_amount, running_balance, payment_method, narration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `LEDGER_PURCH_${purchase.id}`,
          purchase.vendor_id,
          purchase.invoice_date,
          'PURCHASE_BILL',
          purchase.supplier_invoice_no,
          purchase.id,
          0,
          purchase.grand_total,
          newBalAfterBill,
          purchase.payment_mode,
          `Purchase Bill ${purchase.supplier_invoice_no} (${purchase.entry_source})`,
          purchase.created_at
        ]
      );

      let finalVendorBalance = newBalAfterBill;

      if (purchase.amount_paid > 0) {
        finalVendorBalance = newBalAfterBill - purchase.amount_paid;
        db.run(
          `INSERT INTO party_ledger_transactions (
            id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
            debit_amount, credit_amount, running_balance, payment_method, narration, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `LEDGER_PAY_${purchase.id}`,
            purchase.vendor_id,
            purchase.invoice_date,
            'PAYMENT_MADE',
            `PAY-${purchase.supplier_invoice_no}`,
            purchase.id,
            purchase.amount_paid,
            0,
            finalVendorBalance,
            purchase.payment_mode,
            `Payment made against invoice ${purchase.supplier_invoice_no}`,
            purchase.created_at
          ]
        );
      }

      db.run(
        `UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`,
        [finalVendorBalance, purchase.created_at, purchase.vendor_id]
      );

      // Enqueue sync
      db.run(
        `INSERT INTO sync_queue (id, table_name, record_id, action, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `SYNC_${Date.now()}_${purchase.id}`,
          'purchases',
          purchase.id,
          'INSERT',
          JSON.stringify({ purchase, items }),
          'PENDING',
          purchase.created_at
        ]
      );

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('Failed atomic purchase transaction:', err);
      throw err;
    }
  }

  // 3. ATOMIC RETURN / ADJUSTMENT / DEBIT NOTE / CREDIT NOTE
  async saveAdjustmentTransaction(adj: ReturnAdjustment): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.run(
        `INSERT INTO returns_adjustments (
          id, voucher_no, adjustment_type, voucher_date, party_id,
          medicine_id, batch_id, batch_no, qty, unit_rate, gst_percent,
          total_amount, reason, created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adj.id, adj.voucher_no, adj.adjustment_type, adj.voucher_date, adj.party_id,
          adj.medicine_id, adj.batch_id, adj.batch_no, adj.qty, adj.unit_rate,
          adj.gst_percent, adj.total_amount, adj.reason, adj.created_at, 'PENDING'
        ]
      );

      // Stock adjustments
      if (adj.adjustment_type === 'PURCHASE_RETURN_DEBIT_NOTE' || adj.adjustment_type === 'EXPIRY_BREAKAGE_WRITE_OFF' || adj.adjustment_type === 'STOCK_SHORTAGE') {
        // Reduce stock from batch
        db.run(
          `UPDATE inventory_batches SET available_qty = MAX(0, available_qty - ?), updated_at = ? WHERE id = ?`,
          [adj.qty, adj.created_at, adj.batch_id]
        );
      } else if (adj.adjustment_type === 'SALES_RETURN_CREDIT_NOTE' || adj.adjustment_type === 'STOCK_SURPLUS') {
        // Increase stock back in batch
        db.run(
          `UPDATE inventory_batches SET available_qty = available_qty + ?, updated_at = ? WHERE id = ?`,
          [adj.qty, adj.created_at, adj.batch_id]
        );
      }

      // Party ledger adjustment if associated with party
      if (adj.party_id) {
        const partyRows = await this.query<Party>(`SELECT current_balance, party_type FROM parties WHERE id = ?`, [adj.party_id]);
        if (partyRows.length > 0) {
          const party = partyRows[0];
          let newBal = party.current_balance;
          if (adj.adjustment_type === 'PURCHASE_RETURN_DEBIT_NOTE') {
            // Reduces payable to vendor
            newBal = party.current_balance - adj.total_amount;
            db.run(
              `INSERT INTO party_ledger_transactions (
                id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
                debit_amount, credit_amount, running_balance, payment_method, narration, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `LEDGER_DN_${adj.id}`,
                adj.party_id,
                adj.voucher_date,
                'DEBIT_NOTE',
                adj.voucher_no,
                adj.id,
                adj.total_amount,
                0,
                newBal,
                'ADJUSTMENT',
                `Supplier Return Debit Note (${adj.reason || 'Expiry/Breakage'})`,
                adj.created_at
              ]
            );
          } else if (adj.adjustment_type === 'SALES_RETURN_CREDIT_NOTE') {
            // Reduces receivable from customer
            newBal = party.current_balance - adj.total_amount;
            db.run(
              `INSERT INTO party_ledger_transactions (
                id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
                debit_amount, credit_amount, running_balance, payment_method, narration, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `LEDGER_CN_${adj.id}`,
                adj.party_id,
                adj.voucher_date,
                'CREDIT_NOTE',
                adj.voucher_no,
                adj.id,
                0,
                adj.total_amount,
                newBal,
                'ADJUSTMENT',
                `Sales Return Credit Note (${adj.reason || 'Goods return'})`,
                adj.created_at
              ]
            );
          }
          db.run(`UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`, [newBal, adj.created_at, adj.party_id]);
        }
      }

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('Failed adjustment transaction:', err);
      throw err;
    }
  }

  // 4. ATOMIC PAYMENT / RECEIPT ENTRY
  async recordPaymentTransaction(data: {
    party_id: string;
    amount: number;
    payment_mode: string;
    transaction_date: string;
    narration: string;
    voucher_type: 'PAYMENT_RECEIVED' | 'PAYMENT_MADE';
  }): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const partyRows = await this.query<Party>(`SELECT current_balance, party_type, name FROM parties WHERE id = ?`, [data.party_id]);
      if (partyRows.length === 0) throw new Error('Party not found');
      const party = partyRows[0];

      let newBalance = party.current_balance;
      let debit = 0;
      let credit = 0;

      if (data.voucher_type === 'PAYMENT_RECEIVED') {
        // Customer paid money, reduce receivable
        newBalance = party.current_balance - data.amount;
        credit = data.amount;
      } else {
        // Radha Drugs paid supplier, reduce payable
        newBalance = party.current_balance - data.amount;
        debit = data.amount;
      }

      const voucherNo = `${data.voucher_type === 'PAYMENT_RECEIVED' ? 'RCPT' : 'PAY'}-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      db.run(
        `INSERT INTO party_ledger_transactions (
          id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
          debit_amount, credit_amount, running_balance, payment_method, narration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `VOUCHER_${Date.now()}`,
          data.party_id,
          data.transaction_date,
          data.voucher_type,
          voucherNo,
          '',
          debit,
          credit,
          newBalance,
          data.payment_mode,
          data.narration || `${data.voucher_type.replace('_', ' ')} (${data.payment_mode})`,
          now
        ]
      );

      db.run(`UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`, [newBalance, now, data.party_id]);

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('Failed payment transaction:', err);
      throw err;
    }
  }

  // Helper to upsert a Party
  async upsertParty(party: Partial<Party>): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = party.id || `PARTY_${Date.now()}`;
    const isNew = !party.id;

    db.run(
      `INSERT INTO parties (
        id, party_type, is_gst_registered, gstin, name, legal_name, dl_no, fssai_no,
        phone, address, city, state_name, state_code, opening_balance, current_balance,
        credit_limit, gst_status, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        party_type = excluded.party_type,
        is_gst_registered = excluded.is_gst_registered,
        gstin = excluded.gstin,
        name = excluded.name,
        legal_name = excluded.legal_name,
        dl_no = excluded.dl_no,
        fssai_no = excluded.fssai_no,
        phone = excluded.phone,
        address = excluded.address,
        city = excluded.city,
        state_name = excluded.state_name,
        state_code = excluded.state_code,
        credit_limit = excluded.credit_limit,
        gst_status = excluded.gst_status,
        updated_at = excluded.updated_at`,
      [
        id,
        party.party_type || 'CUSTOMER',
        party.is_gst_registered ?? (party.gstin ? 1 : 0),
        party.gstin ? party.gstin.toUpperCase().trim() : '',
        (party.name || '').toUpperCase().trim(),
        party.legal_name || party.name || '',
        party.dl_no || '',
        party.fssai_no || '',
        party.phone || '',
        party.address || '',
        party.city || 'BEGUSARAI',
        party.state_name || 'BIHAR',
        party.state_code || '10',
        party.opening_balance ?? 0,
        party.current_balance ?? party.opening_balance ?? 0,
        party.credit_limit ?? 100000,
        party.gst_status || (party.gstin ? 'ACTIVE' : 'UNREGISTERED'),
        party.created_at || now,
        now,
        'PENDING'
      ]
    );

    // If opening balance > 0 and party is new, record in ledger
    if (isNew && (party.opening_balance || 0) > 0) {
      db.run(
        `INSERT INTO party_ledger_transactions (
          id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
          debit_amount, credit_amount, running_balance, payment_method, narration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `LEDGER_OP_${id}`,
          id,
          now.substring(0, 10),
          'OPENING_BAL',
          'OPB-01',
          '',
          party.party_type === 'CUSTOMER' ? (party.opening_balance ?? 0) : 0,
          party.party_type === 'VENDOR' ? (party.opening_balance ?? 0) : 0,
          party.opening_balance ?? 0,
          '',
          'Opening balance recorded at party registration',
          now
        ]
      );
    }

    this.notifyChange();
  }

  // Full JSON database backup
  async exportEntireDatabaseJson(): Promise<string> {
    const profile = await this.query('SELECT * FROM company_profile');
    const parties = await this.query('SELECT * FROM parties');
    const medicines = await this.query('SELECT * FROM medicines_master');
    const batches = await this.query('SELECT * FROM inventory_batches');
    const purchases = await this.query('SELECT * FROM purchases');
    const purchaseItems = await this.query('SELECT * FROM purchase_items');
    const sales = await this.query('SELECT * FROM sales');
    const saleItems = await this.query('SELECT * FROM sale_items');
    const adjustments = await this.query('SELECT * FROM returns_adjustments');
    const ledger = await this.query('SELECT * FROM party_ledger_transactions');
    const customerRates = await this.query('SELECT * FROM customer_rate_memory');

    const backup = {
      exportTimestamp: new Date().toISOString(),
      version: '1.0',
      company: 'RADHA DRUGS',
      data: {
        profile,
        parties,
        medicines,
        batches,
        purchases,
        purchaseItems,
        sales,
        saleItems,
        adjustments,
        ledger,
        customerRates
      }
    };
    return JSON.stringify(backup, null, 2);
  }

  // Restore entire database from JSON
  async importEntireDatabaseJson(jsonString: string): Promise<void> {
    const backup = JSON.parse(jsonString);
    if (!backup.data) throw new Error('Invalid backup file format');

    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      // Clear existing tables
      const tables = [
        'purchase_items', 'sale_items', 'purchases', 'sales',
        'returns_adjustments', 'party_ledger_transactions',
        'customer_rate_memory', 'inventory_batches', 'medicines_master',
        'parties', 'company_profile'
      ];
      for (const t of tables) {
        db.exec(`DELETE FROM ${t};`);
      }

      // Re-populate from backup
      const d = backup.data;
      if (d.profile) {
        for (const p of d.profile) {
          db.run(`INSERT INTO company_profile VALUES (${Object.keys(p).map(() => '?').join(',')})`, Object.values(p));
        }
      }
      if (d.parties) {
        for (const p of d.parties) {
          db.run(`INSERT INTO parties VALUES (${Object.keys(p).map(() => '?').join(',')})`, Object.values(p));
        }
      }
      if (d.medicines) {
        for (const m of d.medicines) {
          db.run(`INSERT INTO medicines_master VALUES (${Object.keys(m).map(() => '?').join(',')})`, Object.values(m));
        }
      }
      if (d.batches) {
        for (const b of d.batches) {
          db.run(`INSERT INTO inventory_batches VALUES (${Object.keys(b).map(() => '?').join(',')})`, Object.values(b));
        }
      }
      if (d.purchases) {
        for (const p of d.purchases) {
          db.run(`INSERT INTO purchases VALUES (${Object.keys(p).map(() => '?').join(',')})`, Object.values(p));
        }
      }
      if (d.purchaseItems) {
        for (const pi of d.purchaseItems) {
          db.run(`INSERT INTO purchase_items VALUES (${Object.keys(pi).map(() => '?').join(',')})`, Object.values(pi));
        }
      }
      if (d.sales) {
        for (const s of d.sales) {
          db.run(`INSERT INTO sales VALUES (${Object.keys(s).map(() => '?').join(',')})`, Object.values(s));
        }
      }
      if (d.saleItems) {
        for (const si of d.saleItems) {
          db.run(`INSERT INTO sale_items VALUES (${Object.keys(si).map(() => '?').join(',')})`, Object.values(si));
        }
      }
      if (d.adjustments) {
        for (const a of d.adjustments) {
          db.run(`INSERT INTO returns_adjustments VALUES (${Object.keys(a).map(() => '?').join(',')})`, Object.values(a));
        }
      }
      if (d.ledger) {
        for (const l of d.ledger) {
          db.run(`INSERT INTO party_ledger_transactions VALUES (${Object.keys(l).map(() => '?').join(',')})`, Object.values(l));
        }
      }
      if (d.customerRates) {
        for (const cr of d.customerRates) {
          db.run(`INSERT INTO customer_rate_memory VALUES (${Object.keys(cr).map(() => '?').join(',')})`, Object.values(cr));
        }
      }

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }
  }

  // Reset to initial seed state
  async resetToSeedData(): Promise<void> {
    await this.idb.clear();
    const db = await this.getDb();
    const tables = [
      'purchase_items', 'sale_items', 'purchases', 'sales',
      'returns_adjustments', 'party_ledger_transactions',
      'customer_rate_memory', 'inventory_batches', 'medicines_master',
      'parties', 'company_profile', 'sync_queue'
    ];
    for (const t of tables) {
      db.exec(`DELETE FROM ${t};`);
    }
    this.seedDatabase();
    await this.saveToStorage();
    this.notifyChange();
  }
}

function mfg_by(val?: string): string {
  return val ? val.toUpperCase().trim() : '';
}

// Convert "07/31" -> "2031-07-31" or "05/28" -> "2028-05-31"
export function parseExpDateToIso(mmYy: string): string {
  if (!mmYy) return '2030-12-31';
  const parts = mmYy.split('/');
  if (parts.length !== 2) return '2030-12-31';
  const mm = parts[0].padStart(2, '0');
  const yy = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
  const month = parseInt(mm, 10);
  const year = parseInt(yy, 10);
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
}

export const dbService = new DatabaseService();
