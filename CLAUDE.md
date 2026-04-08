# Colección Rosita Lira — Project Guide

## What This Is
Self-hosted PWA art collection manager replacing Artwork Archive ($300/yr).
~195-piece art collection across two locations in Chile.
5 siblings + collection owner (Rosita) + external gallery manager.

## Tech Stack
- **Frontend:** React + Vite + Tailwind CSS (PWA, GitHub Pages)
- **Backend:** Supabase Free Tier (PostgreSQL, Auth, Storage)
- **Photos:** Thumbnails in Supabase Storage, full-res in Google Drive
- **Scripts:** Python 3 terminal scripts (import, upload, research, export)
- **AI:** Claude API (Sonnet) for artist research & valuation

## Key Conventions
- **Language:** Spanish-only UI. All labels, prompts, error messages in Spanish.
- **Mobile-first:** Design for phones first, then desktop.
- **Roles:** admin, editor, pricing, viewer — enforced via Supabase RLS + `raw_user_meta_data.role`
- **Currency:** USD primary, CLP secondary for valuations.

## Project Structure
```
/Rositas_Art_Collection/
├── CLAUDE.md
├── art-collection-mvp-spec-final.md    # Full spec (source of truth)
├── 202604 PDF Reports/                  # Artwork Archive exports
├── pwa/                                 # React + Vite PWA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/                         # supabase client, utils
│   │   ├── hooks/
│   │   └── contexts/
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── supabase/
│   └── schema.sql                       # All DDL, RLS policies, functions
├── scripts/                             # Python terminal scripts
│   ├── import_from_pdf.py
│   ├── upload_photos.py
│   ├── research_artists.py
│   └── export_report.py
└── .github/
    └── workflows/
        ├── deploy.yml                   # GitHub Pages deployment
        └── keepalive.yml                # Daily Supabase ping
```

## Build Order (MVP = Steps 1-9)
1. Supabase schema SQL + RLS + storage + auth config
2. import_from_pdf.py
3. upload_photos.py
4. PWA: auth + gallery view + piece detail
5. PWA: piece editing (per role) + datos faltantes
6. PWA: pricing view
7. PWA: wishlist (heart icon + mis favoritos)
8. PWA: dashboard + resumen
9. PWA: admin panel (users, export, wishlist heat map)

## Development Commands
```bash
# PWA development
cd pwa && npm run dev          # Vite dev server
cd pwa && npm run build        # Production build
cd pwa && npm run preview      # Preview production build

# Python scripts
cd scripts && python import_from_pdf.py
cd scripts && python upload_photos.py
```

## Important Notes
- Supabase free tier pauses after 7 days inactivity — keepalive cron handles this
- Max 3 photos per piece (UNIQUE constraint on piece_id + slot)
- Wishlists are private per sibling (RLS enforced), admin sees all
- `data_completeness` is calculated client-side, stored for filtering
- Spec file is the source of truth for all schema and feature details
