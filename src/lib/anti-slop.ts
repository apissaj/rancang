/**
 * Anti-Slop Guidelines for Rancang
 * Adapted from miqdadbadjuber/anti-slop (MIT License)
 *
 * Filters out generic AI vocabulary, fabricated statistics, trend-stacking,
 * and lifeless defaults to produce grounded, human-crafted PRD and Design specs.
 */

export const ANTI_SLOP_PRD_RULES = `
Anti-Slop & Craftsmanship Standards (Strictly enforced):
- NO Empty AI Vocabulary: Do NOT use buzzwords like "seamless", "cutting-edge", "revolutionary", "game-changer", "delve", "elevate", "unlock", "empower", "robust", "next-level", "transformative", "landscape", "testament", "ushering in a new era". State plain facts directly (e.g. "Work with your team in one shared space" instead of "Unlock the power of seamless collaboration").
- NO Fabricated Claims or Metrics: Do NOT invent unsourced statistics ("99.9% uptime", "trusted by 10k users", "SOC-2 compliant") unless explicitly provided by the user. If data is unknown, state requirements plainly without fake social proof or fictional metrics.
- NO Em Dash (—) Overuse: Do not use em dashes (—) in narrative text; use commas, periods, colons, or parentheses instead.
- NO Happy-Path-Only Thinking: Always define boundary conditions, empty states, loading states, and realistic error handling (Resilience & Edge Cases).
- NO Chatbot Fluff: No conversational openers or closers ("I hope this helps", "Let's dive in", "Here is what you need to know"). Return only pure, structured, actionable content.
`;

export const ANTI_SLOP_DESIGN_MD_RULES = `
Anti-Slop UI & Design System Standards (Strictly enforced):
- Color Discipline:
  * "neutral" MUST be the dominant solid surface (near-white or near-black), NEVER body text or accent.
  * NO generic blue-purple / blue-cyan / purple-to-pink gradient defaults or full-page glow orbs.
  * NO unmotivated dark mode: only choose dark if the brand/domain specifically calls for it (e.g. developer/creative tools). Default to clean light or high-contrast dark with purpose.
  * Palette Cap: exactly 1 dominant surface neutral + 1 primary accent + at most 1 subtle secondary. Avoid scattered 5-7 color palettes.
  * Contrast Gate: all text must strictly meet WCAG AA (min 4.5:1 for regular text, 3:1 for large text). Never put light gray text on light backgrounds or white text on light-pastel accents.
- Layout & Component Craft:
  * NO Trend Stacking: do NOT combine glassmorphism + glow + pill shapes + mesh gradients.
  * Glassmorphism & Glow: max 1-2 focal elements or none at all. Everything else must remain clean and solid matte.
  * Border Radius: do NOT make every card, input, and button a uniform pill. Use deliberate, proportional radii (e.g. 4px-8px for inputs/cards, distinct radius for CTA).
  * Shadows: avoid overly soft, floating shadows everywhere. Keep surfaces grounded.
  * Sections: avoid monotonous template repetition (centered title + 3 identical cards). Structure sections based on actual content hierarchy.
`;

export const ANTI_SLOP_SCREEN_RULES = `
Wireframe Prototype Standards:
- Complete States: wireframes must reflect realistic states (empty state when no items exist, active list state, error feedback).
- Functional Links: every button or nav-item that navigates MUST link to an existing screen id. NO dead buttons or navigation links to non-existent screens.
- Mobile Tap Targets: buttons and interactive items must be sized with comfortable touch targets (min 44x44px equivalent).
- No Generic Clutter: avoid stacking useless badges like "AI-Powered", "Beta", or generic chevron arrows on every single row without interaction intent.
`;
