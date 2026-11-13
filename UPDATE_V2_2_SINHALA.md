# MicroFund V2.2 Update

මෙම version එකේ ප්‍රධාන වෙනස්කම්:

- Dashboard එක 320px සිට tablet/desktop දක්වා responsive කර ඇත.
- Mobile screen එකේ පැරණි 260px sidebar grid column ඉවත් කර ඇත.
- Sidebar overlay, body scroll lock සහ accessible menu buttons එක් කර ඇත.
- Tables page එක පුළුල් නොකර panel එක ඇතුළත horizontal scroll වේ.
- Search, filters, forms, modals, notifications සහ reports mobile layout වලට සකස් කර ඇත.
- Loan application, field visit, verification, document review, loan decision සහ payment events සඳහා professional HTML emails එක් කර ඇත.
- Cash/office payment සහ accepted online payment slip සඳහා receipt number, amount, loan number, remaining balance සහ loan completion status email එකට ඇතුළත් වේ.
- SMTP error එකක් වුවත් successful loan/payment transaction එක rollback නොවේ. Email failure log කර app action එක දිගටම සාර්ථක වේ.

## Run

Backend සහ frontend දෙකම restart කරන්න:

```cmd
cd backend
npm install
npm run dev
```

වෙනම terminal එකක:

```cmd
cd frontend
npm install
npm run dev
```

Browser එකේ `Ctrl + F5` භාවිතයෙන් hard refresh කරන්න.

## SMTP

`backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your_new_16_character_app_password
MAIL_FROM="MicroFund <yourgmail@gmail.com>"
```

කලින් chat එකක share කළ App Password එක revoke කර අලුත් එකක් භාවිතා කරන්න.
