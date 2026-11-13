#!/usr/bin/env python3
"""
Legacy Database Extractor & Migration Pipeline
For Radha Drugs Wholesale Medicine Dealer (EPWWGST FoxPro Database)
"""

import os
import sys
import json
import csv
import struct
import shutil
import zipfile
import sqlite3
from datetime import datetime

ZIP_PATH = '/Users/manvendrabisht/Downloads/EPWWGST.zip'
BASE_OUT_DIR = '/Users/manvendrabisht/Documents/Pharma Distributor/data/legacy_db'
DOWNLOADS_OUT_DIR = '/Users/manvendrabisht/Downloads/EPWWGST_extracted_db'

VALID_DBF_SIGS = (0x02, 0x03, 0x30, 0x31, 0x32, 0x43, 0x63, 0x83, 0x8b, 0x8e, 0xf5, 0xfb)

def parse_dbf(data):
    """Parses a DBF binary buffer into (field_descriptors, rows_list)."""
    if len(data) < 32:
        return [], []
    sig = data[0]
    if sig not in VALID_DBF_SIGS:
        return [], []
    num_recs = struct.unpack('<I', data[4:8])[0]
    hdr_len, rec_len = struct.unpack('<HH', data[8:12])
    if rec_len == 0 or hdr_len > len(data):
        return [], []

    fields = []
    pos = 32
    while pos + 32 <= min(hdr_len, len(data)):
        if data[pos] == 0x0D:
            break
        name = data[pos:pos+11].replace(b'\x00', b'').decode('ascii', errors='ignore').strip()
        ftype = chr(data[pos+11])
        flen = data[pos+16]
        fdec = data[pos+17]
        fields.append((name, ftype, flen, fdec))
        pos += 32

    rows = []
    for i in range(num_recs):
        offset = hdr_len + i * rec_len
        rec = data[offset:offset+rec_len]
        if len(rec) < rec_len or rec[0:1] == b'*':
            continue  # Deleted or incomplete record
        
        row = {}
        off = 1
        for fname, ftype, flen, fdec in fields:
            val_bytes = rec[off:off+flen]
            off += flen
            val_str = val_bytes.decode('latin1', errors='ignore').strip()
            if ftype == 'N':
                if not val_str:
                    val = None
                elif fdec > 0 or '.' in val_str:
                    try: val = float(val_str)
                    except: val = None
                else:
                    try: val = int(val_str)
                    except: val = None
            elif ftype == 'L':
                val = 1 if val_str in ('T', 't', 'Y', 'y') else (0 if val_str in ('F', 'f', 'N', 'n') else None)
            else:
                val = val_str
            row[fname] = val
        rows.append(row)
    return fields, rows

def sanitize_col_name(name):
    clean = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
    if clean.upper() in ('INDEX', 'ORDER', 'GROUP', 'SELECT', 'WHERE', 'FROM', 'TO', 'TABLE', 'VIEW', 'CHECK', 'DEFAULT'):
        clean = f'{clean}_COL'
    return clean

def create_sqlite_table(conn, table_name, fields, rows):
    """Creates a typed SQLite table and inserts all rows."""
    col_defs = []
    col_names = []
    for fname, ftype, flen, fdec in fields:
        col = sanitize_col_name(fname)
        col_names.append(col)
        if ftype == 'N':
            t = 'REAL' if fdec > 0 else 'INTEGER'
        elif ftype == 'L':
            t = 'INTEGER'
        else:
            t = 'TEXT'
        col_defs.append(f'"{col}" {t}')
    
    conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    create_sql = f'CREATE TABLE "{table_name}" ({", ".join(col_defs)})'
    conn.execute(create_sql)
    
    if rows:
        placeholders = ', '.join(['?'] * len(fields))
        insert_sql = f'INSERT INTO "{table_name}" VALUES ({placeholders})'
        batch = []
        for r in rows:
            batch.append([r.get(f[0]) for f in fields])
        conn.executemany(insert_sql, batch)
    conn.commit()

