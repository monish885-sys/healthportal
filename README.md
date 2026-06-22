# Health Portal API

A full-stack health portal with role-based portals (admin, doctor, patient), appointment management, medical reports, prescriptions, ML-powered symptom analysis, and disease outbreak tracking.

## Features

- **Admin portal** — user management, feedback review, disease analytics, outbreak monitoring
- **Doctor portal** — appointments, prescriptions, medical reports, consultation buddy, emergency alerts
- **Patient portal** — appointments, report uploads, symptom analysis with triage, prescriptions (read-only)
- **ML symptom analyzer** — scikit-learn models with severity-based triage (informational only, not clinical diagnosis)
- **Security** — helmet, rate limiting, session auth, role-based access, upload validation, protected file downloads

## Tech stack

| Layer | Technology |
|-------|------------|
| API | Node.js, Express 5, Mongoose 8 |
| Frontend | Static HTML + Tailwind CDN |
| ML | Python 3, scikit-learn, pandas |
| Database | MongoDB |

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Python 3.10+

### 1. Install dependencies

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set SESSION_SECRET at minimum
```

### 3. Seed demo data

```bash
npm run seed
```

Demo credentials are in [DEMO_USERS.md](./DEMO_USERS.md).

### 4. Start the server

```bash
npm start
```

Open http://localhost:3000 — API docs at http://localhost:3000/api/docs

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with file watch (Node 18+) |
| `npm run seed` | Reset and seed demo database |
| `npm test` | Run API tests |

## API overview

| Prefix | Description |
|--------|-------------|
| `/api/auth` | Login, logout, password reset |
| `/api/admin` | Admin user management |
| `/api/admin/disease` | Disease cases, outbreaks, hospital impact |
| `/api/healthcare` | Appointments, reports, prescriptions, ML analysis |
| `/api/health` | Health check |
| `/api/docs` | Endpoint reference |

## Environment variables

See [.env.example](./.env.example) for all options. Key variables:

- `SESSION_SECRET` — required in production
- `MONGODB_URI` — MongoDB connection string
- `ALLOW_PUBLIC_REGISTRATION` — set `true` to allow `/api/auth/register` in production (default: off in production)
- `PYTHON_BIN` — optional path to Python binary for ML

## Deployment

The project includes `railway.toml` for Railway. Set `NODE_ENV=production`, `SESSION_SECRET`, and `MONGODB_URI` in your host environment.

For ML on Railway, ensure Python dependencies are installed and `PYTHON_BIN` points to the correct interpreter.

## Security notes

- ML predictions are **informational only** — not for clinical diagnosis
- Uploaded medical files are served only via authenticated download endpoints
- Public self-registration is disabled in production by default
- Demo credentials in `DEMO_USERS.md` are for local development only

## Project structure

```
├── app.js                 # Express app (testable)
├── server.js              # DB connect + listen
├── middleware/              # Auth, upload validation
├── routes/                # API route handlers
├── Models/                # Mongoose schemas + ML pickles
├── utils/                 # Email, ML service
├── ml_cli.py              # Python ML stdin/stdout bridge
├── symptom_analyzer.py    # ML models and analysis
├── public/                # Portal HTML pages
├── scripts/seed.js        # Demo data seeder
└── tests/                 # API tests
```

## License

ISC
