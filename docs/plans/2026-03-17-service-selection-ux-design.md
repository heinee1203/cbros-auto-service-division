# Service Selection UX Redesign

**Date:** 2026-03-17
**Status:** Approved

## Problem

148 services across 15 categories in a flat scrolling list. Frontliners scroll endlessly to find what they need.

## Solution

Three-layer progressive disclosure: Group Toggle → Category Pills → Service Grid, plus search.

## Architecture

Replace single `intake-service-select.tsx` with `src/components/schedule/service-select/` folder:

| File | Purpose |
|------|---------|
| `index.tsx` | Orchestrator — all state, data fetch, layout |
| `service-search-bar.tsx` | Debounced search, clear button, match highlighting |
| `service-group-toggle.tsx` | Body & Paint / Auto Service / Other pills |
| `category-pills.tsx` | Horizontal scrollable category quick-nav |
| `service-grid.tsx` | Collapsible sections, service cards, selected counts |
| `frequently-used.tsx` | 8 hardcoded popular service picks |

## Constants (added to constants.ts)

- `SERVICE_GROUPS`: `{ "Body & Paint": [...], "Auto Service": [...], "Other": [...] }`
- `FREQUENTLY_USED_SERVICE_NAMES`: 8 hardcoded names for quick picks
- `CATEGORY_SHORT_LABELS`: Short pill labels (e.g., "PMS", "Brakes")

## Layout (top to bottom)

1. Search bar (hides group toggle + pills when active)
2. Group toggle (3 pills, default: Auto Service)
3. CHECK-UP ONLY toggle (existing)
4. Category pills (scrollable, filtered by active group)
5. Frequently Used section (8 cards)
6. Category sections (collapsible, with selected count badges)
7. Bottom bar (existing: back, count, level, continue)

## Data Flow

- All state in orchestrator index.tsx
- Sub-components are pure props + callbacks
- Same `/api/service-catalog` fetch, same data shape
- Parent `IntakeWizard` needs only an import path change
- No backend/schema changes

## Interaction Flows

1. **Search**: type "brake" → instant filter across all categories
2. **Group browse**: tap "Auto Service" → see only mechanical categories
3. **Category jump**: tap "Brakes" pill → scroll to Brake System section
4. **Quick pick**: tap "PMS Basic" in Frequently Used
5. **Check-up**: toggle ON → everything else disabled

## Verification Checklist

- Search filters instantly (2+ chars, 200ms debounce)
- Group toggle switches visible categories
- Category pills update per group, tap scrolls to section
- Frequently Used shows 8 sensible defaults
- Collapsible sections expand/collapse
- Selected count per category header
- Multi-select works across categories
- CHECK-UP ONLY still works
- Footer shows correct count
- Touch-friendly on tablet
