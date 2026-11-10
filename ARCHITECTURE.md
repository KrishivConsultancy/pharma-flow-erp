# System Architecture & Technical Specifications

## PharmaFlow Enterprise ERP

This document outlines the architectural design, storage engine, transaction semantics, synchronization protocols, and auto-updater mechanisms of PharmaFlow Enterprise ERP.

---

## 1. High-Level Architecture Diagram

```text
+---------------------------------------------------------------------------------------+
|                                    USER INTERFACE                                     |
|               React 19 + TypeScript + Tailwind CSS (High-Contrast Theme)              |
|        [F1 Sales]  [F2 Purchase]  [F3 Inventory]  [F4 Parties]  [F5 Returns]          |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                APPLICATION CONTROLLER                                 |
|   • Keyboard Shortcuts Dispatcher (F1-F8, Alt+G, Alt+S, Ctrl+P)                      |
|   • Formula Calculation Service (Scheme Landing Cost, Bihar CGST/SGST, Inter-state)   |
|   • Document Print Formatter (Radha Drugs 15-Col Tax Invoice & Simple Bill)           |
|   • CSV / Excel Exporter (GSTR-1, GSTR-2B, HSN Summary, Stock Valuation)              |
+---------------------------------------------------------------------------------------+
                   |                               |                      |
                   v                               v                      v
+--------------------------------------+   +----------------+   +-------------------+
|      PRIMARY DATABASE SERVICE        |   | LIVE CASHFREE  |   | GEMINI 2.5 FLASH  |
|  • In-Memory SQLite Wasm Engine      |   | VRS v2 CLIENT  |   | VISION OCR ENGINE |
|  • ACID Transaction Orchestrator     |   +----------------+   +-------------------+
|  • IndexedDB Disk Persistence Layer  |
+--------------------------------------+
                   |
                   v (Async Queue Processing)
+---------------------------------------------------------------------------------------+
|                             BACKGROUND SYNC PIPELINE                                  |
|  • Local sync_queue Table (Pending Change Mutations)                                  |
|  • Supabase Cloud PostgreSQL Sync Worker                                              |
|  • Conflict-Free Timestamp Ordering                                                   |
+---------------------------------------------------------------------------------------+
                   |
                   v (Desktop Shell Layer)
+---------------------------------------------------------------------------------------+
|                           ELECTRON DESKTOP RUNTIME (v34)                              |
|  • electron-updater Listening to GitHub Releases                                      |
|  • Native Thermal & Laser PDF Printing Service                                        |
|  • Local Filesystem & Hardware IPC Bridge                                             |
+---------------------------------------------------------------------------------------+
```

---

## 2. Storage & Persistence Engine

### Offline-First Guarantee
The system implements a local-first architecture where the user is **never** blocked by network latency, DNS resolution failures, or offline states:

1. **In-Memory SQLite Execution (`sql.js`):** Every SQL query runs directly against an in-memory SQLite WebAssembly instance compiled from the official C source code. Read and write latencies are sub-millisecond ($< 2\text{ms}$).
2. **IndexedDB Binary Persistence:** After every transaction or mutation, the complete binary SQLite database buffer (`Uint8Array`) is committed to the browser's persistent IndexedDB object store (`keyval-store`).
3. **Desktop File System Mirroring:** When running inside the packaged Electron shell, the database state can also be exported or imported with 1-click JSON backup files.

---

## 3. Transaction Isolation & Atomic Mutations

Wholesale pharmaceutical billing cannot tolerate partial state writes. Saving a single sale bill or purchase bill requires multi-table consistency:

```sql
BEGIN TRANSACTION;

-- 1. Insert Invoice Header
INSERT INTO invoices (...) VALUES (...);

-- 2. Insert Line Items
INSERT INTO invoice_items (...) VALUES (...);

-- 3. Batch Stock Mutation (Decrement on Sale, Increment on Purchase)
UPDATE inventory_batches 
SET available_qty = available_qty - ?
WHERE id = ?;

-- 4. Double-Entry Party Ledger Record
INSERT INTO party_ledger_transactions (
  party_id, invoice_id, txn_type, debit_amount, credit_amount, balance_after
) VALUES (...);

-- 5. Party Outstanding Balance Update
UPDATE parties 
SET current_balance = current_balance + ?
WHERE id = ?;

-- 6. Customer Rate Memory Upsert (Last Negotiated Rate)
INSERT OR REPLACE INTO customer_rate_memory (
  party_id, medicine_id, last_sale_rate, last_discount_percent, updated_at
) VALUES (...);

-- 7. Cloud Sync Queue Registration
INSERT INTO sync_queue (table_name, record_id, operation) 
VALUES ('invoices', ?, 'INSERT');

COMMIT;
```

If any single step fails (e.g. batch stock deficit or invalid foreign key), the entire transaction rolls back cleanly with zero database corruption.

---

## 4. GitHub Native Auto-Updater Pipeline

To ensure the distributor desktop client never requires manual maintenance or physical USB updates:

1. **Packaging Configuration:** Electron-builder is configured with the NSIS target and GitHub publisher:
   ```json
   "publish": {
     "provider": "github",
     "owner": "KrishivConsultancy",
     "repo": "pharma-flow-erp"
   }
   ```
2. **Startup Detection:** On application launch, `electron/main.cjs` triggers `autoUpdater.checkForUpdatesAndNotify()`.
3. **Background Delta Download:** If a newer semantic version is available on GitHub Releases, the auto-updater silently downloads the binary diff package in chunks.
4. **IPC Status Forwarding:** Real-time download progress is bridged to the React UI via `updater:status` events.
5. **Atomic Switch & Restart:** When the package has finished downloading, the UI displays a prominent banner:
   `"Update Ready! Click here to Restart & Install"`. Calling `autoUpdater.quitAndInstall()` restarts the application and applies the new update in under 5 seconds.

---

## 5. Live Cashfree VRS v2 Integration

When onboarding customers and vendors:
1. **Format Validation:** Tests 15-character Indian GSTIN against official regex:
   `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
2. **Jurisdiction Extraction:** The first 2 digits identify the State (e.g., `10` = Bihar).
3. **Live Upstream Query:**
   - Endpoint: `POST https://api.cashfree.com/verification/gstin`
   - Headers: `x-client-id`, `x-client-secret`
   - Body: `{"GSTIN": gstin, "gstin": gstin}`
4. **Field Mapping:** Parses `legal_name_of_business`, `trade_name_of_business`, `principal_place_address`, and `principal_place_split_address` (City, State, Pincode).
5. **Offline Fallback:** If internet is unavailable or upstream circuit breaker trips, an intelligent offline parser automatically resolves State and PAN from the GSTIN so counter staff can continue billing uninterrupted.
