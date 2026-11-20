# designsystem.gov.ae: design analysis

Captured 2026-11-20 at 1440×900, home page only. Hex values are approximate conversions from the computed oklch values.
Reference only: RAQEEB must not copy this site or look like an official government service.

# Design Map

## Spacing Scale
4, 8, 12, 16, 24, 32, 48, 56, 112px (base 4px; most frequent values are 8px ×80, 24px ×39 and 16px ×36). The 112px value is used for section padding.

## Font Hierarchy
- Hero h1: Inter 58px / 64px, weight 800, tracking -1.45px
- Display h2: Inter 48px / 57.6px, weight 300
- Section title: Inter 40px, weight 800
- h3: Inter 34px / 42.5px, weight 600, tracking -0.85px
- Card title: 20px, weight 600
- Lead: Roboto 18px / 27px, max-width 607px
- Body and nav: Roboto 16px, weight 400–600
- Small: 14px. Badge: 12px, weight 500
- Arabic: Noto Kufi Arabic

## Color Palette
- Page background #FCFCFC. Surface #FFFFFF
- Text: primary #282A33, secondary #4D525E, muted #6B6F7B
- Accent gold #92722A. Dark gold text #6C5121. Gold tint #F2ECCF (badges)
- Timeline markers: orange #E9A15E
- Dark band (top bar, footer): #1B1D24

## Image Ratios
No hero photography. The hero uses a UI-mockup illustration in a browser frame.

## Component Tokens
- Radii: 4, 6, 8, 12 (most common), 16px, plus pill (9999px)
- Buttons: 16px text, 6–8px radius. Primary is a solid gold fill with white text; secondary is a 2px gold outline
- Header: floating white card, 12px radius, 24px inset, soft wide shadow
- Focus: 3px gold ring at 30% opacity
- Grid: 10-column bento grid with 24px gap; 24px page gutters
- Motion: 150–200ms cubic-bezier(0.4, 0, 0.2, 1) colour and transform transitions

---

# Taste DNA

### One metallic accent carries the national identity
- **Trigger**: A federal brand had to say "official UAE" without the clutter of the flag colours.
- **Decision**: One desaturated gold (#92722A) is used for CTAs, highlighted headline words and badges. The red/green/black flag palette was not used.
- **Reason**: Gold reads as institutional and calm. Flag colours would compete with the red error and green success colours a service UI needs.
- **Evidence**: Gold appears on the Documentation CTA, the Guidelines outline button and the headline words "design" and "system". Flag colours appear only in the logo ring. Badges use a #F2ECCF gold tint.

### Heavy display headings, quiet body
- **Trigger**: The hero had to carry authority in one line.
- **Decision**: Headings use Inter 800 at 58px with -1.45px tracking, while everything else uses Roboto at 16–18px. A single-weight scale was not used.
- **Reason**: Dense black headlines anchor the eye fast. Long guidance text stays readable at 18px/27px with a 607px measure.
- **Evidence**: h1 is 58/64 at weight 800. h3 is 34px at weight 600. Weight 400 accounts for 87 of about 160 text nodes.

### Bordered cards over shadowed cards
- **Trigger**: Grouping timeline entries and resources.
- **Decision**: Cards use 1px light borders with 12–16px radii instead of drop shadows. The active card gets a cream fill, not elevation.
- **Reason**: Flat bordered cards keep a document-like, printable feel suited to government guidance. Elevation is saved for the floating header.
- **Evidence**: The 12px radius appears 41 times and 16px appears 27 times. Timeline cards are bordered and white. The header is the only element with a meaningful drop shadow.

### Restraint: no photography in the hero
- **Trigger**: A national site could easily have used skyline imagery.
- **Decision**: The hero uses a faint radial colour wash and a greyed UI mockup instead of a full-bleed photo.
- **Reason**: The product is the components, so showing an interface sets expectations better than tourism imagery. It also keeps headline contrast high.
- **Evidence**: The background is #FCFCFC with blurred warm and green glows. A browser-frame mockup sits below the fold. Headline text is #282A33.
