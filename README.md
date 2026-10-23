<div align="center">

# 🍽️ Restaurant QR System
### Real-Time Multi-Role Dining & Kitchen Management Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Platform-ff5a1f?style=for-the-badge&logo=vercel&logoColor=white)](https://restaurant-qr-system-swart.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

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

### 2. 👨‍🍳 Kitchen Display System (KDS)
* Real-time ticket board categorizing orders by urgency and preparation timeline.
* One-click status updates alerting waiters the instant food is ready for pickup.

### 3. 🛎️ Waiter Service Portal
* Real-time floor overview displaying active tables, pending orders, and table assistance calls.
* Order dispatch verification ensuring dishes reach the correct table without confusion.

### 4. 💼 Cashier & Admin Management Back-Office
* **Billing & Reconciliation:** Instant bill generation supporting cash, card, and digital payment methods.
* **Menu Engineering:** Add/edit food items, manage pricing, upload food photography via Cloudinary, and toggle ingredient stock availability.
* **Analytics:** Revenue summaries, peak dining hours, and best-selling menu analytics.

---

## 🛠️ Tech Stack & Implementation Details

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons
- **Backend / APIs:** Next.js Server Actions & API Routes, Node.js runtime
- **Database & ODM:** MongoDB Atlas, Mongoose ODM
- **Authentication & Security:** JWT (JSON Web Tokens) with `jose` & `bcryptjs`, HTTP-only secure cookie sessions, Role-Based Access Control (RBAC) middleware
- **Media & QR Generation:** Cloudinary API for high-resolution image hosting, `qrcode` dynamic table generation
- **Hosting & Deployment:** Vercel (Edge-ready)

---

## 📂 Project Structure

```bash
src/
├── app/
│   ├── (auth)/login/        # Role-based authentication entrypoint
│   ├── admin/               # Back-office catalog & analytics dashboard
│   ├── cashier/             # Billing, invoicing & settlement terminal
│   ├── kitchen/             # Real-time Kitchen Display System (KDS)
│   ├── waiter/              # Floor tables & service dispatch portal
│   ├── table/[id]/          # Customer QR dine-in ordering session
│   ├── takeaway/            # Carry-out and takeaway ordering flow
│   └── api/                 # Secure RESTful API endpoints
├── components/              # Modular UI components (modals, forms, badges)
├── lib/                     # Database connection, JWT utilities, Cloudinary
├── models/                  # Mongoose Schemas (User, Order, MenuItem, Table)
└── types/                   # TypeScript interfaces and shared type contracts
```

---

## 🚀 Getting Started Locally

### Prerequisites
* Node.js 20.x or higher
* MongoDB instance (local or MongoDB Atlas connection URI)
* Cloudinary account for asset uploads

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
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to experience the application.

---

## 👨‍💻 Author & Engineering Context

Designed and built by **[Dulanjan Anushika](https://dulanjan-anushika.vercel.app)** as an exploration into high-concurrency state synchronization, role-based workflows, and real-time operational interfaces.

* **Portfolio:** [dulanjan-anushika.vercel.app](https://dulanjan-anushika.vercel.app)
* **LinkedIn:** [linkedin.com/in/dulanjan-anushika](https://linkedin.com/in/dulanjan-anushika)
* **Email:** [dulanjananushika@gmail.com](mailto:dulanjananushika@gmail.com)
