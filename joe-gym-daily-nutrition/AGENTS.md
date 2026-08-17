# Joe's Daily Nutrition

- Keep the fixed daily targets at 1,800 kcal, 160g protein, 155g carbohydrate, 60g fat and at least 30g fibre unless Joe explicitly changes them.
- Treat fibre as a hard minimum in recommendations.
- Food values must identify whether they are per 100g, cooked weight, raw weight or per portion.
- When a pack shows per-100g values but the portion is larger, scale every macro by the full portion weight.
- Verify parser changes with representative spoken phrases and a production build.
- 2026-08-17: Owner-only Sites access can reject the in-app browser when its session is not authenticated as the allowed account -> verify the active browser identity or get explicit approval before changing access mode.
- 2026-08-17: Macro fills began 90° away from their radial dividers -> keep conic-gradient zero at 12 o'clock and convert only spoke angles from top-origin to CSS transform angles.
- 2026-08-17: A gram amount after “and” was assigned to the preceding food -> only accept post-food weights when the number immediately follows that food's alias.
- 2026-08-17: Favicon metadata streamed into the body was ignored by the browser -> render a cache-busted icon link directly inside the root document head.
