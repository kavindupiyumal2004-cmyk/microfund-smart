# MicroFund V3 — Roles 5ක් සහිත Full System Guide

මේ version එකේ system එක roles **5ක්** අනුව redesign කරලා තියෙනවා:

```text
OWNER
MANAGER
AGENT
CASHIER
CUSTOMER
```

## 1. Role එකින් එක

### OWNER
Owner company/system එක monitor කරන highest-level role එක. Ownerට:

- සියලු customers බලන්න
- සියලු loan applications සහ documents බලන්න
- loans, repayment schedules සහ payment history බලන්න
- cashier payment-slip reviews බලන්න
- overdue/collection cases බලන්න
- staff/accounts බලන්න
- areas/loan products බලන්න
- audit logs බලන්න
- PDF/CSV reports generate කරන්න

පුළුවන්. **Owner operational records change කරන්නේ නැහැ.** Owner view එක read-only oversight එකක්.

### MANAGER
Manager තමයි daily loan process එක control කරන main operational user.

Managerට:

- staff create/manage කරන්න
- customer/application details review කරන්න
- Agent assign කර visit schedule කරන්න
- customer documents සහ Agent evidence review කරන්න
- credit/repayment-capacity assessment එක save කරන්න
- loan approve/reject කරන්න
- approved amount, interest rate, duration සහ first installment date set කරන්න
- payment-slip workflow monitor/reassign කරන්න
- overdue collection cases Agentලාට assign කරන්න
- follow-up records monitor/resolve කරන්න
- areas සහ loan products manage කරන්න
- reports/audit logs බලන්න

පුළුවන්.

### AGENT
Agentට:

- assigned field visits බලන්න
- customer documents බලන්න
- address/income/business/guarantor verification කරන්න
- field evidence upload කරන්න
- Approve / Reject / Review Again recommendation එක submit කරන්න
- assigned overdue collection cases බලන්න
- call/SMS/field visit follow-up note දාන්න
- Promise-to-Pay record කරන්න
- case escalate කරන්න

පුළුවන්.

### CASHIER
Cashierට:

- active loan search කරන්න
- office payment record කරන්න
- full/partial installment payment accept කරන්න
- customer upload කරන bank payment slips review කරන්න
- Accept / Reject / Clarification decisions දාන්න
- receipt generate කරන්න
- payment reports බලන්න

පුළුවන්.

### CUSTOMER
Customerට:

- register/login කරන්න
- NIC සහ required documents upload කරන්න
- loan apply කරන්න
- application status බලන්න
- field visit details බලන්න
- approved loan + repayment schedule බලන්න
- remaining balance සහ payment history බලන්න
- bank payment slip upload කරන්න
- receipts සහ notifications බලන්න

පුළුවන්.

## 2. Full business process

```text
Customer Register
    ↓
KYC/Documents Upload
    ↓
Loan Application
    ↓
Manager Initial Review
    ↓
Agent Assignment
    ↓
Field Visit
    ↓
Agent Verification + Evidence + Recommendation
    ↓
Manager Document Review
    ↓
Credit / Repayment Capacity Assessment
    ↓
Manager Final Decision
    ├── Reject → Customer notified
    └── Approve
           ↓
       Loan Created
           ↓
       Repayment Schedule Generated
           ↓
       Repayments
           ↓
       Paid / Partial / Overdue
           ↓
       Overdue නම් Collection Case
           ↓
       Agent Follow-up
           ↓
       Promise / Escalation / Resolution
           ↓
       Loan Completed
```

Owner මේ complete process එක dashboards, details, reports සහ audit logs වලින් monitor කරනවා.

## 3. Loan approval එකට අලුතින් දාපු Credit Assessment

Managerට application එකේ:

- Monthly income
- Household expenses
- Existing loan installments
- Other commitments
- Disposable income
- Proposed approved amount
- Proposed interest rate
- Proposed duration
- Estimated installment
- Risk level: LOW / MEDIUM / HIGH
- Recommendation: APPROVE / REVIEW / REJECT
- Notes

record කරන්න පුළුවන්.

Credit assessment එක save කරන්නේ නැතුව loan approve කරන්න backend එක allow කරන්නේ නැහැ. Existing required document/evidence checksත් approval එකට තවම තියෙනවා.

## 4. Repayment process

Approved loan එකකට system එක monthly repayment schedule එක generate කරනවා.

Cashier payment එකක් record කරද්දී system එක installment වලට amount allocate කරලා:

```text
PENDING → PARTIAL → PAID
```

status update කරනවා. Loan balance zero උනාම loan එක complete වෙනවා.

Customer bank transfer එකකින් pay කළොත් slip එක upload කරන්න පුළුවන්. Cashier accept කරනකම් ඒක official payment එකක් නෙවෙයි.

## 5. Overdue / Collection process

Due date එක pass වෙලා installment amount එක unpaid නම් system එක:

```text
Installment → OVERDUE
        ↓
Automatic Collection Case
```

create කරනවා.

Collection status:

```text
OPEN
CONTACTED
PROMISE_TO_PAY
ESCALATED
RESOLVED
```

Priority:

```text
NORMAL
HIGH
CRITICAL
```

Agentට follow-up history record කරන්න පුළුවන්. Managerට Agent assign කර case resolve කරන්න පුළුවන්. Payment එකෙන් installment එක fully settle උනාම collection case එක auto-resolve වෙන්නත් logic එක තියෙනවා.

## 6. Reports

Owner/Managerට:

- Loan Portfolio
- Loan Applications
- Payments
- Online Payment Slips
- Collections / Arrears
- Users

reports preview කර PDF/CSV export කරන්න පුළුවන්.

Cashierට allowed payment-related reports පමණයි.

## 7. Database import

XAMPP → phpMyAdmin → Import:

```text
backend/database/microfund_complete.sql
```

Existing V2 database එකේ data තියාගෙන upgrade කරන්න ඕන නම් database backup එකක් අරගෙන `backend/database/upgrade_v2_to_v3.sql` run කරන්න. Fresh setup එකකට complete SQL file එක import කරන්න.

`backend/.env`:

```env
DB_SYNC=false
```

## 8. Backend run

```cmd
cd backend
copy .env.example .env
npm install
npm run dev
```

## 9. Frontend run

```cmd
cd frontend
copy .env.example .env
npm install
npm run dev
```

Browser:

```text
http://localhost:5173
```

## 10. Default staff logins

Password සියල්ලටම:

```text
Password@123
```

```text
OWNER
owner@microfund.local

MANAGER
manager@microfund.local

CASHIER 1
cashier@microfund.local

CASHIER 2
cashier2@microfund.local

AGENT
agent@microfund.local
```

## වැදගත්

මේක academic/prototype system එකක්. Real microfinance company එකකට deploy කරනවා නම් actual company credit policy, interest/fees, accounting, approval limits, collection policy, CRIB permissions සහ Sri Lankan applicable regulatory requirements වෙනම confirm කරලා configure කරන්න ඕන.
