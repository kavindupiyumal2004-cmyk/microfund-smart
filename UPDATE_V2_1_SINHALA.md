# MicroFund V2.1 Update

මෙම version එකේ frontend alerts සහ notification page එක සම්පූර්ණයෙන් update කර ඇත.

## ඇතුළත් වෙනස්කම්

- `react-hot-toast` ඉවත් කර `SweetAlert2` භාවිතා කර ඇත.
- Success, error, warning සහ live-notification messages SweetAlert toast ලෙස පෙන්වයි.
- Browser `window.prompt()` dialogs සියල්ල SweetAlert input dialogs ලෙස වෙනස් කර ඇත.
- Loan approval සඳහා amount, rate, duration, first installment date සහ note එකම professional modal එකක ලබාගත හැක.
- Document accept/reject/re-upload decisions SweetAlert modal මඟින් ලබාගනී.
- Payment slip accept/reject/clarification/reassignment actions SweetAlert modal මඟින් ලබාගනී.
- Notifications page එක load නොවී white screen වීම fix කර ඇත.
- Notification API error එකක් ඇතිවුවහොත් blank page එකක් වෙනුවට error state සහ Retry button එක පෙන්වයි.
- Notification list එක unread count, New badge, icons සහ mark-all-read support සමඟ update කර ඇත.
- Notification bell popover එක outside click කළාම close වෙයි.
- Unexpected React screen error එකකදී සම්පූර්ණ website එක white වීම වැළැක්වීමට Error Boundary එකක් add කර ඇත.
- User role හෝ profile data තාවකාලිකව නොලැබුණත් Dashboard layout crash නොවන ලෙස safe fallbacks add කර ඇත.
- Backend notification limit validation සහ read-all response handling improve කර ඇත.

## Install / Run

Frontend folder එකේ dependencies නැවත install කරන්න:

```cmd
cd frontend
npm install
npm run dev
```

Backend එක වෙනම terminal එකක run කරන්න:

```cmd
cd backend
npm install
npm run dev
```

Database එකට වෙනසක් අවශ්‍ය නොවේ. V2 database එකම භාවිතා කළ හැක.
