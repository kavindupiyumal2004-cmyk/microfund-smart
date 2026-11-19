# MicroFund V3.2 Loan Rules & Header Update

## Repayment frequency
- Up to and including LKR 50,000, installments are weekly.
- Above LKR 50,000, the customer chooses weekly or monthly installments when applying.
- If approval reduces the principal to LKR 50,000 or below, the schedule uses weekly installments.
- The loan type duration is the maximum requested or approved term.

## Interest and late payments
- Normal agreed loan interest is calculated when the loan is approved.
- If an installment is paid late, the system **does not add extra interest, penalty interest, or late interest**.
- The installment only changes to `OVERDUE`; its original `amount_due` stays unchanged.

## Header / profile design
- Global top-bar search box removed.
- Clicking the top-right profile opens an account card with name, email, role, and **Sign out**.
- Sidebar sign-out remains available as a second convenient exit.

## Compatibility note
Before deploying to an existing database, run `node src/scripts/addRepaymentFrequency.js` from the backend directory. New applications store the requested frequency and new loans store the approved frequency. Older loans keep their original schedules and display their historical frequency. The column `monthly_installment` stores the standard installment amount for either frequency.
