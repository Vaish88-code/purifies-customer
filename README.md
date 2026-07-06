# Purifies Customer App

Customer-facing web app for the Purifies Water Delivery platform.

## Setup

```bash
npm install
cp .env.example .env
# Fill in Firebase values in .env
npm run dev
```

## Scripts

- `npm run dev` — local dev server (port 3001)
- `npm run build` — production build
- `npm run preview` — preview production build

## Deploy (Netlify)

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- Add Firebase `VITE_*` environment variables in Netlify site settings.
