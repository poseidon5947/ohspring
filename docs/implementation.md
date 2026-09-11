# Source mapping and implementation boundaries

All four source documents were reviewed:

- `AB_Systems_Tech_Brand_Manual_EN.docx`
- `AB_Systems_Tech_Manual_de_Marca.docx`
- `AB_Systems_Tech_Specification_Document_EN.docx`
- `AB_Systems_Tech_Documento_Solido.docx`

The Spanish specification supplies the complete public-site section omitted in the English document. The English specification supplies the explicit storage options missing in the Spanish table. The two brand manuals agree on colors, typography, logos and tone. Bogotá is stated in the Spanish brand manual. There are no supplied phone numbers, business email, business payment credentials, or approved mission/vision paragraphs.

| Area | Implementation | Boundary / remaining production setup |
| --- | --- | --- |
| Identity | Original embedded logo/icon, #DA0E12, #141414, #FFFFFF, #555555; local Montserrat Bold/ExtraBold and Open Sans Regular/SemiBold | Logo PNGs preserved without recreation; obtain original vector artwork for future print use |
| Public site | Responsive home, four services, coverage, about, mission/vision, contact, portal access | Owner should review proposed mission/vision and add verified business contact details |
| Localization | Spanish/English routes and UI messages across public site, login, portal, backoffice | Customer-entered text is preserved in its original language |
| Authentication | BCrypt, server-side session, HTTP-only cookies, CSRF, customer-only registration, role/record checks | Configure HTTPS; add account verification/recovery and deployment-level abuse limits before public scale |
| Tickets | Category, priority, four statuses, employee assignment, replies, private attachments, notifications, response/resolution timestamps | Polling every 15s instead of WebSockets; notifications are in-app, not email/SMS |
| CRM | Customer accounts, leads, opportunities, service type, interactions and ticket links | Lightweight stage pipeline; advanced automation not included in source scope |
| Projects | Customer/ticket links, assignments, tasks, due dates, Kanban, task counts, linked time | One primary assignee per project/task; progress is task completion, not weighted estimates |
| Employees | Account creation, role/CRM permission updates, position/department, workloads | Two staff roles plus per-employee CRM access; no arbitrary permission policy editor |
| Time | Attendance clock, one active entry per employee, server-calculated hours, exceptions, date filters, employee totals | Day/week/month obtained using date ranges; payroll calculations and approval workflows remain future work |
| Accounting | Income/expense entries, invoice integration, currency-separated summaries, period/service/customer filters, CSV | Basic operational ledger; no tax filing, exchange-rate conversion, statutory reporting or double-entry general ledger |
| Invoices | Customer and service/project/ticket links, amounts/currencies, due date, pending/paid/overdue, customer history | Operational invoices; no claim of Colombian electronic tax invoice certification |
| Payments | PayPal create/capture, signed Wompi checkout and verified transaction webhook; Llave instructions; Wise link; signed bank-bridge reconciliation | Provider accounts, credentials and sandbox acceptance required. Native Llave/Wise banking connectors are not supplied; an account-specific reconciliation bridge must feed verified events |
| Storage | Database attachment storage for local use; configurable private Supabase Storage adapter | Create a private bucket and configure credentials; cloud adapter is not live-tested without an account |
| Deployment | Dockerfiles, Compose, PostgreSQL volume, Flyway migrations, same-origin API proxy | Hosting/domain/TLS, backups, monitoring and live deployment require account configuration |

## Architecture

The Next.js frontend calls a same-origin `/api` proxy. Spring Security authenticates the session and enforces CSRF for browser mutations. The API resolves the account from the database for each request so role changes take effect immediately. `PlatformService` implements module workflows and record visibility using `RecordStore` and `AccountDirectory` ports. JDBC and private storage are adapters.

Module records share a relational envelope with owner/assignee foreign keys and indexed module/owner/assignee columns. Module-specific payloads are validated in the application layer. JSON payloads are stored as text for compatibility with PostgreSQL and the H2 local/test profile. Sensitive record writes are transactional. Invoice and attendance workflows lock their record/account rows to prevent duplicate financial entries or simultaneous clock-ins. Payment references are unique. There are no destructive record deletion endpoints.

Sessions are currently in memory per API instance. Run one backend instance initially; add shared Spring Session storage before horizontal scaling. The current list endpoints load each module's records before applying visibility; server-side pagination/query filtering is a next step for large datasets. This is an initial operational implementation, not a completed load-tested production platform.

## Attachments

PDF, PNG, JPEG and text uploads are limited to 5 MB. Each list/download/upload checks access to the ticket. Downloads use attachment disposition and `application/octet-stream`, so uploaded content is not rendered as an application page. For Supabase, the service key stays on the backend, and the bucket must be private. Add malware scanning if untrusted file volume warrants it.

## Source references used for integrations

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Spring Boot requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [PayPal Orders integration](https://developer.paypal.com/api/rest/integration/orders-api)
- [Wompi checkout](https://docs.wompi.co/docs/colombia/widget-checkout-web/) and [event verification](https://docs.wompi.co/docs/colombia/eventos/)
- [Wise account/API capabilities](https://docs.wise.com/guides/developer)
- [Supabase private storage access](https://supabase.com/docs/guides/storage/security/access-control)

## Validation performed

The production frontend build and TypeScript check were run locally. Backend integration tests were run against both H2 and an isolated PostgreSQL 17 instance; the final PostgreSQL run also covers rejected client-injected system fields. Browser tests exercise real API calls for English/Spanish navigation and mobile layout, registration, ticket creation and attachment upload, staff reply, project/task Kanban, verified invoice payment and accounting/customer history, contact-to-CRM flow, employee CRM permissions and attendance. Desktop/mobile screenshots were inspected.

Live PayPal/Wompi transactions, the account-specific bank bridge, private Supabase storage and cloud deployment were not exercised because no service accounts or credentials were supplied.

## Owner-requested visual override

The owner subsequently requested retaining the original portfolio’s golden animated style. The interface now uses the original black/burlywood palette, drifting original cloud texture, floating stars, shooting stars, glowing hero text and hover motion. The supplied AB logo artwork is preserved in its original colors on white. Reduced-motion preferences disable decorative motion, and the canvas pauses when the tab is hidden. This explicitly supersedes the manuals’ red/white interface palette.
