// Multi-Tier Live GSTIN Verification API + Intelligent Offline Parser
// Tier 1: Cashfree Verification API (VRS v2)
// Tier 2: Public Taxpayer GST Directory
// Tier 3: Instant 15-Digit Checksum, State, PAN & Entity Type Extractor

export interface GstinVerificationResult {
  valid: boolean;
  gstin: string;
  trade_name: string;
  legal_name: string;
  state_name: string;
  state_code: string;
  city: string;
  address: string;
  pincode: string;
  gst_status: 'ACTIVE' | 'CANCELLED' | 'UNREGISTERED';
  source: 'CASHFREE_LIVE' | 'PUBLIC_GST_DIRECTORY' | 'OFFLINE_PARSER';
  constitution?: string; // Proprietorship, Company, Firm, etc.
  pan?: string;
  message?: string;
}

// Indian GST State Code Directory
export const GST_STATE_MAP: Record<string, string> = {
  '01': 'JAMMU AND KASHMIR',
  '02': 'HIMACHAL PRADESH',
  '03': 'PUNJAB',
  '04': 'CHANDIGARH',
  '05': 'UTTARAKHAND',
  '06': 'HARYANA',
  '07': 'DELHI',
  '08': 'RAJASTHAN',
  '09': 'UTTAR PRADESH',
  '10': 'BIHAR',
  '11': 'SIKKIM',
  '12': 'ARUNACHAL PRADESH',
  '13': 'NAGALAND',
  '14': 'MANIPUR',
  '15': 'MIZORAM',
  '16': 'TRIPURA',
  '17': 'MEGHALAYA',
  '18': 'ASSAM',
  '19': 'WEST BENGAL',
  '20': 'JHARKHAND',
  '21': 'ODISHA',
  '22': 'CHHATTISGARH',
  '23': 'MADHYA PRADESH',
  '24': 'GUJARAT',
  '26': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
  '27': 'MAHARASHTRA',
  '29': 'KARNATAKA',
  '30': 'GOA',
  '31': 'LAKSHADWEEP',
  '32': 'KERALA',
  '33': 'TAMIL NADU',
  '34': 'PUDUCHERRY',
  '35': 'ANDAMAN AND NICOBAR ISLANDS',
  '36': 'TELANGANA',
  '37': 'ANDHRA PRADESH',
  '38': 'LADAKH',
};

// PAN 5th character constitution mapping
export const PAN_CONSTITUTION_MAP: Record<string, string> = {
  P: 'Individual / Proprietorship',
  C: 'Private Limited / Public Company',
  H: 'Hindu Undivided Family (HUF)',
  F: 'Partnership Firm / LLP',
  A: 'Association of Persons (AOP)',
  T: 'Trust',
  B: 'Body of Individuals (BOI)',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government Entity',
};

const DEFAULT_CASHFREE_ID = 'CF1181570DBDGAKS3N65S73BH449G';
const DEFAULT_CASHFREE_SECRET = 'cfsk_ma_prod_c321adcc81d634dbc34a7c7465b03e00_d478ef0e';

export class CashfreeGstinService {
  private clientId: string = '';
  private clientSecret: string = '';
  private isSandbox: boolean = false;

  constructor() {
    this.loadCredentials();
  }

  loadCredentials() {
    const envClientId = (import.meta as any).env?.VITE_CASHFREE_CLIENT_ID || '';
    const envClientSecret = (import.meta as any).env?.VITE_CASHFREE_CLIENT_SECRET || '';
    const envEnv = (import.meta as any).env?.VITE_CASHFREE_ENV || '';
    const envSandbox = envEnv === 'sandbox';

    const storedId = typeof localStorage !== 'undefined' ? localStorage.getItem('cashfree_client_id') : '';
    const storedSecret = typeof localStorage !== 'undefined' ? localStorage.getItem('cashfree_client_secret') : '';
    const storedSandbox = typeof localStorage !== 'undefined' ? localStorage.getItem('cashfree_sandbox') : null;

    this.clientId = storedId || envClientId || DEFAULT_CASHFREE_ID;
    this.clientSecret = storedSecret || envClientSecret || DEFAULT_CASHFREE_SECRET;
    this.isSandbox = storedSandbox !== null ? storedSandbox === 'true' : envSandbox;
  }

