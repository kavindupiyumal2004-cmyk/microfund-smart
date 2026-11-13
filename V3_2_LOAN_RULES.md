# MicroFund V3.2 Loan Rules & Header Update

## Repayment frequency
- Approved principal **LKR 100,000 or below**: repayment schedule is **weekly**.
- Approved principal **above LKR 100,000**: repayment schedule is **monthly**.
- The frequency is automatic from the approved principal; users do not manually choose it.

## Interest and late payments
- Normal agreed loan interest is calculated when the loan is approved.
- If an installment is paid late, the system **does not add extra interest, penalty interest, or late interest**.
- The installment only changes to `OVERDUE`; its original `amount_due` stays unchanged.

## Header / profile design
- Global top-bar search box removed.
- Clicking the top-right profile opens an account card with name, email, role, and **Sign out**.
- Sidebar sign-out remains available as a second convenient exit.

## Compatibility note
The existing database column `monthly_installment` is retained for backward compatibility. In V3.2 it stores the standard installment amount for either weekly or monthly schedules. The frontend labels it correctly based on approved principal.
