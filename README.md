# AB Systems Tech

Bilingual corporate website, customer portal, and internal operations application based on the four supplied AB Systems Tech brand and specification documents. The original personal portfolio has been replaced by a Next.js application and Spring Boot API.

## Run with PostgreSQL

Requirements: Docker with Docker Compose.

```sh
cp .env.example .env
# Edit .env: choose unique database and administrator passwords and your administrator email.
docker compose up --build
```

Open http://localhost:3000. Spanish is the default; `/en` provides English. The configured administrator is created once on startup. Registering through the public site always creates a customer. An administrator can create employee accounts and grant CRM access from Employees.

For a public deployment, set `PUBLIC_URL` to the HTTPS site URL and `COOKIE_SECURE=true`, terminate TLS at the hosting platform, and preserve the private PostgreSQL volume. The API and database are not exposed as public container ports. Back up PostgreSQL and the private attachment bucket. Static-only hosting, including GitHub Pages, cannot run this platform.

## Local development

Requirements: Node.js 22, Java 21, Maven 3.9+, and PostgreSQL (or the local H2 profile).

```sh
npm --prefix frontend ci
npm run dev
```

Start the API in another terminal. For a local database without PostgreSQL:

```sh
cd backend
export SPRING_PROFILES_ACTIVE=local
export ADMIN_EMAIL=admin@example.com
# Set ADMIN_PASSWORD to your own unique password, 12–72 UTF-8 bytes.
mvn spring-boot:run
```

The local profile stores data under `backend/data/` and disables secure-only cookies for localhost. It is for development. Production defaults to PostgreSQL and secure cookies. The frontend proxies `/api` to `http://127.0.0.1:8080`; set `API_URL` **at frontend build time** to change the API host.

## Included workflows

- Public website: original logo artwork, specified typography/colors, services and geographic coverage, about/mission/vision, contact requests saved as CRM leads, Spanish/English selector.
- Customer portal: registration, login/logout, own tickets and invoice history, replies, attachments, notifications, payment entry points.
- Helpdesk: staff inbox, assignment, priorities/statuses, conversation history, first response and resolution times. Data refreshes every 15 seconds and after changes.
- CRM: leads/current customer accounts, service segmentation, opportunity stages, interaction history and linked tickets.
- Projects: customer/ticket association, assignment, due dates, project/task status, Kanban, task completion counts, linked time entries.
- Employees: profiles, departments/positions, employee/admin roles, CRM permissions, workload dashboard.
- Time: clock-in/out, project/ticket links, work/late/leave/sick/overtime classifications, calculated hours, date-filtered and per-employee reports, CSV exports.
- Billing/accounting: customer invoices in COP/USD/EUR/GBP, due-date status, verified settlement, automatic income entries, manual income/expenses, currency-separated summaries, service/customer/date filters, audit records and CSV exports.

These are the operational core of all three phases. They are not a claim that every production integration or acceptance test is finished. See [implementation coverage](docs/implementation.md) and [payment setup](docs/payments.md) for exact boundaries.

## Validation

```sh
npm run build
npm run typecheck
cd backend && mvn test
```

Browser tests use a running frontend and API, an isolated test database, and an administrator account. Set `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` to that test administrator's credentials. The defaults in the test file are test-only values and are never seeded by production code.

```sh
cd frontend
CHROME_PATH=/path/to/chrome npx playwright test
```

## Layout

- `frontend/`: Next.js App Router, React, TypeScript, next-intl, local Montserrat/Open Sans fonts.
- `backend/`: Java 21 / Spring Boot; domain ports, application workflows, HTTP/JDBC/storage adapters; Flyway migrations.
- `docs/`: source mapping, integration setup, deployment boundaries.
- The supplied `.docx` files are source references. The logo and icon are unchanged PNGs extracted from the English brand manual. Old `assets/` files remain as unused historical resources; the new application does not load the portfolio scripts.

No live provider credentials or company telephone/email were supplied. The contact form uses the CRM instead of invented contact details. The mission/vision copy is proposed copy derived from the company's stated objectives.
