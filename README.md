# BD Election 2026 — Live Results 🇧🇩

Real-time election results tracker for Bangladesh's **13th National Parliament Election** (February 12, 2026).

![Dashboard Preview](https://img.shields.io/badge/Status-Live-red?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=flat-square&logo=firebase)
![AI](https://img.shields.io/badge/Gemini_AI-Powered-purple?style=flat-square&logo=google)

## Overview

A minimalist, real-time election tracker inspired by India's ECI portal. Since Bangladesh has no official election results API, this app uses **AI-powered data collection** from news sources with a multi-factor trust verification system.

### Features

- 📊 **Live Dashboard** — Real-time seats declared, party standings, and vote counts
- 🏛️ **Party Scoreboard** — Visual bar chart showing seats won/leading by party
- 📡 **Live Ticker** — Auto-updating feed of constituency declarations
- 🗺️ **Interactive Division Map** — SVG Bangladesh map colored by winning party
- 📱 **Mobile Quick Actions** — Floating Action Button (FAB) for fast navigation
- 📜 **Historical Context** — Dedicated banner for the 2024 Monsoon Revolution context
- 🔍 **Constituency Search** — Filter by division, status, or name
- 🤖 **AI Data Collection** — Gemini 2.5 Flash-Lite with Google Search grounding
- 🛡️ **Trust Score System** — Multi-factor verification (0-100) for data quality
- ⚙️ **Admin Panel** — Monitor AI accuracy, review queue, manual corrections

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

The AI collection engine is **dormant during voting** and activates after polls close:

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

MIT

---

Built with ❤️ by [Arif](https://iamarif.me/portfolio) • Powered by Gemini AI + Firebase
