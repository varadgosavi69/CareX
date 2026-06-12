# CareX Cloud

Healthcare Appointment Management platform — book appointments, manage
profiles, check symptoms, find emergency services, and more.

## Project Structure

```
CareX/
├── frontend/   # React + Vite app (Firebase Auth/Firestore/Storage)
├── backend/    # Reserved for a future API server (none currently)
├── README.md
└── .gitignore
```

## Frontend Setup

The frontend is a Vite + React app that talks directly to Firebase
(Authentication, Firestore, and Storage) — there is no custom backend
server.

### Prerequisites

- Node.js 18+
- A Firebase project with Auth, Firestore, and Storage enabled

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your Firebase project credentials and Google
Maps API key:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

### Run

```bash
npm run dev       # start dev server (http://localhost:5173)
npm run build     # production build to frontend/dist
npm run preview   # preview the production build
npm run lint      # run ESLint
```

## Backend Setup

No backend server currently exists — the app uses Firebase as its
backend-as-a-service. The `backend/` folder is reserved for a future
Node.js / Express API. See [`backend/README.md`](backend/README.md).

## Tech Stack

- React 18 + Vite 5
- React Router
- Firebase (Auth, Firestore, Storage)
- Leaflet / React-Leaflet (maps)
- Lucide React (icons)
