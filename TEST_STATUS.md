# Validation Status — V3 Five-Role Edition

Validated in the artifact environment:

- Backend JavaScript syntax: **PASS** for all `backend/src` and `backend/tests` files using `node -c`.
- Loan calculator unit tests: **3/3 PASS** using Node's built-in test runner.
- Frontend JavaScript/JSX parser check: **PASS** for all source files using the TypeScript parser with `allowJs` + JSX parsing and no dependency resolution.
- Frontend relative import resolution: **PASS**.
- OpenAPI YAML parse: **PASS**.
- Legacy active-code role literals `ADMIN` / `FIELD_OFFICER`: **none** in the V3 application source and fresh V3 database schema.
- V3 role enum, `CreditAssessment`, `CollectionCase` and `CollectionActivity`: present in both Sequelize models and SQL schema.
- V2→V3 data-preserving SQL upgrade script included.

## Environment limitation

A full `npm install` / Vite production build could not be run in this artifact environment because external npm DNS/network access is unavailable (`registry.npmjs.org` cannot be resolved). Therefore runtime integration against a live MySQL server was not executed here.

On the target computer, after installing dependencies, run:

```bash
cd backend
npm install
npm test
npm run dev
```

and in a second terminal:

```bash
cd frontend
npm install
npm run build
npm run dev
```

Use `backend/database/microfund_complete.sql` for a fresh database, or back up an existing V2 database and run `backend/database/upgrade_v2_to_v3.sql` to preserve data.
