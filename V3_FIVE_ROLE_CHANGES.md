# V3 Five-Role Upgrade — Change Summary

## Role migration

- ADMIN → MANAGER for operational processing
- FIELD_OFFICER → AGENT
- Added OWNER as read-only executive/oversight role
- CASHIER retained
- CUSTOMER retained

## New backend modules

- `CreditAssessment`
- `CollectionCase`
- `CollectionActivity`
- `/api/collections/*`
- Application credit-assessment endpoints

## New/updated frontend modules

- Owner-specific dashboard/menu access
- Manager application + assessment workflow
- `CollectionsPage`
- Owner read-only views across application/payment/staff/configuration screens
- Reports extended with collections

## Database

`backend/database/microfund_complete.sql` and `backend/database/create_database.sql` now contain all V3 role enums, new tables and seed accounts.
