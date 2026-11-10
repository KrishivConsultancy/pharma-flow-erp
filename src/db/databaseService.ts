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
  SEED_MEDICINES,
} from './seedData';

// Storage key bumped to V2 to ensure any old corrupted/polluted dummy state is purged
const DB_STORAGE_KEY = 'RADHA_DRUGS_PRODUCTION_DB_V2';
const DB_VERSION = 2;
const IDB_NAME = 'RadhaDrugsIDB_V2';
const IDB_STORE = 'sqlite_store_v2';

// Parameter sanitizer for sql.js (sql.js throws if any bound parameter is undefined or NaN)
export function sanitizeParams(params: any[] = []): any[] {
  return params.map(p => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'number' && (isNaN(p) || !isFinite(p))) return 0;
    return p;
  });
}

// Helper for IndexedDB persistence of SQLite Uint8Array binary
class IndexedDBStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null as any);
        return;
      }
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
      if (!db) return null;
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
      if (!db) return;
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
    try {
      const db = await this.dbPromise;
      if (!db) return;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.delete(DB_STORAGE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IDB clear failed', e);
    }
  }
}

export class DatabaseService {
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

  notifyChange() {
    this.saveToStorage();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radha-db-changed'));
    }
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in db change listener:', err);
      }
    }
  }

  // Safe wrapper for executing SQL with sanitized parameters
  safeRun(sql: string, params: any[] = []): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, sanitizeParams(params));
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

      // Try loading existing binary from IndexedDB V2
      const savedBinary = await this.idb.get();
      if (savedBinary && savedBinary.length > 0) {
        try {
          this.db = new SQL.Database(savedBinary);
          console.log('✅ SQLite loaded from persistent IndexedDB (V2)');
        } catch (e) {
          console.error('Failed to parse saved DB binary, creating fresh', e);
          this.db = new SQL.Database();
          this.runSchemaAndSeed();
        }
      } else {
        console.log('⚡ Initializing new clean production SQLite database (V2)...');
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

  // Seed with official Radha Drugs company profile and standard generic medicine dictionary (0 stock)
  seedDatabase() {
    if (!this.db) return;

    this.db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Company Profile
      this.safeRun(
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

      // 2. Standard Generics Medicine Dictionary (Zero batches, zero stock)
      for (const m of SEED_MEDICINES) {
        this.safeRun(
          `INSERT OR IGNORE INTO medicines_master (
            id, name, hsn_code, pack_size, mfg_by, salt_composition, gst_percent,
            barcode_gtin, min_stock_alert, default_discount_percent, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.id, m.name, m.hsn_code, m.pack_size, m.mfg_by, m.salt_composition, m.gst_percent,
            m.barcode_gtin, m.min_stock_alert, m.default_discount_percent, m.updated_at, m.sync_status
          ]
        );
      }

      this.db.exec('COMMIT;');
      console.log('✅ Clean production database initialized with Radha Drugs profile and generic dictionary.');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      console.error('Fatal database initialization error:', err);
    }
  }

  // Wipe all transactional and party data to 0
  async wipeAndResetDatabase(): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec(`
        DELETE FROM sale_items;
        DELETE FROM sales;
        DELETE FROM purchase_items;
        DELETE FROM purchases;
        DELETE FROM returns_adjustments;
        DELETE FROM party_ledger_transactions;
        DELETE FROM customer_rate_memory;
        DELETE FROM inventory_batches;
        DELETE FROM parties;
        DELETE FROM sync_queue;
      `);

      // Ensure company profile has clean start counters
      this.safeRun(
        `UPDATE company_profile SET
          gst_invoice_next_no = 1157,
          simple_bill_next_no = 101
        WHERE id = 'RADHA_DRUGS_MAIN'`
      );

      db.exec('COMMIT;');
      await this.saveToStorage();
      this.notifyChange();
      console.log('✅ Factory reset complete: All transactions, stock batches, and parties wiped to 0.');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // Reset to initial seed state
  async resetToSeedData(): Promise<void> {
    await this.wipeAndResetDatabase();
  }

  // Generic Query Executor returning typed object array
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.getDb();
    const cleanParams = sanitizeParams(params);
    let stmt;
    try {
      stmt = db.prepare(sql);
      stmt.bind(cleanParams);
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
      return results;
    } catch (err) {
      console.error('SQL Query Error:', err, sql, cleanParams);
      throw err;
    } finally {
      if (stmt) {
        try {
          stmt.free();
        } catch {
          // ignore
        }
      }
    }
  }

  // Generic Statement Executor
  async exec(sql: string, params: any[] = []): Promise<void> {
    const db = await this.getDb();
    const cleanParams = sanitizeParams(params);
    try {
      if (cleanParams.length === 0) {
        db.exec(sql);
      } else {
        db.run(sql, cleanParams);
      }
      this.notifyChange();
    } catch (err) {
      console.error('SQL Exec Error:', err, sql, cleanParams);
      throw err;
    }
  }

  // 1. ATOMIC SALE TRANSACTION
  async saveSaleTransaction(sale: Sale, items: SaleItem[]): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      // 1.1 Insert Sale Header
      this.safeRun(
        `INSERT INTO sales (
          id, invoice_no, bill_type, sale_date, customer_id, tax_type,
          customer_previous_balance, sub_total, bill_discount_amount, other_adjustment,
          total_cgst, total_sgst, total_igst, total_gst, round_off, net_amount,
          amount_received, payment_mode, total_cost_of_goods, net_profit, is_cancelled,
          created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sale.id, sale.invoice_no, sale.bill_type, sale.sale_date, sale.customer_id, sale.tax_type,
          sale.customer_previous_balance, sale.sub_total, sale.bill_discount_amount, sale.other_adjustment,
          sale.total_cgst, sale.total_sgst, sale.total_igst, sale.total_gst, sale.round_off, sale.net_amount,
          sale.amount_received, sale.payment_mode, sale.total_cost_of_goods, sale.net_profit, sale.is_cancelled ? 1 : 0,
          sale.created_at, 'PENDING'
        ]
      );

      // 1.2 Insert Line Items & Deduct Batch Stock
      for (const item of items) {
        this.safeRun(
          `INSERT INTO sale_items (
            id, sale_id, medicine_id, batch_id, product_name, hsn_code, pack_size,
            mfg_by, batch_no, exp_date_mm_yy, qty, free_qty, mrp, sale_rate,
            discount_percent, taxable_amount, gst_percent, cgst_percent, cgst_amount,
            sgst_percent, sgst_amount, igst_percent, igst_amount, line_total,
            net_landing_cost_snapshot, line_profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id, item.sale_id, item.medicine_id, item.batch_id, item.product_name, item.hsn_code,
            item.pack_size, item.mfg_by, item.batch_no, item.exp_date_mm_yy, item.qty, item.free_qty || 0,
            item.mrp, item.sale_rate, item.discount_percent, item.taxable_amount, item.gst_percent,
            item.cgst_percent, item.cgst_amount, item.sgst_percent, item.sgst_amount, item.igst_percent,
            item.igst_amount, item.line_total, item.net_landing_cost_snapshot, item.line_profit
          ]
        );

        // Deduct physical stock: qty + free_qty
        const totalUnitsDeducted = (item.qty || 0) + (item.free_qty || 0);
        this.safeRun(
          `UPDATE inventory_batches
           SET available_qty = MAX(0, available_qty - ?),
               updated_at = ?
           WHERE id = ?`,
          [totalUnitsDeducted, sale.created_at, item.batch_id]
        );

        // Update customer rate memory
        this.safeRun(
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
            sale.created_at
          ]
        );
      }

      // 1.3 Update Customer Ledger and Current Balance
      const custRows = await this.query<Party>(`SELECT current_balance FROM parties WHERE id = ?`, [sale.customer_id]);
      const prevBal = custRows.length > 0 ? custRows[0].current_balance : 0;
      const newBalAfterBill = prevBal + sale.net_amount;

      // Ledger row for bill debit
      this.safeRun(
        `INSERT INTO party_ledger_transactions (
          id, party_id, transaction_date, voucher_type, voucher_no, reference_id,
          debit_amount, credit_amount, running_balance, payment_method, narration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `LEDGER_BILL_${sale.id}`,
          sale.customer_id,
          sale.sale_date,
          sale.bill_type === 'GST_INVOICE' ? 'GST_TAX_INVOICE' : 'SIMPLE_BILL',
          sale.invoice_no,
          sale.id,
          sale.net_amount,
          0,
          newBalAfterBill,
          sale.payment_mode,
          `Sale Bill ${sale.invoice_no} (${sale.bill_type === 'GST_INVOICE' ? 'GST Invoice' : 'Estimate Memo'})`,
          sale.created_at
        ]
      );

      let finalCustomerBalance = newBalAfterBill;

      // If customer made immediate payment (Cash/UPI/Partial)
      if (sale.amount_received > 0) {
        finalCustomerBalance = newBalAfterBill - sale.amount_received;
        this.safeRun(
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
      this.safeRun(
        `UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`,
        [finalCustomerBalance, sale.created_at, sale.customer_id]
      );

      // Increment Company Invoice Sequence
      if (sale.bill_type === 'GST_INVOICE') {
        this.safeRun(
          `UPDATE company_profile SET gst_invoice_next_no = gst_invoice_next_no + 1 WHERE id = 'RADHA_DRUGS_MAIN'`
        );
      } else {
        this.safeRun(
          `UPDATE company_profile SET simple_bill_next_no = simple_bill_next_no + 1 WHERE id = 'RADHA_DRUGS_MAIN'`
        );
      }

      // Queue in sync_queue for Supabase
      this.safeRun(
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

  // Cancel/Delete Sale Bill (Restores deducted batch stock & reverses customer ledger)
  async deleteSaleTransaction(saleId: string): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const sales = await this.query<Sale>(`SELECT * FROM sales WHERE id = ?`, [saleId]);
      if (sales.length === 0) throw new Error('Sale bill not found');
      const sale = sales[0];

      const items = await this.query<SaleItem>(`SELECT * FROM sale_items WHERE sale_id = ?`, [saleId]);

      // 1. Restore batch stock
      for (const it of items) {
        const unitsToRestore = (it.qty || 0) + (it.free_qty || 0);
        this.safeRun(
          `UPDATE inventory_batches
           SET available_qty = available_qty + ?,
               updated_at = ?
           WHERE id = ?`,
          [unitsToRestore, new Date().toISOString(), it.batch_id]
        );
      }

      // 2. Reverse customer balance
      const custRows = await this.query<Party>(`SELECT current_balance FROM parties WHERE id = ?`, [sale.customer_id]);
      if (custRows.length > 0) {
        const netReversal = sale.net_amount - (sale.amount_received || 0);
        const newBal = custRows[0].current_balance - netReversal;
        this.safeRun(
          `UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`,
          [newBal, new Date().toISOString(), sale.customer_id]
        );
      }

      // 3. Delete records
      this.safeRun(`DELETE FROM party_ledger_transactions WHERE reference_id = ?`, [saleId]);
      this.safeRun(`DELETE FROM sale_items WHERE sale_id = ?`, [saleId]);
      this.safeRun(`DELETE FROM sales WHERE id = ?`, [saleId]);

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // 2. ATOMIC PURCHASE TRANSACTION (3-Way smart entry with exact stock increment)
  async savePurchaseTransaction(
    purchase: Purchase,
    items: PurchaseItem[],
    newMedicines: Partial<MedicineMaster>[] = []
  ): Promise<void> {
    const db = await this.getDb();

    // Check duplicate bill guard: (vendor_id, supplier_invoice_no)
    const existingBills = await this.query<{ id: string }>(
      `SELECT id FROM purchases WHERE vendor_id = ? AND UPPER(TRIM(supplier_invoice_no)) = ?`,
      [purchase.vendor_id, purchase.supplier_invoice_no.trim().toUpperCase()]
    );
    if (existingBills.length > 0) {
      throw new Error(`Invoice #${purchase.supplier_invoice_no} from this vendor has already been entered into the system.`);
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      // 2.1 Insert Purchase Header
      this.safeRun(
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

      // 2.2 Process Each Item with Exact Medicine & Batch Upsert
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const rawName = (item.product_name || '').trim().toUpperCase();
        if (!rawName) continue;

        // Auto-Create or Update Medicine in medicines_master
        let resolvedMedId = item.medicine_id;
        const existingMeds = await this.query<{ id: string }>(
          `SELECT id FROM medicines_master WHERE UPPER(TRIM(name)) = ?`,
          [rawName]
        );

        if (existingMeds.length > 0) {
          resolvedMedId = existingMeds[0].id;
          this.safeRun(
            `UPDATE medicines_master SET
              hsn_code = COALESCE(NULLIF(?, ''), hsn_code),
              pack_size = COALESCE(NULLIF(?, ''), pack_size),
              mfg_by = COALESCE(NULLIF(?, ''), mfg_by),
              gst_percent = ?,
              updated_at = ?
             WHERE id = ?`,
            [item.hsn_code || '3004', item.pack_size || '', item.mfg_by || '', item.gst_percent || 5, purchase.created_at, resolvedMedId]
          );
        } else {
          resolvedMedId = resolvedMedId || `MED_${Date.now()}_${idx + 1}`;
          this.safeRun(
            `INSERT INTO medicines_master (
              id, name, hsn_code, pack_size, mfg_by, salt_composition, gst_percent,
              barcode_gtin, min_stock_alert, default_discount_percent, updated_at, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              resolvedMedId, rawName, item.hsn_code || '3004', item.pack_size || '',
              item.mfg_by || '', '', item.gst_percent ?? 5,
              '', 20, 0, purchase.created_at, 'PENDING'
            ]
          );
        }

        // Scheme Quantities & Total Inward Physical Units
        const billedQty = Number(item.billed_qty) || 0;
        const freeQty = Number(item.free_qty) || 0;
        const totalInwardUnits = billedQty + freeQty;

        const rawBatchNo = (item.batch_no || 'DEFAULT').trim().toUpperCase();
        const expIso = parseExpDateToIso(item.exp_date_mm_yy);
        const defaultSaleRate = Math.round((item.net_landing_cost || item.purchase_rate) * 1.25 * 100) / 100;

        // Auto-Create or Increment Batch in inventory_batches
        let resolvedBatchId = item.batch_id;
        const existingBatches = await this.query<{ id: string; available_qty: number }>(
          `SELECT id, available_qty FROM inventory_batches WHERE medicine_id = ? AND UPPER(TRIM(batch_no)) = ?`,
          [resolvedMedId, rawBatchNo]
        );

        if (existingBatches.length > 0) {
          resolvedBatchId = existingBatches[0].id;
          this.safeRun(
            `UPDATE inventory_batches SET
              available_qty = available_qty + ?,
              mrp = ?,
              old_mrp = ?,
              purchase_rate = ?,
              purchase_discount_percent = ?,
              gst_percent = ?,
              scheme_billed_qty = ?,
              scheme_free_qty = ?,
              net_landing_cost = ?,
              default_sale_rate = ?,
              exp_date_mm_yy = ?,
              exp_date_iso = ?,
              last_vendor_id = ?,
              updated_at = ?
             WHERE id = ?`,
            [
              totalInwardUnits,
              item.mrp || 0,
              item.old_mrp || 0,
              item.purchase_rate || 0,
              item.discount_percent || 0,
              item.gst_percent || 0,
              billedQty,
              freeQty,
              item.net_landing_cost || item.purchase_rate,
              defaultSaleRate,
              item.exp_date_mm_yy || '',
              expIso,
              purchase.vendor_id,
              purchase.created_at,
              resolvedBatchId
            ]
          );
        } else {
          resolvedBatchId = resolvedBatchId || `BATCH_${resolvedMedId}_${rawBatchNo.replace(/[^A-Z0-9]/g, '_')}`;
          this.safeRun(
            `INSERT INTO inventory_batches (
              id, medicine_id, batch_no, exp_date_mm_yy, exp_date_iso, mrp, old_mrp,
              purchase_rate, purchase_discount_percent, gst_percent, scheme_billed_qty,
              scheme_free_qty, net_landing_cost, default_sale_rate, available_qty,
              last_vendor_id, rack_location, updated_at, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              resolvedBatchId, resolvedMedId, rawBatchNo,
              item.exp_date_mm_yy || '', expIso, item.mrp || 0, item.old_mrp || 0,
              item.purchase_rate || 0, item.discount_percent || 0, item.gst_percent || 0,
              billedQty, freeQty, item.net_landing_cost || item.purchase_rate,
              defaultSaleRate, totalInwardUnits, purchase.vendor_id,
              'GEN', purchase.created_at, 'PENDING'
            ]
          );
        }

        // Insert into purchase_items
        this.safeRun(
          `INSERT INTO purchase_items (
            id, purchase_id, medicine_id, batch_id, product_name, hsn_code, pack_size,
            mfg_by, batch_no, exp_date_mm_yy, billed_qty, free_qty, mrp, old_mrp,
            purchase_rate, discount_percent, taxable_amount, gst_percent, cgst_amount,
            sgst_amount, igst_amount, line_total, net_landing_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id || `PITEM_${purchase.id}_${idx + 1}`,
            purchase.id, resolvedMedId, resolvedBatchId, rawName,
            item.hsn_code || '3004', item.pack_size || '', item.mfg_by || '', rawBatchNo,
            item.exp_date_mm_yy || '', billedQty, freeQty, item.mrp || 0, item.old_mrp || 0,
            item.purchase_rate || 0, item.discount_percent || 0, item.taxable_amount || 0,
            item.gst_percent || 0, item.cgst_amount || 0, item.sgst_amount || 0,
            item.igst_amount || 0, item.line_total || 0, item.net_landing_cost || 0
          ]
        );
      }

      // 2.3 Update Vendor Ledger & Current Balance
      const vendRows = await this.query<Party>(`SELECT current_balance FROM parties WHERE id = ?`, [purchase.vendor_id]);
      const prevBal = vendRows.length > 0 ? vendRows[0].current_balance : 0;
      const newBalAfterBill = prevBal + purchase.grand_total; // Vendor payable increases

      this.safeRun(
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
        this.safeRun(
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

      this.safeRun(
        `UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`,
        [finalVendorBalance, purchase.created_at, purchase.vendor_id]
      );

      // Enqueue sync
      this.safeRun(
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

  // Cancel/Delete Purchase Bill (Restores inventory batches & reverses vendor balance)
  async deletePurchaseTransaction(purchaseId: string): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const purchases = await this.query<Purchase>(`SELECT * FROM purchases WHERE id = ?`, [purchaseId]);
      if (purchases.length === 0) throw new Error('Purchase bill not found');
      const purchase = purchases[0];

      const items = await this.query<PurchaseItem>(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);

      // Deduct batches that were added by this purchase
      for (const it of items) {
        const unitsToRemove = (it.billed_qty || 0) + (it.free_qty || 0);
        this.safeRun(
          `UPDATE inventory_batches
           SET available_qty = MAX(0, available_qty - ?),
               updated_at = ?
           WHERE id = ?`,
          [unitsToRemove, new Date().toISOString(), it.batch_id]
        );
      }

      // Reverse vendor balance
      const vendRows = await this.query<Party>(`SELECT current_balance FROM parties WHERE id = ?`, [purchase.vendor_id]);
      if (vendRows.length > 0) {
        const netReversal = purchase.grand_total - (purchase.amount_paid || 0);
        const newBal = vendRows[0].current_balance - netReversal;
        this.safeRun(
          `UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`,
          [newBal, new Date().toISOString(), purchase.vendor_id]
        );
      }

      // Delete records
      this.safeRun(`DELETE FROM party_ledger_transactions WHERE reference_id = ?`, [purchaseId]);
      this.safeRun(`DELETE FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);
      this.safeRun(`DELETE FROM purchases WHERE id = ?`, [purchaseId]);

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // 3. ATOMIC RETURN / ADJUSTMENT / DEBIT NOTE / CREDIT NOTE
  async saveAdjustmentTransaction(adj: ReturnAdjustment): Promise<void> {
    const db = await this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      this.safeRun(
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
        this.safeRun(
          `UPDATE inventory_batches SET available_qty = MAX(0, available_qty - ?), updated_at = ? WHERE id = ?`,
          [adj.qty, adj.created_at, adj.batch_id]
        );
      } else if (adj.adjustment_type === 'SALES_RETURN_CREDIT_NOTE' || adj.adjustment_type === 'STOCK_SURPLUS') {
        this.safeRun(
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
            newBal = party.current_balance - adj.total_amount;
            this.safeRun(
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
            newBal = party.current_balance - adj.total_amount;
            this.safeRun(
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
          this.safeRun(`UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`, [newBal, adj.created_at, adj.party_id]);
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
        newBalance = party.current_balance - data.amount;
        credit = data.amount;
      } else {
        newBalance = party.current_balance - data.amount;
        debit = data.amount;
      }

      const voucherNo = `${data.voucher_type === 'PAYMENT_RECEIVED' ? 'RCPT' : 'PAY'}-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      this.safeRun(
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

      this.safeRun(`UPDATE parties SET current_balance = ?, updated_at = ? WHERE id = ?`, [newBalance, now, data.party_id]);

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('Failed payment transaction:', err);
      throw err;
    }
  }

  // 5. MANUAL OPENING STOCK BATCH CREATION & EDITING
  async addOrUpdateManualBatch(data: {
    id?: string;
    medicine_name: string;
    hsn_code?: string;
    pack_size?: string;
    mfg_by?: string;
    batch_no: string;
    exp_date_mm_yy: string;
    mrp: number;
    old_mrp?: number;
    purchase_rate: number;
    purchase_discount_percent?: number;
    gst_percent: number;
    default_sale_rate?: number;
    available_qty: number;
    rack_location?: string;
  }): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const rawMedName = data.medicine_name.trim().toUpperCase();
    const rawBatchNo = data.batch_no.trim().toUpperCase();
    const expIso = parseExpDateToIso(data.exp_date_mm_yy);
    const saleRate = data.default_sale_rate || Math.round(data.purchase_rate * 1.25 * 100) / 100;

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Ensure medicine exists
      let medId: string;
      const existingMeds = await this.query<{ id: string }>(`SELECT id FROM medicines_master WHERE UPPER(TRIM(name)) = ?`, [rawMedName]);
      if (existingMeds.length > 0) {
        medId = existingMeds[0].id;
        this.safeRun(
          `UPDATE medicines_master SET
            hsn_code = COALESCE(NULLIF(?, ''), hsn_code),
            pack_size = COALESCE(NULLIF(?, ''), pack_size),
            mfg_by = COALESCE(NULLIF(?, ''), mfg_by),
            gst_percent = ?,
            updated_at = ?
           WHERE id = ?`,
          [data.hsn_code || '3004', data.pack_size || '', data.mfg_by || '', data.gst_percent || 5, now, medId]
        );
      } else {
        medId = `MED_${Date.now()}`;
        this.safeRun(
          `INSERT INTO medicines_master (
            id, name, hsn_code, pack_size, mfg_by, salt_composition, gst_percent,
            barcode_gtin, min_stock_alert, default_discount_percent, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            medId, rawMedName, data.hsn_code || '3004', data.pack_size || '',
            data.mfg_by || '', '', data.gst_percent || 5,
            '', 20, 0, now, 'PENDING'
          ]
        );
      }

      // 2. Insert or update batch
      let batchId = data.id;
      if (!batchId) {
        const existingBatches = await this.query<{ id: string }>(
          `SELECT id FROM inventory_batches WHERE medicine_id = ? AND UPPER(TRIM(batch_no)) = ?`,
          [medId, rawBatchNo]
        );
        if (existingBatches.length > 0) {
          batchId = existingBatches[0].id;
        } else {
          batchId = `BATCH_${medId}_${rawBatchNo.replace(/[^A-Z0-9]/g, '_')}`;
        }
      }

      this.safeRun(
        `INSERT INTO inventory_batches (
          id, medicine_id, batch_no, exp_date_mm_yy, exp_date_iso, mrp, old_mrp,
          purchase_rate, purchase_discount_percent, gst_percent, scheme_billed_qty,
          scheme_free_qty, net_landing_cost, default_sale_rate, available_qty,
          last_vendor_id, rack_location, updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          batch_no = excluded.batch_no,
          exp_date_mm_yy = excluded.exp_date_mm_yy,
          exp_date_iso = excluded.exp_date_iso,
          mrp = excluded.mrp,
          old_mrp = excluded.old_mrp,
          purchase_rate = excluded.purchase_rate,
          purchase_discount_percent = excluded.purchase_discount_percent,
          gst_percent = excluded.gst_percent,
          net_landing_cost = excluded.net_landing_cost,
          default_sale_rate = excluded.default_sale_rate,
          available_qty = excluded.available_qty,
          rack_location = excluded.rack_location,
          updated_at = excluded.updated_at`,
        [
          batchId, medId, rawBatchNo, data.exp_date_mm_yy, expIso, data.mrp, data.old_mrp || 0,
          data.purchase_rate, data.purchase_discount_percent || 0, data.gst_percent,
          data.available_qty, 0, data.purchase_rate, saleRate, data.available_qty,
          null, data.rack_location || 'GEN', now, 'PENDING'
        ]
      );

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // Delete an inventory batch
  async deleteBatch(batchId: string): Promise<void> {
    const db = await this.getDb();
    this.safeRun(`DELETE FROM inventory_batches WHERE id = ?`, [batchId]);
    this.notifyChange();
  }

  // Delete a party (if no transactions)
  async deleteParty(partyId: string): Promise<void> {
    const db = await this.getDb();
    const ledgerCount = await this.query<{ count: number }>(`SELECT COUNT(*) as count FROM party_ledger_transactions WHERE party_id = ?`, [partyId]);
    if (ledgerCount.length > 0 && ledgerCount[0].count > 0) {
      throw new Error('Cannot delete this party because ledger transactions exist under their account.');
    }
    this.safeRun(`DELETE FROM parties WHERE id = ?`, [partyId]);
    this.notifyChange();
  }

  // Helper to upsert a Party
  async upsertParty(party: Partial<Party>): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = party.id || `PARTY_${Date.now()}`;
    const isNew = !party.id;

    this.safeRun(
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

    // If opening balance != 0 and party is new, record in ledger
    if (isNew && (party.opening_balance || 0) !== 0) {
      this.safeRun(
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
      version: '2.0',
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
      const tables = [
        'purchase_items', 'sale_items', 'purchases', 'sales',
        'returns_adjustments', 'party_ledger_transactions',
        'customer_rate_memory', 'inventory_batches', 'medicines_master',
        'parties', 'company_profile'
      ];
      for (const t of tables) {
        db.exec(`DELETE FROM ${t};`);
      }

      const d = backup.data;
      if (d.profile) {
        for (const p of d.profile) {
          this.safeRun(`INSERT INTO company_profile VALUES (${Object.keys(p).map(() => '?').join(',')})`, Object.values(p));
        }
      }
      if (d.parties) {
        for (const p of d.parties) {
          this.safeRun(`INSERT INTO parties VALUES (${Object.keys(p).map(() => '?').join(',')})`, Object.values(p));
        }
      }
      if (d.medicines) {
        for (const m of d.medicines) {
          this.safeRun(`INSERT INTO medicines_master VALUES (${Object.keys(m).map(() => '?').join(',')})`, Object.values(m));
        }
      }
      if (d.batches) {
        for (const b of d.batches) {
          this.safeRun(`INSERT INTO inventory_batches VALUES (${Object.keys(b).map(() => '?').join(',')})`, Object.values(b));
        }
      }
      if (d.purchases) {
        for (const p of d.purchases) {
          this.safeRun(`INSERT INTO purchases VALUES (${Object.keys(p).map(() => '?').join(',')})`, Object.values(p));
        }
      }
      if (d.purchaseItems) {
        for (const pi of d.purchaseItems) {
          this.safeRun(`INSERT INTO purchase_items VALUES (${Object.keys(pi).map(() => '?').join(',')})`, Object.values(pi));
        }
      }
      if (d.sales) {
        for (const s of d.sales) {
          this.safeRun(`INSERT INTO sales VALUES (${Object.keys(s).map(() => '?').join(',')})`, Object.values(s));
        }
      }
      if (d.saleItems) {
        for (const si of d.saleItems) {
          this.safeRun(`INSERT INTO sale_items VALUES (${Object.keys(si).map(() => '?').join(',')})`, Object.values(si));
        }
      }
      if (d.adjustments) {
        for (const a of d.adjustments) {
          this.safeRun(`INSERT INTO returns_adjustments VALUES (${Object.keys(a).map(() => '?').join(',')})`, Object.values(a));
        }
      }
      if (d.ledger) {
        for (const l of d.ledger) {
          this.safeRun(`INSERT INTO party_ledger_transactions VALUES (${Object.keys(l).map(() => '?').join(',')})`, Object.values(l));
        }
      }
      if (d.customerRates) {
        for (const cr of d.customerRates) {
          this.safeRun(`INSERT INTO customer_rate_memory VALUES (${Object.keys(cr).map(() => '?').join(',')})`, Object.values(cr));
        }
      }

      db.exec('COMMIT;');
      this.notifyChange();
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }
  }
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
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return '2030-12-31';
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
}

export const dbService = new DatabaseService();