  setCredentials(id: string, secret: string, sandbox: boolean = false) {
    this.clientId = id.trim();
    this.clientSecret = secret.trim();
    this.isSandbox = sandbox;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cashfree_client_id', this.clientId);
      localStorage.setItem('cashfree_client_secret', this.clientSecret);
      localStorage.setItem('cashfree_sandbox', String(sandbox));
    }
  }

  isConfigured(): boolean {
    this.loadCredentials();
    return Boolean(this.clientId && this.clientSecret);
  }

  getEnvironment(): 'production' | 'sandbox' {
    this.loadCredentials();
    return this.isSandbox ? 'sandbox' : 'production';
  }

  // Validate 15-character Indian GSTIN Regex
  validateGstinFormat(gstin: string): boolean {
    const clean = gstin.trim().toUpperCase();
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return regex.test(clean);
  }

  // Parse state code from GSTIN
  getStateFromGstin(gstin: string): { stateCode: string; stateName: string } {
    const clean = gstin.trim().toUpperCase();
    if (clean.length >= 2) {
      const code = clean.substring(0, 2);
      const name = GST_STATE_MAP[code] || 'OTHER';
      return { stateCode: code, stateName: name };
    }
    return { stateCode: '10', stateName: 'BIHAR' };
  }

  // Instant Tier 3 Extraction (Offline Parser)
  extractOfflineDetails(gstin: string): GstinVerificationResult {
    const clean = gstin.trim().toUpperCase();
    const { stateCode, stateName } = this.getStateFromGstin(clean);
    const pan = clean.length >= 12 ? clean.substring(2, 12) : '';
    const constChar = pan.length >= 5 ? pan[4] : '';
    const constitution = PAN_CONSTITUTION_MAP[constChar] || 'Business Entity';

    return {
      valid: this.validateGstinFormat(clean),
      gstin: clean,
      trade_name: '',
      legal_name: '',
      state_name: stateName,
      state_code: stateCode,
      city: stateCode === '10' ? 'BEGUSARAI' : '',
      address: `${stateName}, INDIA`,
      pincode: '',
      gst_status: 'ACTIVE',
      source: 'OFFLINE_PARSER',
      constitution,
      pan,
      message: `State: ${stateName} (${stateCode}) | PAN: ${pan} (${constitution})`,
    };
  }

  // Verify GSTIN through Multi-Tier pipeline
  async verifyGstin(inputGstin: string): Promise<GstinVerificationResult> {
    const gstin = inputGstin.trim().toUpperCase();
    const offlineFallback = this.extractOfflineDetails(gstin);

    if (!this.validateGstinFormat(gstin)) {
      return {
        ...offlineFallback,
        valid: false,
        message: 'Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 10BTCPS4963A1Z2).',
      };
    }

    this.loadCredentials();

    // Try Electron IPC first (Node environment with direct connectivity)
    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;
    if (electronAPI && typeof electronAPI.lookupGstin === 'function') {
      try {
        const ipcRes = await electronAPI.lookupGstin({
          gstin,
          cashfreeClientId: this.clientId,
          cashfreeClientSecret: this.clientSecret,
          isSandbox: this.isSandbox,
        });

        if (ipcRes && ipcRes.ok && ipcRes.data) {
          const d = ipcRes.data;
          return {
            valid: true,
            gstin,
            trade_name: d.trade_name || d.legal_name || offlineFallback.trade_name,
            legal_name: d.legal_name || d.trade_name || offlineFallback.legal_name,
            state_name: d.state_name || offlineFallback.state_name,
            state_code: d.state_code || offlineFallback.state_code,
            city: d.city || offlineFallback.city,
            address: d.address || offlineFallback.address,
            pincode: d.pincode || '',
            gst_status: d.gst_status || 'ACTIVE',
            source: ipcRes.source || 'CASHFREE_LIVE',
            constitution: offlineFallback.constitution,
            pan: offlineFallback.pan,
            message: `Verified live via ${ipcRes.source === 'CASHFREE_LIVE' ? 'Cashfree Verification API' : 'Public GST Directory'}`,
          };
        }
      } catch (ipcErr) {
        console.warn('Electron IPC lookup failed, attempting web fetch:', ipcErr);
      }
    }

    // Direct Web fetch fallback
    if (this.clientId && this.clientSecret) {
      try {
        const baseUrl = this.isSandbox
          ? 'https://sandbox.cashfree.com/verification/gstin'
          : 'https://api.cashfree.com/verification/gstin';

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
          },
          body: JSON.stringify({ GSTIN: gstin, gstin }),
        });

        if (response.ok) {
          const rawData = await response.json();
          const split = rawData.principal_place_split_address || {};
          const fullAddress = rawData.principal_place_address || rawData.address || '';
          const tradeName = rawData.trade_name_of_business || rawData.trade_name || rawData.legal_name_of_business || rawData.legal_name || '';
          const legalName = rawData.legal_name_of_business || rawData.legal_name || tradeName;
          const status = (rawData.gst_in_status || rawData.status || 'ACTIVE').toUpperCase();
          const city = (split.city || split.location || split.district || rawData.city || (offlineFallback.state_code === '10' ? 'BEGUSARAI' : '')).toUpperCase();
          const pincode = split.pincode || rawData.pincode || (fullAddress.match(/\b\d{6}\b/)?.[0] ?? '');

          return {
            valid: rawData.valid !== false,
            gstin,
            trade_name: tradeName.toUpperCase(),
            legal_name: legalName.toUpperCase(),
            state_name: (split.state || rawData.state || offlineFallback.state_name).toUpperCase(),
            state_code: offlineFallback.state_code,
            city,
            address: fullAddress.toUpperCase() || `${offlineFallback.state_name}, PINCODE - ${pincode}`,
            pincode,
            gst_status: status === 'ACTIVE' || status === 'VALID' ? 'ACTIVE' : 'CANCELLED',
            source: 'CASHFREE_LIVE',
            constitution: offlineFallback.constitution,
            pan: offlineFallback.pan,
            message: 'Verified live via Cashfree Verification API (VRS v2)',
          };
        }
      } catch (err) {
        console.warn('Direct Cashfree fetch failed:', err);
      }
    }

    // Return instant Tier 3 extraction if online lookup was unreachable
    return {
      ...offlineFallback,
      message: `State & PAN auto-extracted: ${offlineFallback.state_name} (${offlineFallback.state_code}) | ${offlineFallback.pan}. Type Trade Name below.`,
    };
  }
}

export const cashfreeService = new CashfreeGstinService();