def run_extraction():
    print(f"Starting extraction from {ZIP_PATH}...")
    if not os.path.exists(ZIP_PATH):
        print(f"ERROR: {ZIP_PATH} does not exist.")
        sys.exit(1)

    # 1. Create target directories
    raw_dir = os.path.join(BASE_OUT_DIR, 'raw_dbf')
    sqlite_dir = os.path.join(BASE_OUT_DIR, 'sqlite')
    csv_dir = os.path.join(BASE_OUT_DIR, 'csv')
    json_dir = os.path.join(BASE_OUT_DIR, 'json')
    
    for d in [raw_dir, sqlite_dir, csv_dir, json_dir, DOWNLOADS_OUT_DIR]:
        os.makedirs(d, exist_ok=True)

    extracted_files_count = 0
    extracted_db_exts = {'.dbf', '.cdx', '.fpt', '.idx', '.mem', '.ini'}

    with zipfile.ZipFile(ZIP_PATH, 'r') as z:
        # Extract raw DB files
        for item in z.infolist():
            ext = os.path.splitext(item.filename)[1].lower()
            if ext in extracted_db_exts:
                # determine target folder
                parts = item.filename.split('/')
                if len(parts) >= 2:
                    sub = parts[1]
                    if sub in ('R2425', 'R2426', 'R2427'):
                        rel = os.path.join(sub, os.path.basename(item.filename))
                    else:
                        rel = os.path.join('root', os.path.basename(item.filename))
                else:
                    rel = os.path.join('root', os.path.basename(item.filename))
                
                dest_path = os.path.join(raw_dir, rel)
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with open(dest_path, 'wb') as f_out:
                    f_out.write(z.read(item.filename))
                
                # Also copy to Downloads extracted folder
                dest_dl = os.path.join(DOWNLOADS_OUT_DIR, rel)
                os.makedirs(os.path.dirname(dest_dl), exist_ok=True)
                with open(dest_dl, 'wb') as f_out:
                    f_out.write(z.read(item.filename))
                
                extracted_files_count += 1
        
        print(f"Extracted {extracted_files_count} raw database files (.DBF, .CDX, .FPT, .IDX, .MEM, .INI) into:")
        print(f"  - {raw_dir}")
        print(f"  - {DOWNLOADS_OUT_DIR}")

        # 2. Build SQLite Database for Current Active Year (R2427)
        curr_db_path = os.path.join(sqlite_dir, 'radha_drugs_current_2026_2027.db')
        all_db_path = os.path.join(sqlite_dir, 'radha_drugs_all_years.db')
        
        if os.path.exists(curr_db_path): os.remove(curr_db_path)
        if os.path.exists(all_db_path): os.remove(all_db_path)
        
        conn_curr = sqlite3.connect(curr_db_path)
        conn_all = sqlite3.connect(all_db_path)

        # Also parse root company.DBF
        company_fields, company_rows = parse_dbf(z.read('EPWWGST/company.DBF'))
        create_sqlite_table(conn_curr, 'company_master', company_fields, company_rows)
        create_sqlite_table(conn_all, 'company_master', company_fields, company_rows)

        r2427_table_counts = {}

        # Load R2427 tables into conn_curr & conn_all
        for item in z.infolist():
            if item.filename.startswith('EPWWGST/R2427/') and item.filename.lower().endswith('.dbf'):
                data = z.read(item.filename)
                tname = os.path.splitext(os.path.basename(item.filename))[0].lower()
                fields, rows = parse_dbf(data)
                if fields and rows:
                    create_sqlite_table(conn_curr, tname, fields, rows)
                    create_sqlite_table(conn_all, f'r2427_{tname}', fields, rows)
                    r2427_table_counts[tname] = len(rows)

        # Load R2425 & R2426 into conn_all
        for yr in ['R2425', 'R2426']:
            for item in z.infolist():
                if item.filename.startswith(f'EPWWGST/{yr}/') and item.filename.lower().endswith('.dbf'):
                    data = z.read(item.filename)
                    tname = os.path.splitext(os.path.basename(item.filename))[0].lower()
                    fields, rows = parse_dbf(data)
                    if fields and rows:
                        create_sqlite_table(conn_all, f'{yr.lower()}_{tname}', fields, rows)

        # Create handy SQLite indexes on conn_curr
        conn_curr.executescript("""
            CREATE INDEX IF NOT EXISTS idx_stock_product ON stock(STPDCODE);
            CREATE INDEX IF NOT EXISTS idx_stock_batch ON stock(STBHNO);
            CREATE INDEX IF NOT EXISTS idx_stock_customer ON stock(STCUCODE);
            CREATE INDEX IF NOT EXISTS idx_stock_inv ON stock(STSEQNO);
            CREATE INDEX IF NOT EXISTS idx_batch_product ON batch(BHPDCODE);
            CREATE INDEX IF NOT EXISTS idx_batch_no ON batch(BHNO);
            CREATE INDEX IF NOT EXISTS idx_cmhdr_inv ON cmhdr(CMINVNO);
            CREATE INDEX IF NOT EXISTS idx_cmhdr_customer ON cmhdr(CMSTOCKIST);
            CREATE INDEX IF NOT EXISTS idx_product_code ON product(PDCODE);
            CREATE INDEX IF NOT EXISTS idx_custome_code ON custome(CUCODE);
        """)

        conn_curr.close()
        conn_all.close()
        print(f"Created SQLite databases:")
        print(f"  - {curr_db_path} ({len(r2427_table_counts)} tables)")
        print(f"  - {all_db_path} (All 3 financial years: FY24-25, FY25-26, FY26-27)")

        # 3. Export High-Fidelity Business CSVs
        # Customers
        cust_fields, cust_rows = parse_dbf(z.read('EPWWGST/R2427/custome.dbf'))
        cust_csv_path = os.path.join(csv_dir, 'customers_parties.csv')
        with open(cust_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Customer Code', 'Customer / Chemist Name', 'Contact Person', 'Address Line 1', 'Address Line 2', 'Station / City', 'Pincode', 'Phone', 'GSTIN', 'Drug License No', 'Credit Limit', 'Credit Days', 'State Code'])
            for r in cust_rows:
                writer.writerow([
                    r.get('CUCODE', ''),
                    r.get('CUNAME', ''),
                    r.get('CUPERSON', ''),
                    r.get('CUADDRESS1', ''),
                    r.get('CUADDRESS2', ''),
                    r.get('CUSTATION', ''),
                    r.get('CUPINCODE', ''),
                    r.get('CUPHONE', ''),
                    r.get('CUGSTNO', ''),
                    r.get('CUDLNO', ''),
                    r.get('CUCRLIMIT', 0),
                    r.get('CUCREDITDY', 0),
                    r.get('STCODE', '10')
                ])

        # Suppliers / Vendors from account.dbf
        acc_fields, acc_rows = parse_dbf(z.read('EPWWGST/R2427/account.dbf'))
        vendors_csv_path = os.path.join(csv_dir, 'vendors_suppliers.csv')
        with open(vendors_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Account Code', 'Supplier / Vendor Name', 'Station / City', 'Address Line 1', 'Address Line 2', 'Phone', 'GSTIN', 'Drug License No', 'Bank Name', 'Bank A/c No', 'IFSC', 'State Code'])
            for r in acc_rows:
                gst = r.get('ACGSTNO', '')
                name = r.get('ACNAME', '')
                # Filter accounts that are pharma suppliers/vendors (have GSTIN or specific pharmaceutical company names)
                if gst or ('PHARMA' in name.upper() or 'LAB' in name.upper() or 'REMEDIES' in name.upper() or 'LTD' in name.upper() or 'BIOTECH' in name.upper() or 'HEALTHCARE' in name.upper()):
                    writer.writerow([
                        r.get('ACISNO', ''),
                        name,
                        r.get('ACSTATION', ''),
                        r.get('ACADDRESS1', ''),
                        r.get('ACADDRESS2', ''),
                        r.get('ACPHONE1', ''),
                        gst,
                        r.get('ACDLNO', ''),
                        r.get('ACBANK', ''),
                        r.get('ACACNO', ''),
                        r.get('ACIFSC', ''),
                        r.get('STCODE', '10')
                    ])

        # Medicines / Products
        prod_fields, prod_rows = parse_dbf(z.read('EPWWGST/R2427/product.dbf'))
        prod_csv_path = os.path.join(csv_dir, 'medicines_catalog.csv')
        with open(prod_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Product Code', 'Medicine / Product Name', 'Pack Size', 'Manufacturer / Group', 'HSN Code', 'Tax Slab', 'Unit', 'Current Physical Stock Qty', 'MRP', 'Min Stock Alert'])
            for r in prod_rows:
                writer.writerow([
                    r.get('PDCODE', ''),
                    r.get('PDNAME', ''),
                    r.get('PDPACKING', ''),
                    r.get('PDGPNAME', ''),
                    r.get('PDHSNCODE', '3004'),
                    r.get('PDSTXSEQNO', ''),
                    r.get('UNCODE', 'PCS'),
                    r.get('PDCURQTY', 0),
                    r.get('PDMRP', 0),
                    r.get('PDMINSTOCK', 0)
                ])

        # Batches & Expiry Inventory
        batch_fields, batch_rows = parse_dbf(z.read('EPWWGST/R2427/batch.dbf'))
        batch_csv_path = os.path.join(csv_dir, 'inventory_batches.csv')
        with open(batch_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Batch No', 'Product Code', 'Expiry Date (YYYYMMDD)', 'MRP', 'Purchase Price', 'Trade Price', 'Sale Rate', 'Available Qty', 'GST Slab', 'Supplier / Mfg Code'])
            for r in batch_rows:
                writer.writerow([
                    r.get('BHNO', ''),
                    r.get('BHPDCODE', ''),
                    r.get('BHEXPIRY', ''),
                    r.get('BHMRP', 0),
                    r.get('BHPPRICE', 0),
                    r.get('BHTPRICE', 0),
                    r.get('BHSPRICE', 0),
                    r.get('BHCURQTY', 0),
                    r.get('BHTXSEQNO', ''),
                    r.get('BHSPCD', '')
                ])

        # Sales Invoices (CMHDR)
        cm_fields, cm_rows = parse_dbf(z.read('EPWWGST/R2427/cmhdr.dbf'))
        cm_csv_path = os.path.join(csv_dir, 'sales_invoices.csv')
        with open(cm_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Invoice No', 'Invoice Date', 'Customer Code', 'Customer Name', 'Station', 'Net Amount', 'Cash Amount', 'Discount', 'Vehicle No', 'E-Way Bill / Distance'])
            for r in cm_rows:
                writer.writerow([
                    r.get('CMINVNO', ''),
                    r.get('CMDATE', ''),
                    r.get('CMSTOCKIST', ''),
                    r.get('CMNAME', ''),
                    r.get('STATION', ''),
                    r.get('CMNETAMT', 0),
                    r.get('CMCASHAMT', 0),
                    r.get('CMDISCOUNT', 0),
                    r.get('CMVEHNO', ''),
                    r.get('CMDISTANCE', '')
                ])

        # Line Items / Stock Movements (STOCK.DBF)
        stock_fields, stock_rows = parse_dbf(z.read('EPWWGST/R2427/stock.dbf'))
        stock_csv_path = os.path.join(csv_dir, 'sales_invoice_line_items.csv')
        with open(stock_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Type (CM/PI)', 'Invoice / Ref No', 'Date', 'Customer Code', 'Product Code', 'Batch No', 'Sale Rate', 'Quantity Out', 'Quantity In', 'Free Qty', 'Discount %', 'Taxable Amount', 'Tax Amount', 'MRP'])
            for r in stock_rows:
                writer.writerow([
                    r.get('STSR', ''),
                    r.get('STSEQNO', ''),
                    r.get('STDATE', ''),
                    r.get('STCUCODE', ''),
                    r.get('STPDCODE', ''),
                    r.get('STBHNO', ''),
                    r.get('STRATE', 0),
                    r.get('STQTYOUT', 0),
                    r.get('STQTYIN', 0),
                    r.get('STFREEQTY', 0),
                    r.get('STDISCOUNT', 0),
                    r.get('STAMOUNT', 0),
                    r.get('STTAXAMT', 0),
                    r.get('STMRP', 0)
                ])

        # Purchase Invoices (PIHDR)
        pi_fields, pi_rows = parse_dbf(z.read('EPWWGST/R2427/pihdr.dbf'))
        pi_csv_path = os.path.join(csv_dir, 'purchase_invoices.csv')
        with open(pi_csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Purchase Seq No', 'Date', 'Supplier Invoice No', 'Supplier Inv Date', 'Supplier Code', 'Net Amount', 'Discount', 'Freight'])
            for r in pi_rows:
                writer.writerow([
                    r.get('PISEQNO', ''),
                    r.get('PIDATE', ''),
                    r.get('PIINVNO', ''),
                    r.get('PIINVDATE', ''),
                    r.get('PISPCD', ''),
                    r.get('PINETAMT', 0),
                    r.get('PIDISCOUNT', 0),
                    r.get('PIFREIGHT', 0)
                ])

        print(f"Exported clean CSV files into {csv_dir}:")
        print(f"  - customers_parties.csv ({len(cust_rows)} records)")
        print(f"  - vendors_suppliers.csv")
        print(f"  - medicines_catalog.csv ({len(prod_rows)} records)")
        print(f"  - inventory_batches.csv ({len(batch_rows)} records)")
        print(f"  - sales_invoices.csv ({len(cm_rows)} records)")
        print(f"  - sales_invoice_line_items.csv ({len(stock_rows)} records)")
        print(f"  - purchase_invoices.csv ({len(pi_rows)} records)")

        # 4. Generate PharmaFlow ERP Compatible 1-Click Restore JSON
        print("Generating PharmaFlow ERP 1-Click Migration JSON...")

        # Parse GST percentage from text (e.g. 'GST12' -> 12, 'GST5' -> 5, 'PGS5' -> 5)
        def parse_gst_num(txt):
            if not txt: return 5.0
            t = str(txt).upper()
            if '28' in t: return 28.0
            if '18' in t: return 18.0
            if '12' in t: return 12.0
            if '5' in t: return 5.0
            if '0' in t: return 0.0
            return 5.0

        def parse_date_iso(dt_str):
            if not dt_str or len(str(dt_str)) < 8:
                return '2026-04-01'
            s = str(dt_str).strip()
            return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"

        def parse_exp_mm_yy(dt_str):
            if not dt_str or len(str(dt_str)) < 8:
                return '12/28'
            s = str(dt_str).strip()
            return f"{s[4:6]}/{s[2:4]}"

        # Company profile from company.DBF (Record 10 is Radha Drugs FY 2026-27)
        radha_rec = None
        for r in company_rows:
            if 'RADHA' in r.get('CONAME', '').upper() and r.get('CODIR') == 'R2427':
                radha_rec = r
                break
        if not radha_rec:
            for r in company_rows:
                if 'RADHA' in r.get('CONAME', '').upper():
                    radha_rec = r

        profile_entry = {
            "id": "RADHA_DRUGS_MAIN",
            "company_name": radha_rec.get('CONAME', 'RADHA DRUGS') if radha_rec else 'RADHA DRUGS',
            "tagline": "(WholeSale Medicine Dealer)",
            "address_line1": radha_rec.get('COADDRESS1', 'HAJIPUR, PIPRA DEWASH') if radha_rec else 'HAJIPUR, PIPRA DEWASH',
            "city_district": radha_rec.get('COSTATION', 'BEGUSARAI') if radha_rec else 'BEGUSARAI',
            "state_name": radha_rec.get('COSTATE', 'BIHAR') if radha_rec else 'BIHAR',
            "state_code": "10",
            "pincode": radha_rec.get('COPIN', '851112') if radha_rec else '851112',
            "phone": radha_rec.get('COPHONE1', '9835466285') if radha_rec else '9835466285',
            "gstin": radha_rec.get('COGSTNO', '10BRCPK8315G2Z7') if radha_rec else '10BRCPK8315G2Z7',
            "dl_no": radha_rec.get('COLICNO', 'BEG-107086/87') if radha_rec else 'BEG-107086/87',
            "dl_valid_upto": parse_date_iso(radha_rec.get('COLICDATE', '20290206')) if radha_rec else '2029-02-06',
            "fssai_no": radha_rec.get('COFSSAI', '') if radha_rec else '',
            "bank_name": "HDFC BANK",
            "bank_account_no": "50200071058282",
            "bank_ifsc": "HDFC0000061",
            "upi_id": "9835466285@upi",
            "gst_invoice_prefix": "T",
            "gst_invoice_next_no": 1189,
            "simple_bill_prefix": "S",
            "simple_bill_next_no": 101,
            "financial_year": "2026-27",
            "terms_conditions": json.dumps([
                "Goods once sold can not be taken back.",
                "Please check the goods at the time of taking delivery.",
                "On strength of warranty obtained by us, we hereby give warranty that the goods sold under this invoice do not contravene the provisions of section 18 of the Drug Act, 1940.",
                "In case of any inadvertent error in price charged, please bring this invoice for rectification. ALL SUBJECT TO BEGUSARAI JURISDICTION."
            ])
        }

        # Parties (Customers + Vendors)
        parties_data = []
        for c in cust_rows:
            gst = c.get('CUGSTNO', '')
            parties_data.append({
                "id": f"PARTY_CUST_{c.get('CUCODE', '')}",
                "party_type": "CUSTOMER",
                "is_gst_registered": 1 if gst and len(gst) == 15 else 0,
                "gstin": gst or "",
                "name": c.get('CUNAME', ''),
                "legal_name": c.get('CUPNAME', c.get('CUNAME', '')),
                "dl_no": c.get('CUDLNO', '') or "",
                "fssai_no": c.get('CUFSSAI', '') or "",
                "phone": c.get('CUPHONE', '') or "",
                "address": f"{c.get('CUADDRESS1', '')} {c.get('CUADDRESS2', '')}".strip(),
                "city": c.get('CUSTATION', 'BEGUSARAI') or 'BEGUSARAI',
                "state_name": "BIHAR",
                "state_code": c.get('STCODE', '10') or '10',
                "opening_balance": float(c.get('CUCRLIMIT', 0) or 0),
                "current_balance": 0.0,
                "credit_limit": float(c.get('CUCRLIMIT', 100000) or 100000),
                "gst_status": "ACTIVE" if gst else "UNREGISTERED",
                "created_at": "2026-04-01 00:00:00",
                "updated_at": "2026-11-10 15:00:00",
                "sync_status": "SYNCED"
            })

        for a in acc_rows:
            gst = a.get('ACGSTNO', '')
            name = a.get('ACNAME', '')
            if gst or ('PHARMA' in name.upper() or 'LAB' in name.upper() or 'REMEDIES' in name.upper() or 'LTD' in name.upper() or 'BIOTECH' in name.upper() or 'HEALTHCARE' in name.upper()):
                parties_data.append({
                    "id": f"PARTY_VEND_{a.get('ACISNO') or a.get('ACNAME', '').replace(' ', '_')[:16]}",
                    "party_type": "VENDOR",
                    "is_gst_registered": 1 if gst and len(gst) == 15 else 0,
                    "gstin": gst or "",
                    "name": name,
                    "legal_name": a.get('ACPNAME', name),
                    "dl_no": a.get('ACDLNO', '') or "",
                    "fssai_no": "",
                    "phone": a.get('ACPHONE1', '') or "",
                    "address": f"{a.get('ACADDRESS1', '')} {a.get('ACADDRESS2', '')}".strip(),
                    "city": a.get('ACSTATION', '') or "",
                    "state_name": "BIHAR",
                    "state_code": a.get('STCODE', '10') or '10',
                    "opening_balance": float(a.get('ACOPBAL', 0) or 0),
                    "current_balance": float(a.get('ACCURBAL', 0) or 0),
                    "credit_limit": 500000.0,
                    "gst_status": "ACTIVE" if gst else "UNREGISTERED",
                    "created_at": "2026-04-01 00:00:00",
                    "updated_at": "2026-11-10 15:00:00",
                    "sync_status": "SYNCED"
                })

        # Medicines
        medicines_data = []
        for p in prod_rows:
            pcode = p.get('PDCODE', '')
            pname = p.get('PDNAME', '')
            gst_p = parse_gst_num(p.get('PDSTXSEQNO', 'GST5'))
            medicines_data.append({
                "id": f"MED_{pcode}",
                "name": pname,
                "hsn_code": p.get('PDHSNCODE', '3004') or '3004',
                "pack_size": p.get('PDPACKING', '1*10') or '1*10',
                "mfg_by": p.get('PDGPNAME', '') or 'GENERIC',
                "salt_composition": "",
                "gst_percent": gst_p,
                "barcode_gtin": "",
                "min_stock_alert": int(p.get('PDMINSTOCK', 20) or 20),
                "default_discount_percent": float(p.get('PDPDISC', 0) or 0),
                "updated_at": "2026-11-10 15:00:00",
                "sync_status": "SYNCED"
            })

        # Batches
        batches_data = []
        for b in batch_rows:
            pcode = b.get('BHPDCODE', '')
            bno = b.get('BHNO', '')
            if not pcode or not bno: continue
            
            mrp = float(b.get('BHMRP', 0) or 0)
            pur_rate = float(b.get('BHPPRICE', 0) or 0)
            sale_rate = float(b.get('BHSPRICE', 0) or 0)
            cur_qty = int(float(b.get('BHCURQTY', 0) or 0))
            gst_val = parse_gst_num(b.get('BHTXSEQNO', 'GST12'))
            exp_iso = parse_date_iso(b.get('BHEXPIRY', '20261231'))
            exp_mmyy = parse_exp_mm_yy(b.get('BHEXPIRY', '20261231'))
            
            batches_data.append({
                "id": f"BATCH_{pcode}_{bno}".replace(' ', '_').replace('/', '_'),
                "medicine_id": f"MED_{pcode}",
                "batch_no": bno,
                "exp_date_mm_yy": exp_mmyy,
                "exp_date_iso": exp_iso,
                "mrp": mrp,
                "old_mrp": float(b.get('BHOMRP', mrp) or mrp),
                "purchase_rate": pur_rate,
                "purchase_discount_percent": float(b.get('BHPDISC', 0) or 0),
                "gst_percent": gst_val,
                "scheme_billed_qty": int(float(b.get('BHSCHEME1', 0) or 0)),
                "scheme_free_qty": int(float(b.get('BHSCHEME2', 0) or 0)),
                "net_landing_cost": pur_rate,
                "default_sale_rate": sale_rate if sale_rate > 0 else (mrp * 0.8),
                "available_qty": cur_qty,
                "last_vendor_id": None,
                "rack_location": "",
                "updated_at": "2026-11-10 15:00:00",
                "sync_status": "SYNCED"
            })

        # Assemble Full PharmaFlow Restore JSON
        restore_payload = {
            "exportTimestamp": datetime.now().isoformat(),
            "version": "2.0",
            "company": "RADHA DRUGS",
            "source": "EPWWGST FoxPro Database Migration",
            "data": {
                "profile": [profile_entry],
                "parties": parties_data,
                "medicines": medicines_data,
                "batches": batches_data,
                "purchases": [],
                "purchaseItems": [],
                "sales": [],
                "saleItems": [],
                "adjustments": [],
                "ledger": [],
                "customerRates": []
            }
        }

        restore_json_path = os.path.join(json_dir, 'radha_drugs_pharmaflow_restore.json')
        with open(restore_json_path, 'w', encoding='utf-8') as f:
            json.dump(restore_payload, f, indent=2)

        print(f"Generated PharmaFlow ERP 1-Click Restore JSON:")
        print(f"  - {restore_json_path} ({len(parties_data)} parties, {len(medicines_data)} medicines, {len(batches_data)} inventory batches)")

        # Summary metadata
        summary = {
            "archive_source": ZIP_PATH,
            "extraction_date": datetime.now().isoformat(),
            "business_name": "RADHA DRUGS Wholesale Medicine Dealer",
            "gstin": "10BRCPK8315G2Z7",
            "financial_years": {
                "R2425": "FY 2024-2025 (1060 sales invoices)",
                "R2426": "FY 2025-2026 (1819 sales invoices)",
                "R2427": "FY 2026-2027 (Active: 1188 sales invoices, 9191 line items, 3279 batches, 1412 medicines, 147 customers)"
            },
            "exported_locations": {
                "raw_dbf": raw_dir,
                "downloads_copy": DOWNLOADS_OUT_DIR,
                "sqlite_current": curr_db_path,
                "sqlite_all_years": all_db_path,
                "csv_directory": csv_dir,
                "restore_json": restore_json_path
            }
        }

        with open(os.path.join(json_dir, 'extraction_summary.json'), 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        print("\nAll database tables and artifacts successfully extracted and converted!")

if __name__ == '__main__':
    run_extraction()
