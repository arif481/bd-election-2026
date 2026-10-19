# BD Election 2026: live results

Real-time election results tracker for Bangladesh's **13th National Parliament Election** (February 12, 2026).

**Live:** https://arif481.github.io/bd-election-2026/

## Overview

A results tracker modelled on India's ECI results portal. Bangladesh publishes no official results API, so the app collects results from news reports with Gemini 2.5 Flash-Lite and Google Search grounding, then scores each result from 0 to 100 on several checks before showing it.

### Features

- Dashboard with seats declared, party standings and vote counts, updating live
- Party scoreboard as a bar chart of seats won and leading
- Ticker of constituency declarations as they come in
- SVG map of Bangladesh's divisions coloured by the leading party
- Constituency search by division, status or name
- A banner with context on the 2024 Monsoon Revolution
- Floating action button for quick navigation on phones
- Admin panel to review low-scoring results, correct them by hand and track how accurate the AI collection is

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript |
| Styling | Vanilla CSS (dark theme) |
| Database | Firebase Firestore |
| AI Engine | Gemini 2.5 Flash-Lite |
| Search | Google Search Grounding API |
| Hosting | GitHub Pages |

## Quick Start

```bash
# Clone
git clone https://github.com/arif481/bd-election-2026.git
cd bd-election-2026

# Install
npm install

# Configure (copy and fill in your keys)
cp .env.example .env.local

# Run in dev mode
npm run dev

# Build for production
npm run build
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_GEMINI_API_KEY` | Google Gemini API key |
| `VITE_ADMIN_HASH` | SHA-256 hash of admin password |

## Data Collection Strategy

Collection stays off while voting is open and starts once polls close:

| Phase | Frequency |
|-------|-----------|
| During Voting | OFF |
| Early Results (4:30 PM) | Every 1 min |
| Peak Results | Every 1 min |
| Late Night | Every 2 min |
| All Declared | Every 10 min |

## Architecture

```
src/
├── components/     # Reusable UI components
├── data/           # Party and constituency seed data
├── lib/            # Firebase initialization
├── pages/          # Route pages (Home, Constituencies, Parties, Admin)
├── services/       # Business logic
│   ├── gemini.ts   # AI data extraction
│   ├── collector.ts # Collection engine
│   ├── verifier.ts # Trust score system
│   └── firestore.ts # Database operations
└── types/          # TypeScript interfaces
```

## License

[MIT](LICENSE)
