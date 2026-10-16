---
name: frontend-design
description: "Design and implement polished web interfaces. Use shadcn for component-specific configuration and troubleshooting."
effort: deep
license: Apache-2.0; adapted by PeakLab, see NOTICE.md and LICENSE.txt
---

Build distinctive, production-grade, working interfaces that avoid generic "AI slop" aesthetics.

## Direction

Before coding, commit to one BOLD aesthetic direction that fits the purpose, audience and constraints: brutally minimal, maximalist, retro-futuristic, organic, luxury/refined, playful, editorial, brutalist, art deco, soft/pastel, industrial, or your own. Decide the one thing someone will remember. Bold maximalism and refined minimalism both work; the key is intentionality, not intensity.

## Aesthetic rules

- **Typography**: distinctive, characterful fonts. Pair a distinctive display font with a refined body font.
- **Color**: a cohesive palette in CSS variables. Dominant colors with sharp accents beat timid, evenly-distributed palettes.
- **Motion**: CSS-only for HTML; the Motion library for React when available. Prefer one orchestrated page load with staggered reveals (`animation-delay`) over scattered micro-interactions; add scroll-triggered and hover states that surprise.
- **Composition**: asymmetry, overlap, diagonal flow, grid-breaking elements; generous negative space OR controlled density.
- **Backgrounds**: atmosphere and depth instead of solid colors: gradient meshes, noise or grain, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, matched to the direction.

NEVER use overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), or predictable, cookie-cutter layouts and component patterns.

No two designs should be the same: vary light and dark themes, fonts and aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

Match implementation complexity to the vision: maximalism needs elaborate code with extensive animation and effects; minimalism needs restraint and precise spacing, typography and detail.
