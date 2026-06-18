# AVAtar — Lagerverwaltung

> Lokales Inventarsystem für AV-Systemintegratoren · Teil des AVA-Ökosystems

---

## Stack

| Schicht | Technologie |
|---|---|
| Backend | Node.js · Express · SQLite (better-sqlite3) |
| Frontend | Vue 3 · Vite · Pinia · Tailwind CSS |
| Auth | JWT (lokal, kein Cloud-Zwang) |
| Deployment | LAN-Server (Linux) · Browserzugriff |

---

## Erste Schritte

### Voraussetzungen

- Node.js ≥ 20 LTS
- npm ≥ 10

### Backend starten

```bash
cd backend
cp .env.example .env        # Werte anpassen
npm install
npm run dev
```

Der Server läuft auf **http://localhost:3000**  
Gesundheitscheck: `GET /api/health`

### Erster Login

Der erste Admin-User wird beim ersten Start automatisch angelegt —  
Zugangsdaten aus `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).  
**Passwort nach dem ersten Login ändern.**

---

## Projektstruktur

```
avatar/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql        # Vollständiges SQLite-Schema
│   │   │   └── init.js           # DB-Verbindung & Schema-Runner
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── requestLogger.js
│   │   ├── routes/
│   │   │   └── health.js
│   │   ├── config.js
│   │   └── index.js              # Express-Einstiegspunkt
│   ├── uploads/                  # Artikelbilder (gitignored)
│   ├── data/                     # SQLite-DB (gitignored)
│   └── .env.example
└── frontend/                     # Vue 3 (Phase 7+)
```

---

## Roadmap

| Phase | Inhalt | Status |
|---|---|---|
| 1 | DB-Schema + Express-Grundgerüst | ✅ |
| 2 | JWT-Authentifizierung + Rollen | ✅ |
| 3 | Artikel-API (CRUD + Barcode-Lookup) | ✅ |
| 4 | Bewegungs-API (Eingang/Ausgang) | ✅ |
| 5 | Verleih-API + Seriennummern | ✅ |
| 6 | E-Mail-Benachrichtigungen | ✅ |
| 7 | Frontend Setup (Vue 3 + Vite) | ✅ |
| 8 | Staff UI (Touch/Tablet) | ✅ |
| 9 | Admin UI (Dashboard + Tabellen) | ✅ |
| 10 | Benutzerverwaltung + Settings | ✅ |
| 11 | Polish + Deployment | ✅ |

---

## Artikeltypen

| Typ | Schlüssel | Einheit |
|---|---|---|
| Verbrauchsartikel | `consumable` | Stück |
| Gebinde | `bundle` | Set |
| Gerät | `equipment` | Stück · Seriennummer |
| Verleihgerät | `rental` | Stück · Seriennummer · Checkout |
| Kabelware | `cable` | Meter |

---

*AVAtar ist Teil des AVA-Ökosystems (AVACONDA, AVAtar).*
