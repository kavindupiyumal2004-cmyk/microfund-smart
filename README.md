# MicroFund Smart Microfinance System V3 — Five Role Edition

A full-stack university prototype for managing the microloan lifecycle from customer registration and field verification through manager credit assessment, loan approval, repayment tracking, arrears collection and owner reporting.

## Five user roles

| Role | Main responsibility |
|---|---|
| **OWNER** | Read-only executive oversight of customers, applications, loans, payments, arrears, staff, reports and audit logs. |
| **MANAGER** | Runs the complete operational process: staff, application review, agent assignment, document review, credit assessment, approval/rejection, collections and configuration. |
| **AGENT** | Performs assigned field verification and follows up overdue collection cases. |
| **CASHIER** | Records office repayments, reviews customer bank-payment slips and issues receipts. |
| **CUSTOMER** | Registers, uploads KYC documents, applies for loans, tracks status/loans, uploads payment slips and views repayment history. |

## End-to-end workflow

```text
Customer registration + documents
        ↓
Customer loan application
        ↓
Manager review
        ↓
Area/workload-based Agent assignment
        ↓
Agent field visit + evidence + recommendation
        ↓
Manager document review
        ↓
Manager credit & repayment-capacity assessment
        ↓
Approve / Reject
        ↓
Approved loan + monthly repayment schedule
        ↓
Cashier office payment OR customer payment-slip review
        ↓
Payment allocation + receipt + balance update
        ↓
Paid / Partial / Overdue installments
        ↓
Automatic collection case for overdue installments
        ↓
Agent follow-up / Promise-to-Pay / Escalation
        ↓
Manager resolution / Loan completion

OWNER → monitors the whole process, reports and audit trail in read-only mode.
```

## V3 additions

- Five-role RBAC: Owner, Manager, Agent, Cashier and Customer.
- Owner executive dashboard and read-only cross-system visibility.
- Manager operational control replacing the old Admin workflow.
- Agent role replacing the old Field Officer role.
- Credit and repayment-capacity assessment before approval:
  - monthly income snapshot
  - household expenses
  - existing loan repayments
  - other commitments
  - disposable income
  - proposed amount/rate/term
  - estimated installment
  - risk level and recommendation
- Approval is blocked until a credit assessment exists and the existing document/evidence requirements are satisfied.
- Automatic arrears/collections module:
  - overdue installment detection
  - automatic collection case creation
  - Agent assignment
  - call/SMS/field-visit notes
  - Promise-to-Pay tracking
  - escalation and resolution
- Collections report added to the existing PDF/CSV report builder.
- Owner can view payment-slip review details without making cashier decisions.
- Manager can reassign payment-slip reviews and process the operational workflow.

## Existing major features retained

- React SPA + Node/Express REST API + MySQL/MariaDB.
- JWT authentication and bcrypt password hashing.
- Customer registration and email verification.
- Private KYC/document upload and document-by-document review.
- Area/workload-based Agent recommendation.
- Field verification evidence and recommendation.
- Automatic loan and repayment-schedule generation after approval.
- Full and partial repayments with automatic installment allocation.
- Customer bank payment-slip upload, duplicate warnings and cashier review.
- Receipts, balances and loan completion tracking.
- Notifications, professional email templates and audit logs.
- Configurable web/PDF/CSV reports.
- Swagger/OpenAPI documentation.

## Technology stack

- Frontend: React 18, Vite, React Router, Axios, Socket.IO Client, Lucide icons
- Backend: Node.js, Express, Sequelize
- Database: MySQL / MariaDB
- Authentication: JWT + bcrypt
- Email: Nodemailer
- Reports: PDFKit + CSV
- Logging: Winston + database audit trail

## Database setup

### Option A — XAMPP/phpMyAdmin

1. Start Apache and MySQL.
2. Open `http://localhost/phpmyadmin`.
3. Choose **Import**.
4. Import:

```text
backend/database/microfund_complete.sql
```

This creates `microfund_db`, the five roles, all workflow tables and sample staff accounts.

If you already have the previous V2 database and want to keep its data, back it up and run `backend/database/upgrade_v2_to_v3.sql` instead of re-importing the destructive complete schema.

Keep this in `backend/.env` when using the imported SQL:

```env
DB_SYNC=false
```

### Option B — Docker database

From the project root:

```bash
docker compose up -d
```

MySQL runs on port `3306` and phpMyAdmin on `http://localhost:8080`. A fresh Docker volume imports the complete SQL automatically.

## Backend setup

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Linux/macOS:

```bash
cp .env.example .env
```

Backend: `http://localhost:5000`  
Swagger: `http://localhost:5000/api-docs`  
Health: `http://localhost:5000/api/health`

## Frontend setup

Open another terminal:

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Default staff accounts

All seeded staff accounts use:

```text
Password@123
```

| Role | Email |
|---|---|
| Owner | owner@microfund.local |
| Manager | manager@microfund.local |
| Cashier 1 | cashier@microfund.local |
| Cashier 2 | cashier2@microfund.local |
| Agent | agent@microfund.local |

Customers create their own account through the public registration page.

## Main V3 database entities

In addition to the existing users, customer documents, applications, field visits, loans, schedules and payments, V3 includes:

```text
CreditAssessment
CollectionCase
CollectionActivity
```

`CollectionCase` is generated automatically when an unpaid installment passes its due date.

## Gmail SMTP (optional for development)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your_16_character_app_password
MAIL_FROM="MicroFund <yourgmail@gmail.com>"
```

Use a Google App Password, not the normal Gmail password. Never commit `.env`.

## Useful commands

Backend:

```bash
npm run dev
npm start
npm run db:sync
npm run seed
npm test
```

Frontend:

```bash
npm run dev
npm run build
npm run preview
```

## Important note

This is an academic/prototype loan-management system. Interest rules, approval limits, accounting treatment, consumer disclosures, collection rules, CRIB access and regulatory controls must be configured and reviewed for the actual institution before real-world production use. Do not treat the sample loan products, thresholds or workflow settings as legal/regulatory defaults.
