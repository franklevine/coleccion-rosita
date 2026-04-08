# Colección Rosita Lira — MVP System Spec (Final)

**Project:** Self-hosted art collection manager replacing Artwork Archive ($300/yr)
**Owner:** Francisco Levine (32Pacific)
**Date:** April 7, 2026
**Version:** 1.1 — Approved for build

---

## 1. Objective

Record, populate, value, protect, and organize for inheritance a ~195-piece art collection across two locations in Chile. Provide a shared interface for 5 siblings, the collection owner (Rosita), and an external gallery manager to collaboratively catalog, price, and eventually distribute the works.

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    USERS (PWA)                       │
│  Siblings (editors) · Rosita (viewer) · Gallery mgr │
│  Spanish-only · Mobile-first · GitHub Pages          │
└──────────────────────┬──────────────────────────────┘
                       │ Supabase JS Client
                       ▼
┌─────────────────────────────────────────────────────┐
│               SUPABASE (Free Tier)                   │
│                                                      │
│  PostgreSQL         │  Auth (email/password)          │
│  - artists          │  - roles via user_metadata      │
│  - pieces           │  - RLS policies per role        │
│  - photos (refs)    │                                 │
│  - valuations       │  Storage (1GB)                  │
│  - wishlists        │  - thumbnails only (~150KB ea)  │
│  - allocations      │                                 │
│  - activity_log     │                                 │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│        GOOGLE DRIVE (32Pacific Workspace)             │
│  Shared folder: /ColeccionRosita/                    │
│  Full-resolution photos (up to 3 per piece)          │
│  Organized: /ColeccionRosita/{piece_id}/             │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│           TERMINAL SCRIPTS (Mac)                     │
│  Python + Claude API                                 │
│  - PDF import (parse Artwork Archive export)         │
│  - Bulk photo upload (compress → Supabase thumb,     │
│    original → Google Drive)                          │
│  - Artist research & valuation via Claude            │
│  - Collection reports (PDF/CSV)                      │
└─────────────────────────────────────────────────────┘
```

## 3. Supabase Free Tier Budget

| Resource | Limit | Projected Usage | Headroom |
|---|---|---|---|
| DB storage | 500 MB | ~5 MB (text data for 200 pieces) | 99% free |
| File storage | 1 GB | ~30 MB (thumbnails, 200 × ~150KB) | 97% free |
| MAU (auth) | 50,000 | ~10 users | Negligible |
| Egress | 5 GB/mo | ~500 MB (light browsing) | 90% free |

**Inactivity risk:** Free tier projects pause after 7 days of inactivity. Mitigation: GitHub Actions cron job pings the project daily (free).

## 4. Database Schema

### 4.1 `artists`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `name` | text NOT NULL | Full name as commonly known |
| `nationality` | text | |
| `birth_year` | int | |
| `death_year` | int | NULL if alive |
| `bio` | text | Short biography |
| `bio_source` | text | URL or "Investigación Claude" |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

### 4.2 `pieces`

Core table. Captures essential fields from Artwork Archive minus features irrelevant to a family collection (exhibitions, loans, consignments, editions).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `title` | text NOT NULL | "Sin título" if unknown |
| `artist_id` | uuid FK → artists | NULL if unknown |
| `year_created` | int | NULL if unknown |
| `medium` | text | "Óleo sobre tela", "Escultura en bronce", etc. |
| `type_of_art` | text | Pintura, Escultura, Grabado, Fotografía, Dibujo, Mixta, Otro |
| `dimensions` | text | Free text: "80 × 60 cm" |
| `location` | text | Physical location now |
| `status` | text | Disponible, Vendida, Donada, Perdida, Dañada |
| `condition_notes` | text | |
| `provenance_notes` | text | Ownership history narrative |
| `description` | text | Additional context |
| `notes` | text | Private family notes |
| `is_signed` | boolean | default false |
| `inventory_number` | text | Original Artwork Archive ID or family-assigned # |
| `tags` | text[] | PostgreSQL array for flexible tagging |
| `data_completeness` | int | 0-100, auto-calculated |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

### 4.3 `photos`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `piece_id` | uuid FK → pieces | |
| `slot` | int | 1, 2, or 3 |
| `thumbnail_path` | text | Supabase Storage path |
| `gdrive_file_id` | text | Google Drive file ID for full-res |
| `gdrive_url` | text | Direct/viewable link |
| `is_primary` | boolean | Main display image |
| `uploaded_at` | timestamptz | default now() |

**Constraint:** UNIQUE(piece_id, slot) — enforces max 3 photos per piece.

### 4.4 `valuations`

Multiple appraisals per piece over time.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `piece_id` | uuid FK → pieces | |
| `estimated_value_usd` | numeric | |
| `estimated_value_clp` | numeric | |
| `value_source` | text | "Galería X", "Investigación Claude", "Subasta comparable" |
| `confidence` | text | Alta, Media, Baja |
| `appraised_by` | text | Name of person or system |
| `appraised_at` | date | |
| `notes` | text | Methodology, comparable sales references |
| `created_at` | timestamptz | default now() |

### 4.5 `wishlists`

Private per sibling. Admin sees all. No sibling sees another's picks.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | The sibling |
| `piece_id` | uuid FK → pieces | |
| `interest_level` | int | 1 = me gusta, 2 = lo quiero, 3 = es importante para mí |
| `note` | text | Private reason ("era el cuadro del living de la abuela") |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

**Constraint:** UNIQUE(user_id, piece_id) — one entry per person per piece.
**RLS:** Each user reads/writes only their own rows. Admin reads all.

### 4.6 `allocations`

Phase 2 feature. Created in schema now, UI built later.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `piece_id` | uuid FK → pieces | UNIQUE — one allocation per piece |
| `heir_id` | uuid FK → auth.users | |
| `phase` | text | auto_resolved, sentimental, draft, unassigned |
| `draft_round` | int | NULL unless phase = draft |
| `assigned_by` | uuid FK → auth.users | Admin who confirmed |
| `assigned_at` | timestamptz | |
| `notes` | text | |

### 4.7 `activity_log`

Audit trail — who changed what, when.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `action` | text | created, updated, valued, photo_added, wishlist_marked |
| `entity_type` | text | piece, artist, valuation, wishlist |
| `entity_id` | uuid | |
| `changes` | jsonb | Before/after snapshot of changed fields |
| `created_at` | timestamptz | default now() |

## 5. Roles & RLS

Using Supabase Auth with `raw_user_meta_data.role`:

| Role | View all | Edit piece metadata | Edit name + artist | Edit valuations | Manage users | Wishlists |
|---|---|---|---|---|---|---|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ | See all |
| `editor` | ✓ | ✓ | ✓ | ✓ | ✗ | Own only |
| `pricing` | ✓ | ✗ | ✓ (inline in pricing view) | ✓ | ✗ | ✗ |
| `viewer` | ✓ | ✗ | ✗ | ✗ | ✗ | Own only |

- **Admin:** Francisco (+ optionally one sibling)
- **Editor:** Siblings who contribute data (artist names, titles, provenance, prices)
- **Pricing:** Gallery manager — optimized for valuation, can also correct name/artist inline
- **Viewer:** Rosita, anyone who just browses

RLS policies enforce this at the database level.

## 6. PWA — Screens & Features

### 6.1 Design Principles

- **Spanish-only** interface
- **Mobile-first** (family will use phones primarily)
- **Minimal UI** — gallery-style browsing, not a CMS
- **PWA** — installable on home screen, offline browsing of cached data
- **Hosted:** GitHub Pages (`[username].github.io/coleccion-rosita`)

### 6.2 Screen Map

```
Login (email + password)
 │
 └── Galería (home)
      │
      ├── Vista Galería — photo grid with filters
      │    ├── Filters: ubicación, artista, tipo, estado, completitud
      │    ├── Sort: título, artista, valor, completitud
      │    └── Dots: 🔴 datos críticos faltan · 🟡 parcial · 🟢 completo
      │
      ├── Ficha de Obra (piece detail)
      │    ├── Photos (swipeable, tap for full-res via Drive)
      │    ├── Metadata fields (editable per role)
      │    ├── Valuations section (editable by editor/pricing/admin)
      │    ├── Wishlist toggle (heart icon, only for editor/viewer roles)
      │    ├── Activity log (read-only timeline)
      │    └── "Datos faltantes" prompts for missing fields
      │
      ├── Vista de Precios (pricing mode)
      │    ├── Compact list: thumbnail + título + artista + valor actual
      │    ├── Inline editable: valor, fuente, confianza
      │    ├── Inline editable (secondary): título, artista
      │    ├── Tab/enter to advance through rows
      │    ├── Filter: sin precio / todos
      │    ├── Progress bar: X de 195 valoradas
      │    └── Running total: valor estimado colección
      │
      ├── Artistas
      │    ├── Artist list with piece count
      │    └── Artist detail + linked pieces
      │
      ├── Resumen / Dashboard
      │    ├── Total piezas, % catalogadas, % valoradas
      │    ├── Valor estimado total de la colección
      │    ├── Distribución por ubicación, tipo, artista
      │    └── (Phase 2) Inheritance equity summary
      │
      ├── Mis Favoritos (wishlist view, own picks only)
      │    ├── Pieces marked with interest level
      │    └── Running value of selected pieces
      │
      └── Admin (admin role only)
           ├── User management (invite, assign roles)
           ├── Export data (CSV)
           ├── Wishlist heat map (all siblings, contested items)
           └── (Phase 2) Allocation draft + equity dashboard
