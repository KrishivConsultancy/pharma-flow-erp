// Radha Drugs Production Configuration & Master Medicine Catalog Dictionary
// Starts with ZERO sales, ZERO purchases, ZERO customer/vendor debt, ZERO stock batches

import {
  CompanyProfile,
  Party,
  MedicineMaster,
  InventoryBatch,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  PartyLedgerTransaction,
  CustomerRateMemory,
} from './schema';

export const SEED_COMPANY_PROFILE: CompanyProfile = {
  id: 'RADHA_DRUGS_MAIN',
  company_name: 'RADHA DRUGS',
  tagline: '(WholeSale Medicine Dealer)',
  address_line1: 'HAJIPUR, PIPRA DEWASH',
  city_district: 'BEGUSARAI',
  state_name: 'BIHAR',
  state_code: '10',
  pincode: '851112',
  phone: '9835466285',
  gstin: '10BRCPK8315G2Z7',
  dl_no: 'BEG-107086/87',
  dl_valid_upto: '2029-02-06',
  fssai_no: '',
  bank_name: 'HDFC BANK',
  bank_account_no: '50200071058282',
  bank_ifsc: 'HDFC0000061',
  upi_id: '9835466285@upi',
  gst_invoice_prefix: 'T',
  gst_invoice_next_no: 1157, // Formats as T001157 for next bill
  simple_bill_prefix: 'S',
  simple_bill_next_no: 101, // Formats as S000101
  quotation_prefix: 'QT',
  quotation_next_no: 101, // Formats as QT000101
  financial_year: '2026-27',
  terms_conditions: JSON.stringify([
    'Goods once sold can not be taken back.',
    'Please check the goods at the time of taking delivery.',
    'On strength of warranty obtained by us, we hereby give warranty that the goods sold under this invoice do not contravene the provisions of section 18 of the Drug Act, 1940.',
    'In case of any inadvertent error in price charged, please bring this invoice for rectification. ALL SUBJECT TO BEGUSARAI JURISDICTION.',
  ]),
};

// ZERO pre-seeded parties: Clean ledger on fresh installation
export const SEED_PARTIES: Party[] = [];

// Clean autocomplete dictionary of standard medicine generics (with 0 stock and 0 batches)
// Allows autocomplete of HSN codes & pack sizes during billing/purchase without polluting actual stock
export const SEED_MEDICINES: MedicineMaster[] = [
  {
    id: 'MED_PARACETAMOL_650',
    name: 'PARACETAMOL 650 MG TABLET',
    hsn_code: '30049099',
    pack_size: '10*15',
    mfg_by: 'GENERIC',
    salt_composition: 'Paracetamol 650mg',
    gst_percent: 5,
    barcode_gtin: '',
    min_stock_alert: 20,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_AMOXICILLIN_CLAV',
    name: 'AMOXICILLIN AND POTASSIUM CLAVULANATE 625MG',
    hsn_code: '30041090',
    pack_size: '10*10',
    mfg_by: 'GENERIC',
    salt_composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    gst_percent: 12,
    barcode_gtin: '',
    min_stock_alert: 20,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_PANTOPRAZOLE_40',
    name: 'PANTOPRAZOLE 40 MG TABLET',
    hsn_code: '30049099',
    pack_size: '10*10',
    mfg_by: 'GENERIC',
    salt_composition: 'Pantoprazole 40mg',
    gst_percent: 5,
    barcode_gtin: '',
    min_stock_alert: 20,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_AZITHROMYCIN_500',
    name: 'AZITHROMYCIN 500 MG TABLET',
    hsn_code: '30042099',
    pack_size: '3*10',
    mfg_by: 'GENERIC',
    salt_composition: 'Azithromycin 500mg',
    gst_percent: 12,
    barcode_gtin: '',
    min_stock_alert: 15,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_CETIRIZINE_10',
    name: 'CETIRIZINE 10 MG TABLET',
    hsn_code: '30049099',
    pack_size: '10*10',
    mfg_by: 'GENERIC',
    salt_composition: 'Cetirizine 10mg',
    gst_percent: 5,
    barcode_gtin: '',
    min_stock_alert: 25,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_CEFIXIME_200',
    name: 'CEFIXIME 200 MG TABLET',
    hsn_code: '30042099',
    pack_size: '10*10',
    mfg_by: 'GENERIC',
    salt_composition: 'Cefixime 200mg',
    gst_percent: 12,
    barcode_gtin: '',
    min_stock_alert: 20,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_TELMISARTAN_40',
    name: 'TELMISARTAN 40 MG TABLET',
    hsn_code: '30049099',
    pack_size: '10*10',
    mfg_by: 'GENERIC',
    salt_composition: 'Telmisartan 40mg',
    gst_percent: 5,
    barcode_gtin: '',
    min_stock_alert: 20,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_DICLOFENAC_GEL',
    name: 'DICLOFENAC GEL 30GM',
    hsn_code: '30049099',
    pack_size: '30GM',
    mfg_by: 'GENERIC',
    salt_composition: 'Diclofenac Diethylamine 1.16% w/w',
    gst_percent: 12,
    barcode_gtin: '',
    min_stock_alert: 15,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_ORS_POWDER',
    name: 'ORAL REHYDRATION SALTS (ORS) 21.8 GM',
    hsn_code: '30049086',
    pack_size: '21.8GM',
    mfg_by: 'GENERIC',
    salt_composition: 'WHO Formula ORS',
    gst_percent: 5,
    barcode_gtin: '',
    min_stock_alert: 50,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
  {
    id: 'MED_POVIDONE_IODINE_100',
    name: 'POVIDONE IODINE SOLUTION 5% 100ML',
    hsn_code: '30049099',
    pack_size: '100ML',
    mfg_by: 'GENERIC',
    salt_composition: 'Povidone Iodine 5% w/v',
    gst_percent: 5,
    barcode_gtin: '',
    min_stock_alert: 20,
    default_discount_percent: 0,
    updated_at: '2026-04-01 10:00:00',
    sync_status: 'SYNCED',
  },
];

// ZERO pre-seeded batches: 100% clean stock inventory
export const SEED_BATCHES: InventoryBatch[] = [];

// ZERO pre-seeded purchases
export const SEED_PURCHASES: Purchase[] = [];
export const SEED_PURCHASE_ITEMS: PurchaseItem[] = [];

// ZERO pre-seeded sales
export const SEED_SALES: Sale[] = [];
export const SEED_SALE_ITEMS: SaleItem[] = [];

// ZERO pre-seeded ledger transactions
export const SEED_LEDGER_TRANSACTIONS: PartyLedgerTransaction[] = [];

// ZERO pre-seeded customer rate memory
export const SEED_CUSTOMER_RATES: CustomerRateMemory[] = [];
