# Payment and storage configuration

No provider credentials are committed. Empty settings leave the method unavailable, with a translated message in the portal. All live payment testing must use the company's own accounts and explicit sandbox/live settings.

## PayPal

Configure `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PUBLIC_URL`, and `PAYPAL_LIVE` (false for sandbox). The adapter creates Orders v2 CAPTURE orders for USD/EUR/GBP invoices and saves the order-to-invoice mapping. The buyer is redirected to PayPal. On return, the portal posts a CSRF-protected capture request. The backend retrieves/captures the known order, checks completed status, invoice ID, currency and amount, and transactionally settles the invoice and records income.

A failed browser return does not mark an invoice paid. If a capture succeeded but local persistence failed, retrying capture reads the completed order before reconciling. The invoice row is locked during capture to prevent a second captured order on an already-paid invoice. PayPal sandbox end-to-end validation still requires credentials.

## PSE through Wompi

Configure `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_LIVE` and `PUBLIC_URL`. Use matching sandbox or production credentials. Register the HTTPS webhook at `/api/webhooks/wompi` in the merchant dashboard.

COP invoices create a Wompi hosted checkout URL signed on the server with the invoice amount, currency and unique reference. The hosted checkout offers the merchant's configured payment methods, including PSE; the integration does not collect bank credentials. The webhook verifies Wompi's checksum and independently retrieves the transaction from Wompi. Only an approved transaction matching the saved invoice reference, amount and currency is settled. Browser redirect parameters never confirm a payment. Duplicate notifications do not duplicate income.

## Llave

Configure `LLAVE_KEY` and `LLAVE_BENEFICIARY` with the company's verified payment details. The portal displays the key and invoice reference. A displayed key is a payment instruction, not a payment confirmation. The administrator can record receipt with the bank reference, or the bank reconciliation bridge described below can confirm it automatically.

## Wise Business

Configure `WISE_PAYMENT_URL` with the company's own `https://wise.com/…` business payment link. The portal opens that link. Account eligibility and receiving/currency capabilities depend on the business's Wise account; the application does not promise universal checkout/API capabilities. Automated reconciliation requires an account-specific bridge or verified manual settlement. A Wise link does not itself confirm receipt.

## Bank reconciliation bridge (Llave / Wise)

`POST /api/webhooks/bank` is a platform integration boundary, **not a native Wise or Bancolombia webhook endpoint**. A trusted server-side bridge must authenticate the bank/provider's events or retrieve verified statements, match the invoice, then send this event:

```json
{"provider":"llave","reference":"bank-unique-reference","status":"completed","invoiceId":"invoice-uuid","amount":"100000.00","currency":"COP"}
```

`provider` must be `llave` or `wise`. Configure `BANK_WEBHOOK_SECRET` with at least 32 random characters on both the bridge and backend. Headers:

- `X-AB-Timestamp`: current Unix timestamp in seconds.
- `X-AB-Signature`: lowercase hex HMAC-SHA256 of `timestamp + "." + exactRawBody`, using the shared secret.

The backend rejects events more than five minutes old, invalid signatures, wrong currency/amount, unknown invoices and unsupported providers/statuses. Payment references are unique and settlement is idempotent. The bridge itself cannot be implemented or validated against a merchant account until that account's receiving APIs/events and credentials are available. Manual verified settlement is available meanwhile.

## Private attachments

For local development, attachments are stored in the application's database. For cloud storage, create a **private** Supabase bucket and configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_STORAGE_BUCKET`. The backend uploads under a ticket/attachment UUID path; the client never receives a service key or public object URL. All download requests pass through ticket authorization. Existing database-backed attachments remain readable when cloud storage is enabled.

## Production acceptance still required

- Validate each configured payment method in its provider sandbox and verify event delivery, cancellation, delayed/repeated notifications, and currency restrictions.
- Provision the Llave/Wise reconciliation bridge if automatic confirmation is required for those methods.
- Validate private storage upload/download and backup/retention with the actual storage account.
- Configure HTTPS, real company contact information, hosting, backups, monitoring and deployment-level abuse limits.

The accounting module is a basic operational ledger. No electronic tax invoicing, payroll, currency conversion or statutory accounting certification is implied.