```

### 6.3 "Datos Faltantes" Prompting System

Visual cues guide family members to fill in missing data progressively.

**Gallery view:** Colored dot on each piece card.
- 🔴 Red = critical data missing (no artist AND no real title)
- 🟡 Yellow = partial (has artist but missing medium, dimensions, or value)
- 🟢 Green = complete enough for valuation

**Piece detail:** Missing fields show as tappable prompts:
*"¿Conoces al artista? Toca para agregar"*

**Completeness score formula:**

| Field | Weight |
|---|---|
| title (real, not UUID) | 15 |
| artist | 20 |
| medium | 10 |
| type_of_art | 5 |
| dimensions | 5 |
| year_created | 5 |
| location | 10 |
| has_photo | 15 |
| has_valuation | 15 |
| **Total** | **100** |

Calculated client-side from piece data; stored in `data_completeness` for filtering/sorting.

### 6.4 Pricing View (Gallery Manager UX)

Optimized for rapid valuation input:

- Compact scrollable list: thumbnail (small) + title + artist + value field
- **Primary actions:** valor (USD or CLP), fuente, confianza — large touch targets, tab-through navigation
- **Secondary actions:** title and artist editable inline but visually de-emphasized (smaller font, edit icon to activate)
- Filter toggle: "Solo sin precio" to work through unvalued pieces sequentially
- Progress indicator at top: "87 de 195 valoradas (45%)"
- Running total: "Valor estimado colección: $XX,XXX USD"
- Keyboard-friendly: tab cycles through value → source → confidence → next row

### 6.5 Wishlist UX

For editors and viewers (siblings):

- **Heart icon** on each piece card in gallery view and piece detail
- Tap once: ❤️ level 1 (me gusta)
- Tap again: ❤️❤️ level 2 (lo quiero)
- Tap again: ❤️❤️❤️ level 3 (es importante para mí)
- Tap again: clears
- Long-press or secondary tap: opens note field ("¿Por qué te interesa esta obra?")
- **"Mis Favoritos"** view shows all marked pieces with running estimated value total
- No visibility into other siblings' wishlists (RLS enforced)

### 6.6 Admin — Wishlist Heat Map (Phase 1.5)

Visible only to admin:

- Grid/table: pieces as rows, siblings as columns
- Cells show interest level (color-coded 1/2/3 or empty)
- Highlights contested pieces (2+ siblings at level 2-3)
- Uncontested pieces (only 1 sibling interested) clearly marked
- Filter: show only contested / only uncontested / all

## 7. Inheritance Distribution System

### 7.1 Philosophy

The system provides **data and structure** for family decisions. It does not make decisions. The four phases can happen over weeks or months, at the family's pace.

### 7.2 Four Phases

**Phase 1 — Private Wishlists** *(MVP, built now)*
- Each sibling marks interest privately (3 levels + optional note)
- Admin sees consolidated heat map
- No commitment, no visibility between siblings
- Goal: gather signal on sentimental attachments and preferences

**Phase 2 — Auto-Resolution of Uncontested Items** *(Phase 2 build)*
- System identifies pieces where only one sibling expressed interest
- Admin reviews and confirms tentative assignment
- Expected to resolve 60-70% of pieces with zero conflict
- Assigned pieces move to `allocations` with `phase = auto_resolved`

**Phase 3 — Sentimental Resolution for Contested Items** *(Phase 2 build)*
- System surfaces contested pieces (2+ siblings, interest level 2-3)
- Shows admin the "why" notes from each claimant
- Admin facilitates family conversation (meeting, call, or async in PWA)
- Resolved items go to `allocations` with `phase = sentimental`

**Phase 4 — Value-Balanced Snake Draft for Remaining Items** *(Phase 2 build)*
- Remaining unassigned pieces enter a draft
- Random snake order: round 1 A→E, round 2 E→A, round 3 A→E...
- System shows real-time running value total per sibling
- Warns if any sibling deviates >10% from equal share target
- Sibling can "pass" to bank value credit
- Drafted items go to `allocations` with `phase = draft`

**Post-Draft — Cash Equalization**
- System calculates total estimated value assigned per sibling
- Delta between each sibling's total and the equal share target (total ÷ 5)
- Over-allocated siblings owe the difference; under-allocated receive it
- Displayed in admin dashboard as a settlement summary

### 7.3 Equity Dashboard (Admin, Phase 2)

| Metric | Display |
|---|---|
| Total collection value | $XXX,XXX USD |
| Equal share target | $XX,XXX USD per sibling |
| Per sibling: pieces assigned, total value, delta from target | Table |
| Unassigned pieces remaining | Count + value |
| Contested items pending resolution | Count |
| Cash equalization needed | Per sibling, positive (owes) or negative (receives) |

## 8. Terminal Scripts (Mac)

Python scripts run from Terminal. Same operational pattern as existing projects.

### 8.1 `import_from_pdf.py`

- Parses the Artwork Archive PDF export using `pdfplumber` or `PyMuPDF`
- Extracts from each piece block: title, artist name, location, status, condition notes, tags
- For UUID-style titles: stores original as `inventory_number`, sets title to "Sin título"
- Creates `artists` records for named artists (deduplicates)
- Creates `pieces` records linked to artists where available
- Outputs a summary: X pieces imported, Y with artist, Z with real titles
- **Handles the PDF structure:** Each piece block follows a consistent layout (title line, artist line if present, location, status, collection, tags, image reference)

### 8.2 `upload_photos.py`

- Takes a local folder of photos as input
- For each photo:
  - Generates compressed JPEG thumbnail (~150KB, max 800px wide) → uploads to Supabase Storage
  - Uploads original to Google Drive `/ColeccionRosita/{piece_id}/`
  - Creates `photos` record with both references
- Matching logic: filename contains piece inventory_number or interactive prompt
- Progress bar, batch processing, resume capability on failure
- Uses `google-api-python-client` with OAuth2 for Drive access

### 8.3 `research_artists.py`

- Pulls artists with empty bio, or pieces with unknown artists
- For each known artist, calls Claude API (Sonnet) to:
  - Research biography, nationality, birth/death years, notable works
  - Search for auction records and comparable sales
  - Estimate value range based on medium, dimensions, artist market position
- Updates `artists` table with bio data
- Creates `valuations` records with `confidence: "Baja"` and `source: "Investigación Claude"`
- Generates per-artist markdown research report
- Estimated API cost: ~$2-5 total for full collection

### 8.4 `export_report.py`

- Generates collection summary as CSV or formatted PDF
- Options: full inventory, valued pieces only, by location, by artist
- Includes inheritance summary if allocations exist
- Useful for insurance documentation, estate planning, or sharing with appraiser

## 9. Tech Stack

| Component | Technology | Hosting | Cost |
|---|---|---|---|
| Database | PostgreSQL via Supabase | Supabase Free | $0 |
| Auth | Supabase Auth (email/password) | Supabase Free | $0 |
| Thumbnails | Supabase Storage | Supabase Free | $0 |
| Full-res photos | Google Drive (32Pacific workspace) | Google Workspace | $0 (included) |
| PWA frontend | React + Vite + Tailwind | GitHub Pages | $0 |
| Terminal scripts | Python 3 + supabase-py + google-api-python-client | Local Mac | $0 |
| AI research | Claude API (Sonnet) | Pay per use | ~$2-5 one-time |
| Keep-alive | GitHub Actions daily cron | GitHub Free | $0 |
| **Total recurring** | | | **$0/month** |

## 10. Data Migration Plan

**Phase 1: Import structure**
Run `import_from_pdf.py` to parse the Artwork Archive PDF and create all ~195 piece records. Pieces get "Sin título" where title is a UUID. Artists extracted and deduplicated.

**Phase 2: Import photos**
Download photos from Artwork Archive. Run `upload_photos.py` to distribute thumbnails (Supabase) and originals (Google Drive).

**Phase 3: Family enrichment**
Share PWA with siblings. Each person browses and adds artist names, titles, provenance notes, condition details. The "datos faltantes" system guides them. Wishlists open for private marking.

**Phase 4: Gallery pricing**
Give pricing role to gallery manager. They use the pricing view to appraise pieces systematically.

**Phase 5: AI research**
Run `research_artists.py` to fill artist bios and generate preliminary valuations for pieces with identified artists.

**Phase 6: Inheritance (when ready)**
Admin reviews wishlist heat map. Family runs through the four-phase distribution process at their own pace.

## 11. What This Does NOT Include (vs. Artwork Archive)

Intentionally excluded to keep scope tight:

- Exhibition tracking
- Loan management
- Contact/CRM management
- Invoice generation
- Public profile / discovery
- Edition tracking
- Certificate of Authenticity generation
- Sales pipeline
- Maintenance records
- QR code labels
- Multi-collection support (single collection only)

Can be added later if needed. None are relevant to the stated objectives.

## 12. Build Sequence for Claude Code

| # | Component | Dependency | Estimated Effort |
|---|---|---|---|
| 1 | Supabase setup: schema SQL, RLS policies, storage bucket, auth config | None | Small |
| 2 | Terminal: `import_from_pdf.py` | #1 | Medium |
| 3 | Terminal: `upload_photos.py` | #1 | Medium |
| 4 | PWA: auth + gallery view + piece detail | #1 | Large |
| 5 | PWA: piece editing (per role) + datos faltantes | #4 | Medium |
| 6 | PWA: pricing view | #4 | Medium |
| 7 | PWA: wishlist (heart icon + mis favoritos) | #4 | Small |
| 8 | PWA: dashboard + resumen | #4 | Medium |
| 9 | PWA: admin panel (users, export, wishlist heat map) | #4 | Medium |
| 10 | Terminal: `research_artists.py` | #1, #2 | Medium |
| 11 | Terminal: `export_report.py` | #1 | Small |
| 12 | GitHub Actions: keep-alive cron | #1 | Small |
| 13 | (Phase 2) Allocation draft + equity dashboard | #7, #6 | Large |

**MVP = Steps 1–9.** Steps 10-13 are enhancements after the core is working.

## 13. Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Photo storage | Thumbnails in Supabase, full-res in Google Drive (32Pacific) | Fits free tier; Drive has 15GB+ headroom |
| Max photos per piece | 3 | Sufficient for front, back, detail |
| Auth model | Per-user with 4 roles (admin/editor/pricing/viewer) | Gallery manager needs restricted but useful access |
| Language | Spanish only | All users are in Chile |
| Domain | GitHub Pages default | No cost, no maintenance |
| Inheritance approach | 4-phase hybrid (wishlists → auto-resolve → sentimental → draft) | Balances fairness, privacy, and family dynamics |
| PDF import | Parse with pdfplumber/PyMuPDF | CSV export not available from Artwork Archive |
| Editor pricing access | Yes, editors can also set prices | Siblings may know purchase prices |
| Pricing role editing | Can edit title + artist inline (secondary to pricing) | Gallery manager may recognize works |
