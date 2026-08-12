---
name: Civic Insight
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#42493e'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#72796e'
  outline-variant: '#c2c9bb'
  surface-tint: '#3b6934'
  primary: '#154212'
  on-primary: '#ffffff'
  primary-container: '#2d5a27'
  on-primary-container: '#9dd090'
  inverse-primary: '#a1d494'
  secondary: '#575f67'
  on-secondary: '#ffffff'
  secondary-container: '#d8e1ea'
  on-secondary-container: '#5b646b'
  tertiary: '#313c34'
  on-tertiary: '#ffffff'
  tertiary-container: '#48534a'
  on-tertiary-container: '#bac6bb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bcf0ae'
  primary-fixed-dim: '#a1d494'
  on-primary-fixed: '#002201'
  on-primary-fixed-variant: '#23501e'
  secondary-fixed: '#dbe4ed'
  secondary-fixed-dim: '#bfc8d0'
  on-secondary-fixed: '#141d23'
  on-secondary-fixed-variant: '#3f484f'
  tertiary-fixed: '#dae6da'
  tertiary-fixed-dim: '#becabe'
  on-tertiary-fixed: '#141e17'
  on-tertiary-fixed-variant: '#3e4941'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-display:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-page: 2rem
  gutter-grid: 1.5rem
  card-padding: 1.25rem
  stack-sm: 0.5rem
  stack-md: 1rem
---

## Brand & Style

The brand personality is **Institutional, Analytical, and Transparent**. It serves a dual purpose: providing governmental clarity and a modern data-driven experience for the Agencia de Transformación Digital. The UI should evoke a sense of reliability and civic progress through a **Corporate/Modern** aesthetic with subtle **Minimalist** influences.

Key attributes:
- **Trustworthy:** Through structured layouts and precise data visualization.
- **Efficient:** Reducing cognitive load in complex sociodemographic datasets.
- **Accessible:** Ensuring information is legible for a wide range of public officials and citizens.

## Colors

The palette is derived from the institutional identity of Morelos, emphasizing professional greens and sophisticated grays.

- **Primary (#2D5A27):** Deep forest green used for primary brand elements, headers, and call-to-action buttons. It signifies stability and growth.
- **Secondary (#6C757D):** A cool slate gray for secondary information, axis labels, and iconography.
- **Tertiary (#E9F5E9):** A soft mint green used for subtle backgrounds, row highlights, and active states.
- **Neutral (#F8F9FA):** A crisp, light gray for the global background to maintain high contrast with white cards.
- **Status Colors:** Use standard semantic colors for data trends—success (green), warning (amber), and critical (red)—but muted to fit the professional tone.

## Typography

This design system utilizes **Inter** for its exceptional legibility in data-heavy environments. The hierarchy is strictly enforced to separate categories from specific indicators.

- **Data Hierarchy:** Numerical indicators (e.g., population totals) use `data-display` to ensure they pop against the labels.
- **Weight Usage:** Bold weights (700) are reserved for primary titles and critical numbers. Semi-bold (600) is used for card titles. Regular (400) is used for all descriptive text and secondary data.
- **Caps:** Use `label-bold` with uppercase for category tags or small headers within cards to differentiate them from data rows.

## Layout & Spacing

The layout follows a **Fluid Grid** model to accommodate the density of demographic data across different screen sizes.

- **Desktop (1440px+):** A 12-column grid. Main dashboard cards typically span 3, 4, or 6 columns depending on the data complexity.
- **Tablet (768px - 1024px):** A 2-column stacked layout for cards. 
- **Mobile (<768px):** Single-column layout. Horizontal scrolling is permitted only for large data tables.
- **Spacing Rhythm:** Based on an 8px base unit. Consistent use of `stack-md` between card headers and content ensures a rhythmic flow.

## Elevation & Depth

To organize disparate data blocks (Population, Health, Education), the design system uses **Tonal Layers** combined with **Ambient Shadows**.

- **Surface Level 0:** Background uses the `neutral` color (#F8F9FA).
- **Surface Level 1 (Cards):** Pure white (#FFFFFF) containers. 
- **Shadows:** Use a single, soft shadow style for cards: `0 4px 12px rgba(0, 0, 0, 0.05)`. This provides enough separation from the background without feeling heavy.
- **Separators:** Instead of heavy borders, use 1px dividers in a very light gray (#E9ECEF) to separate rows within a card.

## Shapes

The shape language is modern and friendly but retains professional boundaries. 

- **Cards & Primary Containers:** Use `rounded-lg` (1rem) to soften the analytical feel of the dashboard.
- **Inputs & Buttons:** Use standard `rounded` (0.5rem) for a crisp, functional look.
- **Data Tags/Chips:** Use `rounded-xl` (1.5rem) or pill shapes to distinguish interactive filters from static cards.

## Components

### Cards
Cards are the primary organizational unit. Each must have a consistent header featuring an icon (secondary color) and a title (headline-md). Content should be divided into logical rows with high-contrast data on the right.

### Data Rows
Use a "Label - Percentage - Total" structure. The "Total" (numerical indicator) should be the most prominent element in the row, utilizing the primary green or a high-contrast dark gray.

### Buttons
- **Primary:** Solid primary green background with white text. High-contrast and clear.
- **Secondary:** Outline version of the primary or a subtle gray background. Used for "Print Report" or "Export" functions.

### Input Fields
Dropdowns and filters should have a white background, 1px light gray border, and clear placeholder text. The "Active" state should feature a 2px primary green focus ring.

### Maps
Maps should be integrated within a standard card container, maintaining the same corner radius and padding. Map markers should use the primary green to tie the geographic data back to the brand.

### Progress Bars (Nested)
For percentage-based data (e.g., % of population with water), use slim horizontal bars within the data rows to provide a quick visual benchmark.