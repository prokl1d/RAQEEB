# dubai.ae: design analysis

Captured 2026-11-20 at 1440×900, home page only. The hero service cards were still loading (blank tiles) when captured, so card measurements are approximate.
Reference only: RAQEEB must not copy this site or look like an official government service.

# Design Map

## Spacing Scale
4, 8, 12, 16, 20, 24, 50px. Most frequent: 8px ×16, 20px ×12, 16px ×10.

## Font Hierarchy
- Hero wordmark / stats: Dubai 56px, weight 700
- h1: 24px / 32px, weight 700
- h2: 22px / 26.4px, weight 700
- Body / lead: 20px / 28px, weight 400
- Nav: 15px, weight 700
- Utility: 12–13px
- Family: "Dubai" (custom typeface, Arabic and Latin) for every role

## Color Palette
- Surfaces: #FFFFFF, #F2F2F2
- Text: primary #272833, secondary #737373
- Link: #0056CC
- Hero overlay: rgba(0,0,0,0.4). Subtle fill: rgba(0,0,0,0.05)

## Image Ratios
Full-bleed hero video at viewport height (aerial Burj Al Arab).

## Component Tokens
- Radius: 4px on most components; pill segments of 100px
- Shadows: 0 13px 26px rgba(0,0,0,0.08) on cards; 0 1px 3px -1px rgba(0,0,0,0.6) for small lifts
- Hero card row: 4 × 240px tiles with 12px gaps
- Persistent bottom utility bar: Services, Site Map, News Room, Contact Us, AI assistant

---

# Taste DNA

### One bespoke typeface for every role
- **Trigger**: A city portal needed to feel like Dubai in both Arabic and English.
- **Decision**: The custom "Dubai" font is used for all text. A display/body pairing was not used.
- **Reason**: One family that covers both scripts makes the language switch look continuous, and the brand is recognisable from type alone.
- **Evidence**: All 335 sampled elements use "Dubai". Only four weights appear: 700, 500, 400 and 300.

### Service search first, over the scenery
- **Trigger**: The hero had to serve both tourists and residents.
- **Decision**: A centred search bar and an "Explore Dubai Services" link sit on top of the video. There is no marketing headline.
- **Reason**: Most visitors arrive to do a task, and search in the hero shortens the path to it.
- **Evidence**: The search input is about 672px wide, centred under the wordmark. Search appears again in the header. A bottom utility bar stays on screen.

### Restraint: almost no accent colour
- **Trigger**: A city brand could have used a brand hue everywhere.
- **Decision**: The chrome uses white, #F2F2F2 and #272833, with blue #0056CC only for links.
- **Reason**: The photography supplies the colour. Neutral chrome keeps task UI legible on top of it.
- **Evidence**: White covers 46% and #F2F2F2 covers 44% of the background area. Only two text nodes use #0056CC. Nearly every component has a 4px radius.
