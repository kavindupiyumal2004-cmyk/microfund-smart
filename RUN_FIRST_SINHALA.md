# MicroFund V3 – මුලින්ම Run කරන විදිහ

## 1. Database

XAMPP එකෙන් Apache සහ MySQL start කරලා phpMyAdmin → Import යන්න.

Import කරන්න:

```text
backend/database/microfund_complete.sql
```

## 2. Backend

```cmd
cd backend
copy .env.example .env
```

`.env` file එකේ MySQL සහ Gmail SMTP details දාන්න. SQL import කරලා නම්:

```env
DB_SYNC=false
```

ඊට පස්සේ:

```cmd
npm install
npm run dev
```

## 3. Frontend

වෙනම CMD window එකක:

```cmd
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

API:

```text
http://localhost:5000
```

Swagger:

```text
http://localhost:5000/api-docs
```

## Default staff password

```text
Password@123
```

- admin@microfund.local
- cashier@microfund.local
- cashier2@microfund.local
- agent@microfund.local

## Gmail වැදගත්

Normal Gmail password එක නොදා Google App Password එක දාන්න. කලින් chat එකේ share කරපු App Password එක revoke කරලා අලුත් එකක් භාවිතා කරන්න.

## V2.2 update එකෙන් පස්සේ

Backend සහ frontend දෙකම restart කරලා browser එකේ `Ctrl + F5` කරන්න. Mobile test සඳහා Chrome DevTools වල 320px, 360px, 390px, 430px සහ 768px widths check කරන්න.


## V3 default staff accounts

Password: `Password@123`

- Owner: `owner@microfund.local`
- Manager: `manager@microfund.local`
- Cashier: `cashier@microfund.local`
- Agent: `agent@microfund.local`

Fresh setup එකකට `backend/database/microfund_complete.sql` import කරන්න. Existing V2 data තියාගන්න නම් backup එකක් අරගෙන `backend/database/upgrade_v2_to_v3.sql` run කරන්න.
