<div align="center">

# 🍽️ Restaurant QR System
### Real-Time Multi-Role Dining & Kitchen Management Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Platform-ff5a1f?style=for-the-badge&logo=vercel&logoColor=white)](https://restaurant-qr-system-swart.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tests](https://img.shields.io/badge/Vitest-31%20Passed-22c55e?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)

<p align="center">
  A synchronized full-stack restaurant platform connecting <b>Customers</b>, <b>Waiters</b>, <b>Kitchen Staff</b>, <b>Cashiers</b>, and <b>Administrators</b> into one cohesive operational workflow.
</p>

</div>

---

## 🎯 Overview

In busy dining environments, delays and order mix-ups occur at the handoffs between diners, floor staff, kitchen lines, and the cash register. 

**Restaurant QR System** eliminates order bottlenecks by transforming physical dining tables into instant digital ordering terminals. Diners scan a table-specific QR code to browse the visual menu, place customized orders, and monitor preparation status in real time. Kitchen displays, waiter tablets, cashier counters, and admin dashboards synchronize dynamically to ensure seamless service.

---

## ⚡ Synchronized 4-Role Architecture

The platform provides dedicated, role-tailored interfaces backed by secure server-side authorization:

```
[ Customer Table QR ] ──▶ Places Order ──▶ [ Live Order Engine ]
                                                   │
          ┌────────────────────────────────────────┼────────────────────────────────────────┐
          ▼                                        ▼                                        ▼
  [ Waiter Dashboard ]                    [ Kitchen Display ]                     [ Cashier & Admin ]
  • Table requests                        • Real-time ticket queue                • Bill generation
  • Service notifications                 • Cooking status updates                • Settlement & Reports
  • Delivery confirmation                 • Priority management                   • Menu & Stock control
```

### 1. 📱 Customer Dining & Takeaway Experience
* **Instant Table QR Access:** No app installation required; customers scan their table QR code to start an authenticated session tied directly to their table number.
* **Smart Digital Menu:** Category filters, search, allergen tags, and real-time out-of-stock indicators.
* **Live Order Tracking:** Transparent progress indicators (`Received` ➔ `Preparing` ➔ `Ready` ➔ `Served`).
* **IDOR Protection:** Customer orders and receipts are safeguarded with per-order HttpOnly 32-byte cryptographic tokens.

### 2. 👨‍🍳 Kitchen Display System (KDS)
* Real-time ticket board categorizing orders by urgency and preparation timeline.
* One-click status updates alerting waiters the instant food is ready for pickup.
* Automated recipe breakdowns for combo deals into individual line items.

### 3. 🛎️ Waiter Service Portal
* Real-time floor overview displaying active tables, pending orders, and table assistance calls.
* Order dispatch verification ensuring dishes reach the correct table without confusion.
* Waiter work-status management (`ACTIVE` / `ON_BREAK`).

### 4. 💼 Cashier & Admin Management Back-Office
* **Combined Table Billing (DiningSession):** Group multi-round table orders into a single consolidated bill and automatically free the table once settled.
* **Billing & Reconciliation:** Instant bill generation supporting cash, card, and digital payment methods with thermal receipt printing.
* **Menu Engineering & Combos:** Add/edit food items, manage scheduled combo offers, upload food photography via Cloudinary.
* **Inventory & Recipe BOM:** Raw ingredient deduction, purchase orders, manual stock adjustments, and low-stock alerts.
* **Analytics & Audit:** Native MongoDB aggregation pipelines for revenue summaries, best-selling menu analytics, and immutable audit logs.

---

## 🏗️ Architecture & Project Structure

The project follows Clean Architecture and Domain-Driven Design (DDD) principles:

- `src/domain`: Pure status transitions (`status-machine.ts`), pricing totals, billing rules, and shared business types.
- `src/application`: Transactional use cases for orders, stock, purchases, waiter delivery, combo offers, and payments.
- `src/lib/api`: Double-barrier authentication, same-origin validation, rate limiting, and safe API errors.
- `src/validation`: Strict Zod request contracts.
- `src/app/api`: Thin HTTP controllers; privileged routes repeat authorization at the data boundary.
- `src/models`: MongoDB persistence models, indexes, and schemas.
- `tests`: Unit, validation, authorization, and concurrency transaction tests.

```bash
src/
├── app/
│   ├── (auth)/login/        # Role-based authentication entrypoint
│   ├── admin/               # Back-office catalog, inventory & analytics
│   ├── cashier/             # Billing, combined session invoicing & settlement
│   ├── kitchen/             # Real-time Kitchen Display System (KDS)
│   ├── waiter/              # Floor tables & service dispatch portal
│   ├── table/[qrCode]/      # Customer QR dine-in ordering session
│   ├── takeaway/            # Carry-out and takeaway ordering flow
│   └── api/                 # Secure RESTful API endpoints
├── application/             # Business use-cases & transactional services
├── components/              # Modular UI components (modals, forms, badges)
├── domain/                  # Pure domain entities, calculations & state machine
├── lib/                     # DB connection, JWT auth, rate-limit, audit logging
├── models/                  # Mongoose Schemas (User, Order, MenuItem, Table, etc.)
├── types/                   # Shared TypeScript type contracts
└── validation/              # Zod input validation schemas
```

---

## 🔒 Security & Data Integrity

- **ACID Transactions:** Money, stock deductions, order status, table/session state, payment records, and audit records are changed inside MongoDB transactions (`readConcern: snapshot`, `writeConcern: majority`).
- **Optimistic Stock Locking:** Concurrency-safe stock deduction avoids overselling items.
- **Double-Barrier Auth:** Next.js 16 `proxy.ts` performs early route checks, while each protected API route verifies the active database user again.
- **Per-Order Security:** Customer order, receipt, and payment views require the per-order HttpOnly access token; an order ID alone is not sufficient.

---

## 🚀 Getting Started Locally

### Prerequisites
* Node.js 20.x or higher
* MongoDB replica set (local replica set or MongoDB Atlas) for transactions
* Cloudinary credentials (optional, for image upload)

### 1. Clone the repository
```bash
git clone https://github.com/dulanjananushika-rgb/restaurant-qr-system.git
cd restaurant-qr-system
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```
Set a random `JWT_SECRET` with at least 32 characters.

### 4. Quality checks
```bash
npm run typecheck    # TypeScript validation
npm run lint         # ESLint validation
npm test             # Run 31 Vitest unit & integration tests
npm run build        # Verify production Next.js build
```

### 5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 👨‍💻 Author & Engineering Context

Designed and built by **[Dulanjan Anushika](https://dulanjan-anushika.vercel.app)** as an exploration into high-concurrency state synchronization, role-based workflows, and real-time operational interfaces.

* **Portfolio:** [dulanjan-anushika.vercel.app](https://dulanjan-anushika.vercel.app)
* **LinkedIn:** [linkedin.com/in/dulanjan-anushika](https://linkedin.com/in/dulanjan-anushika)
* **Email:** [dulanjananushika@gmail.com](mailto:dulanjananushika@gmail.com)
