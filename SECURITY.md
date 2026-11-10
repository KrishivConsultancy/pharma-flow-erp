# Security & Data Integrity Policy

## 1. Local Database & Data Sovereignty
- **Sandboxed SQLite Persistence:** All company records, customer balances, and batch transactions are held inside local SQLite databases with strict sandbox isolation.
- **Air-Gapped Operation:** The system does not transmit medical catalogs, financial statements, or customer ledgers to any unauthenticated third-party server.
- **Disaster Recovery:** Full database state can be exported into an encrypted offline JSON archive with one click.

## 2. Secrets & Credential Isolation
- **Environment Isolation:** Secrets such as `VITE_CASHFREE_CLIENT_SECRET` and `VITE_SUPABASE_ANON_KEY` are stored in `.env` or the client's local configuration store.
- **No Repository Secrets:** Plaintext credentials and access tokens are strictly prohibited from being committed to the Git repository. The `.gitignore` file enforces exclusion of all `.env` files.

## 3. GST Compliance & Non-Repudiation
- **Immutable Invoice Numbers:** Once an invoice is finalized, its sequence number cannot be altered or overwritten.
- **Audit Logging:** Every stock movement, price modification, and cash receipt is permanently logged in the double-entry ledger.

## 4. Responsible Disclosure
If you discover a security vulnerability within PharmaFlow Enterprise ERP, please report it privately to:
`security@krishivconsultancy.com`
