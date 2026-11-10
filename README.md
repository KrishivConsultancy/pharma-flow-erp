# PharmaFlow Enterprise ERP

> **Enterprise-Grade Offline-First Pharmaceutical Distribution ERP & Wholesale Billing Engine**  
> *Engineered for high-volume medicine distributors, wholesale stockists, and pharmaceutical C&F agencies. Out-of-the-box pre-configured for Radha Drugs Wholesale Medicine Dealer (Begusarai, Bihar).*

[![Platform](https://img.shields.io/badge/Platform-Windows%20x64%20%7C%20Web-blue?style=flat-square&logo=windows)](https://github.com/KrishivConsultancy/pharma-flow-erp)
[![Engine](https://img.shields.io/badge/Runtime-Electron%2034%20%7C%20React%2019%20%7C%20TypeScript-0284c7?style=flat-square)](https://github.com/KrishivConsultancy/pharma-flow-erp)
[![Database](https://img.shields.io/badge/Database-Local%20SQLite%20Wasm%20%2B%20Supabase%20Sync-059669?style=flat-square)](https://github.com/KrishivConsultancy/pharma-flow-erp)
[![Verification](https://img.shields.io/badge/GSTIN-Live%20Cashfree%20VRS%20v2-d97706?style=flat-square)](https://github.com/KrishivConsultancy/pharma-flow-erp)
[![Auto-Updater](https://img.shields.io/badge/Updates-GitHub%20Releases%20Native%20Updater-7c3aed?style=flat-square)](https://github.com/KrishivConsultancy/pharma-flow-erp)

---

## Executive Overview

**PharmaFlow Enterprise ERP** is a mission-critical, offline-first desktop and cloud enterprise system designed to solve the harsh operational realities of Indian wholesale medicine distribution: intermittent internet connectivity, strict Drugs and Cosmetics Act compliance, razor-thin margins requiring exact scheme landing cost calculations, and rapid counter-billing where every millisecond counts.

Unlike generic accounting software or cloud-only web portals that freeze when broadband drops, PharmaFlow runs on an **in-process SQLite Wasm engine with binary IndexedDB/disk persistence**. Every transaction executes with ACID atomicity locally in `< 5ms`, while background workers asynchronously synchronize mutation logs to **Supabase Cloud** for multi-device replication and disaster recovery.

### Zero-Friction Native Updates
Equipped with **`electron-updater`**, the Windows desktop client continuously listens to the official GitHub Release channel. When an update is published, the app silently downloads the delta package in the background and prompts with a one-click restart banner—eliminating manual `.exe` reinstalls, USB pendrive distribution, or remote desktop technician calls.

---

## Core Capabilities

### 1. High-Velocity Wholesale Billing Engine (`F1`)
- **Dual-Mode Invoicing:** One-key toggle between **GST Tax Invoice** (B2B registered chemist billing with HSN, 15-column breakdown, CGST/SGST/IGST) and **Simple Bill / Estimate** (0% non-GST counter sales).
- **Keyboard-First Navigation:** 100% operable without touching the mouse (`Enter` to advance cells, `F1`–`F8` module jumps, `Alt+G` for GST toggle, `Alt+S` for atomic save, `Ctrl+P` for instant print preview).
- **Customer Rate Memory:** Automatically recalls the exact discount and special net price negotiated for every customer-medicine pair during previous visits.
- **Credit Limit & Outstanding Guard:** Live balance check against predefined party credit limits before invoice finalization.

### 2. FEFO Batch Inventory & Expiry Radar (`F3`)
- **First Expiry, First Out (FEFO):** Enforces automated dispensing of earliest-expiring stock batches to eliminate unsellable expired inventory.
- **90-Day Expiry Radar:** Color-coded alert badges categorizing batches into Expired, < 30 Days, < 60 Days, and < 90 Days.
- **1-Click Supplier Return Memo:** Automatically packages expiring or damaged stock into formal Supplier Debit Notes with batch numbers and invoice references.
- **Shortage Book:** Real-time procurement tracker monitoring medicines that breach minimum stock thresholds.

### 3. Live Cashfree GSTIN Verification API
- **Live KYC Onboarding:** Validates 15-character GSTINs in real time against the **Cashfree Verification Suite (VRS v2)**.
- **Auto-Fill Party Details:** Automatically extracts registered Trade Name, Legal Entity Name, Principal Place of Business, City, State Code, and Pincode.
- **Intelligent Offline Fallback:** When offline, an internal 36-state regex engine parses State, PAN, and jurisdiction without halting billing.

### 4. AI Supplier Invoice Scanner (Gemini 2.5 Flash Vision)
- **Zero-Data-Entry Purchase Entry (`F2`):** Upload supplier invoice photos or PDFs (e.g., Indizen Pharmaceuticals, Cipla, Alkem).
- **Multi-Line Extraction:** Extracts supplier invoice number, date, HSN codes, batch numbers, MM/YY expiries, MRP, purchase rates, scheme quantities (`Billed + Free`), and GST slabs directly into an editable verification grid.

### 5. Pixel-Exact Print & Share System
- **Radha Drugs Pre-Configured Template:** 15-column high-density wholesale layout conforming to standard Indian pharma stationery.
- **Format Toggle:** Supports Half-Page Landscape (continuous tractor feed / dot-matrix / thermal) and Standard A4 Portrait (laser / inkjet).
- **WhatsApp Direct Share:** Formats clean text invoice summaries and deep-links directly into WhatsApp Web or Desktop with one click.
- **Statutory Disclaimers:** Pre-loaded with standard Section 19 Drug Act 1940 warranty declarations.

### 6. CA Audit Pack & Financial Analytics (`F6`)
- **GSTR-1 CSV Exporter:** Generates ready-to-upload B2B (table 4A/4B/4C) and B2CS tabular returns.
- **GSTR-2B Inward Reconciliation:** Comprehensive inward purchase tax summaries categorized by supplier GSTIN.
- **HSN-Wise GST Slab Breakdown:** Consolidated taxable value, CGST, SGST, and IGST totals across 0%, 5%, 12%, 18%, and 28% slabs.
- **True FIFO/FEFO Profit & Loss Engine:** Computes exact gross margins using net scheme landing costs rather than unadjusted purchase rates.

---

## Live Services & Integration Matrix

| Integration | Technology / Provider | Purpose | Offline Behavior |
| :--- | :--- | :--- | :--- |
| **Local Database** | SQLite Wasm (`sql.js`) + IndexedDB | Master persistence for all CRUD, ledgers, & stock | 100% functional; primary system of record |
| **Cloud Replication** | Supabase PostgreSQL (`@supabase/supabase-js`) | Multi-device cloud sync, ledger backup & restore | Queues mutations in local `sync_queue`; auto-syncs on reconnect |
| **GSTIN Verification**| Cashfree VRS v2 (`/verification/gstin`) | Live legal KYC, GST status, & address auto-fill | Instant fallback to 36-state offline parser & local registry |
| **AI Bill OCR** | Google Gemini 2.5 Flash Vision API | Inward supplier bill photo/PDF to structured batch grid | Uses bundled Indizen 24-item master sample when offline |
| **Native Updates** | `electron-updater` + GitHub Releases | Silent background differential download & 1-click install | Continues on current binary until online |
| **Desktop Shell** | Electron 34 + NSIS Packaging | Native Windows desktop runtime & thermal/laser printing | Fully standalone Windows desktop application |

---

## Exact Pharmaceutical Mathematics

PharmaFlow implements floating-point safe, standard Indian pharmaceutical calculations:

### 1. Net Landing Cost (Scheme Purchase)
$$\text{Net Landing Cost (Excl. GST)} = \frac{\text{Billed Qty} \times \text{Purchase Rate} \times \left(1 - \frac{\text{Disc\%}}{100}\right)}{\text{Billed Qty} + \text{Free Qty}}$$
*(If Billed Qty + Free Qty $= 0$, falls back to Purchase Rate).*

### 2. Taxable Value & GST Calculation
$$\text{Gross Amount} = \text{Billed Qty} \times \text{Sale Rate}$$
$$\text{Taxable Value} = \text{Gross Amount} \times \left(1 - \frac{\text{Trade Disc\%}}{100}\right)$$

- **Intra-State Bihar (State Code `10` to `10`):**
  $$\text{CGST} = \text{Round}\left(\text{Taxable Value} \times \frac{\text{GST\%}}{200}, 2\right)$$
  $$\text{SGST} = \text{Round}\left(\text{Taxable Value} \times \frac{\text{GST\%}}{200}, 2\right)$$
- **Inter-State Out-of-State (e.g., Bihar `10` to Bengal `19`):**
  $$\text{IGST} = \text{Round}\left(\text{Taxable Value} \times \frac{\text{GST\%}}{100}, 2\right)$$

### 3. Net Invoice Amount & Round-Off
$$\text{Total Invoice Amount} = \sum \text{Taxable Value} + \sum \text{CGST} + \sum \text{SGST} + \sum \text{IGST}$$
$$\text{Round-Off} = \text{Round}(\text{Total Invoice Amount}, 0) - \text{Total Invoice Amount}$$
$$\text{Net Payable} = \text{Round}(\text{Total Invoice Amount}, 0)$$

---

## Keyboard Shortcuts Directory

Every major operation is mapped to standard industrial wholesale keyboard shortcuts:

| Shortcut | Scope | Action |
| :---: | :--- | :--- |
| **`F1`** | Global | Navigate to **Sales Billing Engine** |
| **`F2`** | Global | Navigate to **Purchase Entry (Stock Inward)** |
| **`F3`** | Global | Navigate to **Inventory Batches & Expiry Radar** |
| **`F4`** | Global | Navigate to **Parties Khata (Customers & Suppliers)** |
| **`F5`** | Global | Navigate to **Returns & Stock Adjustments** |
| **`F6`** | Global | Navigate to **Reports, Profit & Loss, & CA Export** |
| **`F7`** | Global | Navigate to **Settings, Cloud Auth, & Backup** |
| **`F8`** | Global | Navigate to **Executive KPI Dashboard** |
| **`Alt + G`** | Sales Billing | Toggle between **GST Tax Invoice** and **Simple Bill** |
| **`Alt + S`** | Sales / Purchase | **Atomic Save & Finalize Invoice** |
| **`Ctrl + P`**| Sales / Purchase | Open **Pixel-Exact Print Preview** |
| **`Esc`** | Any Modal | Close modal or cancel current operation |

---

## Directory & File Structure

```text
/
├── electron/
│   ├── main.cjs             # Electron main process, autoUpdater listener, IPC handlers
│   └── preload.cjs          # Context bridge exposing electronAPI & updater events
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopHeader.tsx       # Enterprise header, FY selector, cloud pill
│   │   │   ├── Sidebar.tsx         # High-contrast navigation with F1-F8 badges
│   │   │   └── UpdaterBanner.tsx   # Real-time native auto-update notification bar
│   │   ├── modals/
│   │   │   ├── BatchPickerModal.tsx    # FEFO keyboard-driven batch selector
│   │   │   ├── PartyFormModal.tsx      # Cashfree live GSTIN auto-fetch modal
│   │   │   ├── PaymentEntryModal.tsx   # Cash/UPI/Bank receipt & payment vouchers
│   │   │   └── AiInvoiceScanModal.tsx  # Gemini Vision purchase bill scanner
│   │   └── print/
│   │       ├── GstTaxInvoiceTemplate.tsx # 15-column Radha Drugs GST layout
│   │       ├── SimpleBillTemplate.tsx    # Clean Non-GST estimate / cash memo
│   │       └── InvoicePrintModal.tsx     # Print controller (A5/A4 + WhatsApp)
│   ├── db/
│   │   ├── schema.ts           # SQLite DDL, indexes, and TypeScript models
│   │   ├── databaseService.ts  # SQLite Wasm engine, ACID transactions, IDB sync
│   │   ├── seedData.ts         # Radha Drugs initial master catalog & ledger seed
│   │   └── supabaseSync.ts     # Background cloud sync worker & queue manager
│   ├── pages/
│   │   ├── DashboardPage.tsx         # KPI tiles, 90-day expiry radar, shortage book
│   │   ├── SalesBillingPage.tsx      # Dual-mode keyboard billing engine
│   │   ├── PurchaseEntryPage.tsx     # 3-way stock inward (Manual, AI OCR, CSV)
│   │   ├── InventoryBatchesPage.tsx  # Batch valuation, stock ledger, expiry note
│   │   ├── PartiesKhataPage.tsx      # 360° Customer/Vendor statement & scorecard
│   │   ├── ReturnsAdjustmentsPage.tsx# Sales Return (CN), Vendor Return (DN)
│   │   ├── ReportsProfitLossPage.tsx # True P&L, GST slabs, CA export package
│   │   └── SettingsBackupPage.tsx    # Company profile, API keys, 1-click disaster recovery
│   └── services/
│       ├── cashfreeService.ts   # Live Cashfree GSTIN API + 36-state offline parser
│       ├── geminiOcrService.ts  # Gemini 2.5 Flash Vision OCR extraction service
│       ├── numberToWords.ts     # Indian Rupee words formatter (e.g., "RS. FIVE THOUSAND...")
│       └── csvExportService.ts  # GSTR-1, GSTR-2B, HSN Summary, and Stock CSVs
├── .env.example             # Documented environment variables template
├── package.json             # Build configuration, electron-builder NSIS & publish specs
├── tsconfig.json            # Strict TypeScript configuration
└── vite.config.ts           # Vite + Tailwind v4 + sql.js Wasm configuration
```

---

## Local Development & Setup

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Git**

### Installation
```bash
# 1. Clone repository
git clone https://github.com/KrishivConsultancy/pharma-flow-erp.git
cd pharma-flow-erp

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env and supply your Supabase and Cashfree credentials if desired
```

### Running Locally
```bash
# Run web client in development mode
npm run dev

# Run desktop client (Vite + Electron concurrent hot-reload)
npm run electron:dev
```

---

## Packaging the Windows Desktop Installer

To compile the standalone Windows NSIS executable installer:

```bash
# Compiles Vite frontend and builds Windows x64 NSIS Setup binary
npm run dist:win
```

The compiled installer is output to:
- `release/Radha-Drugs-ERP-Setup.exe` (Standalone Windows x64 NSIS Installer)

### How Auto-Updates Work via GitHub Releases
When new code is pushed to this repository:
1. Update `"version"` in `package.json` (e.g., from `1.0.0` to `1.0.1`).
2. Run `npm run dist:win` or trigger GitHub Actions CI/CD to generate the release binaries (`Radha-Drugs-ERP-Setup.exe`, `latest.yml`).
3. Create a GitHub Release tagged with `v1.0.1` on `KrishivConsultancy/pharma-flow-erp` and attach the compiled artifacts.
4. On the client desktop, `electron-updater` checks for new versions on startup, silently downloads the patch in the background, and displays the **"Update Ready! Click here to Restart & Install"** notification banner.

---

## Security & Privacy Posture

- **Air-Gapped Operation:** All financial calculations, inventory ledgers, and invoice print generation function 100% locally with zero internet dependency.
- **Isolated SQLite Storage:** Local database records are stored in browser-sandboxed IndexedDB/local binary storage.
- **No Hardcoded Secrets:** Production credentials (Cashfree client secrets, Supabase service keys, Gemini API keys) are strictly loaded via `.env` or user-entered through the encrypted Settings hub.
- **Non-Repudiation:** Inward bills, sales returns, and credit notes are permanently recorded with immutable timestamps and user audit references.

---

## License & Intellectual Property

Copyright © 2026 **Krishiv Consultancy**. All Rights Reserved.  
Proprietary software developed for **Radha Drugs Wholesale Medicine Dealer**, Begusarai, Bihar. Unauthorized copying, distribution, or reverse-engineering is strictly prohibited.
