# Deploy the API on Render

Create a Web Service from the GitHub repository, using branch `main`.

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Set environment variables in Render, never commit actual credentials:

```text
NODE_ENV=production
NODE_VERSION=22
FRONTEND_URL=https://microfund-smart.vercel.app
DB_HOST=<online MySQL hostname, not localhost>
DB_PORT=<provider port>
DB_NAME=<provider database name>
DB_USER=<provider username>
DB_PASSWORD=<provider password>
DB_SSL=true
DB_SYNC=false
JWT_SECRET=<new random secret generated privately>
JWT_EXPIRES_IN=1d
```

Render supplies PORT. If the database provider requires a custom CA, set
`DB_SSL_CA` to its PEM certificate (actual newlines or escaped `\n`). Keep
certificate verification enabled. DB_SSL defaults to false for local XAMPP.

Provision the MySQL schema before starting the API. Back up existing data first.
The complete SQL script DROPS existing tables and includes CREATE DATABASE/USE
statements which may need adaptation to the provider's assigned database name
and permissions. Do not import it over an existing populated database. Review
seed accounts and replace their default passwords before exposing the app.
Do not run db:sync or seed automatically during deployment.

## Files and email

For a Windows export imported with all-lowercase table names (such as `user`,
`role`, `loanapplication`), set `DB_TABLE_NAMES=lowercase` in Render. This maps
all Sequelize models to existing lowercase tables without renaming tables or
changing data. Omit it for the original mixed-case SQL schema. Keep DB_SYNC=false.

For the existing disk-based upload implementation, use a paid web service with
a persistent disk mounted at `/var/data` and set:

```text
PRIVATE_STORAGE_DIR=/var/data/private
```

The free service cannot attach a disk; local uploads disappear on restart or
redeploy. Free hosting requires a separate private object-storage implementation
before uploads can be retained. Existing Windows upload paths in an imported
database will not work on Linux: migrate both files and their stored paths.

For the current email implementation, configure SMTP_HOST, SMTP_PORT,
SMTP_SECURE, SMTP_USER, SMTP_PASS and MAIL_FROM in Render. Use provider-issued
SMTP credentials. Render Free blocks outbound ports 25, 465 and 587, so the
current Gmail SMTP flow requires paid compute (465/587) or an email API code
change. Customer verification and password reset need working delivery.

## Connect Vercel and verify

Set Vercel's `VITE_API_URL=https://<actual-service>.onrender.com/api`, then
redeploy the frontend. Never put database credentials or JWT_SECRET in VITE_
variables. Test `/api/health`, login, a protected endpoint, an upload/download,
and email verification. Restart the backend and confirm uploaded files remain.
The health route confirms HTTP availability; it does not continuously test DB.

References: https://render.com/docs/deploy-node-express-app,
https://render.com/docs/disks, https://render.com/docs/free
