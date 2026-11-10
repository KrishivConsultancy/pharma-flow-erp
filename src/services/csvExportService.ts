// CSV / Excel Export Service for CA Filing & GST Returns
// Formats compliant GSTR-1, GSTR-2B, HSN-Wise Summary, Stock, and Ledger CSVs

export class CsvExportService {
  // Helper to trigger browser download of CSV string
  static downloadCsv(csvContent: string, fileName: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 1. GSTR-1 Outward Sales Register (B2B + B2CS)
  static generateGstr1Csv(sales: any[], parties: any[]): string {
    const partyMap = new Map<string, any>(parties.map(p => [p.id, p]));

    const headers = [
      'Invoice Number',
      'Invoice Date',
      'Invoice Value',
      'Place of Supply',
      'Reverse Charge',
      'Invoice Type',
      'Recipient GSTIN',
      'Recipient Name',
      'Rate (%)',
      'Taxable Value',
      'Integrated Tax Amount',
      'Central Tax Amount',
      'State/UT Tax Amount',
      'Cess Amount'
    ];

    const rows: string[] = [headers.join(',')];

    for (const s of sales) {
      const party = partyMap.get(s.customer_id) || {};
      const isB2b = party.gstin && party.gstin.length === 15;
      const pos = party.state_code ? `${party.state_code}-${party.state_name}` : '10-BIHAR';
      const invType = isB2b ? 'Regular B2B' : 'B2CS';
      const gstin = isB2b ? party.gstin : '';
      const recipientName = `"${(party.name || '').replace(/"/g, '""')}"`;

      // Rates: if 5%
      const rate = s.tax_type === 'NON_GST' ? '0' : '5';
      const taxable = s.sub_total.toFixed(2);
      const igst = s.total_igst.toFixed(2);
      const cgst = s.total_cgst.toFixed(2);
      const sgst = s.total_sgst.toFixed(2);
      const totalVal = s.net_amount.toFixed(2);

      rows.push([
        s.invoice_no,
        s.sale_date,
        totalVal,
        `"${pos}"`,
        'N',
        invType,
        gstin,
        recipientName,
        rate,
        taxable,
        igst,
        cgst,
        sgst,
        '0.00'
      ].join(','));
    }

    return rows.join('\r\n');
  }

  // 2. HSN-Wise Summary of Outward Supplies
  static generateHsnSummaryCsv(saleItems: any[]): string {
    const headers = [
      'HSN Code',
      'Description',
      'UQC',
      'Total Quantity',
      'Total Value',
      'Taxable Value',
      'Integrated Tax Amount',
      'Central Tax Amount',
      'State Tax Amount',
      'Cess Amount'
    ];

    // Group by HSN
    const map = new Map<string, {
      qty: number;
      totalVal: number;
      taxable: number;
      igst: number;
      cgst: number;
      sgst: number;
    }>();

    for (const item of saleItems) {
      const hsn = item.hsn_code || '3004';
      const existing = map.get(hsn) || { qty: 0, totalVal: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
      existing.qty += (item.qty || 0) + (item.free_qty || 0);
      existing.taxable += item.taxable_amount || 0;
      existing.totalVal += item.line_total || item.taxable_amount || 0;
      existing.igst += item.igst_amount || 0;
      existing.cgst += item.cgst_amount || 0;
      existing.sgst += item.sgst_amount || 0;
      map.set(hsn, existing);
    }

    const rows: string[] = [headers.join(',')];

    for (const [hsn, data] of map.entries()) {
      rows.push([
        hsn,
        '"MEDICAMENTS"',
        'NOS-NUMBERS',
        data.qty,
        data.totalVal.toFixed(2),
        data.taxable.toFixed(2),
        data.igst.toFixed(2),
        data.cgst.toFixed(2),
        data.sgst.toFixed(2),
        '0.00'
      ].join(','));
    }

    return rows.join('\r\n');
  }

  // 3. GSTR-2B Inward Purchase Register (Input Tax Credit)
  static generateGstr2bCsv(purchases: any[], parties: any[]): string {
    const partyMap = new Map<string, any>(parties.map(p => [p.id, p]));

    const headers = [
      'Supplier GSTIN',
      'Supplier Trade Name',
      'Invoice Number',
      'Invoice Date',
      'Invoice Value',
      'Place of Supply',
      'Supply Type',
      'Taxable Value',
      'IGST Amount',
      'CGST Amount',
      'SGST Amount',
      'ITC Eligibility'
    ];

    const rows: string[] = [headers.join(',')];

    for (const p of purchases) {
      const vendor = partyMap.get(p.vendor_id) || {};
      const pos = vendor.state_code ? `${vendor.state_code}-${vendor.state_name}` : '10-BIHAR';

      rows.push([
        vendor.gstin || '',
        `"${(vendor.name || '').replace(/"/g, '""')}"`,
        p.supplier_invoice_no,
        p.invoice_date,
        p.grand_total.toFixed(2),
        `"${pos}"`,
        p.tax_type,
        p.sub_total.toFixed(2),
        p.total_igst.toFixed(2),
        p.total_cgst.toFixed(2),
        p.total_sgst.toFixed(2),
        'Eligible'
      ].join(','));
    }

    return rows.join('\r\n');
  }

  // 4. Batch Inventory Stock Valuation CSV
  static generateStockValuationCsv(batches: any[]): string {
    const headers = [
      'Medicine Name',
      'HSN Code',
      'Pack Size',
      'Mfg By',
      'Batch No',
      'Expiry (MM/YY)',
      'Available Qty',
      'Purchase Rate',
      'Net Landing Cost',
      'Wholesale Sale Rate',
      'MRP',
      'Stock Value (At Cost)',
      'Stock Value (At MRP)',
      'Rack Location'
    ];

    const rows: string[] = [headers.join(',')];

    for (const b of batches) {
      const costVal = (b.available_qty * (b.net_landing_cost || b.purchase_rate)).toFixed(2);
      const mrpVal = (b.available_qty * b.mrp).toFixed(2);

      rows.push([
        `"${(b.medicine_name || b.name || '').replace(/"/g, '""')}"`,
        b.hsn_code || '3004',
        `"${b.pack_size || ''}"`,
        `"${b.mfg_by || ''}"`,
        b.batch_no,
        b.exp_date_mm_yy,
        b.available_qty,
        b.purchase_rate.toFixed(2),
        b.net_landing_cost.toFixed(2),
        b.default_sale_rate.toFixed(2),
        b.mrp.toFixed(2),
        costVal,
        mrpVal,
        b.rack_location || 'GEN'
      ].join(','));
    }

    return rows.join('\r\n');
  }

  // 5. Party Ledger Statement CSV
  static generatePartyLedgerCsv(party: any, transactions: any[]): string {
    const headers = [
      'Date',
      'Voucher Type',
      'Voucher No',
      'Payment Method',
      'Narration',
      'Debit (Dr) Rs.',
      'Credit (Cr) Rs.',
      'Running Balance Rs.'
    ];

    const rows: string[] = [
      `"PARTY LEDGER STATEMENT: ${(party.name || '').replace(/"/g, '""')}"`,
      `"GSTIN: ${party.gstin || 'UNREGISTERED'} | Phone: ${party.phone || ''} | Address: ${(party.address || '').replace(/"/g, '""')}"`,
      `"Generated on: ${new Date().toLocaleString('en-IN')}"`,
      '',
      headers.join(',')
    ];

    for (const t of transactions) {
      rows.push([
        t.transaction_date,
        t.voucher_type,
        t.voucher_no,
        t.payment_method || '',
        `"${(t.narration || '').replace(/"/g, '""')}"`,
        t.debit_amount > 0 ? t.debit_amount.toFixed(2) : '',
        t.credit_amount > 0 ? t.credit_amount.toFixed(2) : '',
        t.running_balance.toFixed(2)
      ].join(','));
    }

    return rows.join('\r\n');
  }
}
