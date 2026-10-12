# GridMind frontend: rules for working in this repo

## Project
GridMind is an agentic-AI system that manages a simulated campus microgrid (solar, battery, main grid, 4 hostels, 2 labs, library, admin block). AI agents forecast demand, plan, test plans in a digital twin, act, explain their reasoning, and learn from incidents.

- Tagline: **A control room that thinks, acts, and explains.**
- This repo holds the website (landing page at `/`) and the Control Room app (`/app/*`).
- Audience: BITSETGO'26 judges (Agentic AI & ML), campus energy operators, students. Demoed on a projected laptop and opened on phones.
- The Python/FastAPI backend (simulator, ML, agent loop) is built separately. The UI talks only to `src/services/`.

## How to work
- **Scope:** build only the pages and features in the brief. Ideas go in a "Suggestions" note, not into code.
- **Decide, don't stall:** pick the sensible option where the brief is open, keep it consistent, and report it.
- **Step gates:** Step 1 Foundation → Control Room → Scenarios → Agents → Memory → Results → Settings → Landing → README. Stop for review after each step.
- **Commits:** commit after each step/page, e.g. `feat(control-room): add live grid diagram`. Push only after the step is approved.
- **Verify before "done":** run the app, check 1440px and 390px, in Light, Dark and System. Fix contrast, overflow and alignment.
- **Explain:** after each step, list the files created and what each does in plain language.

## Design rules
1. One hero per screen with one obvious primary action.
2. The blue→teal gradient (`bg-hero`) is used ONLY on each screen's hero element.
3. Agent reasoning is always visible, never hidden behind a spinner.
4. Status as small pills. Full-screen alarms only for real faults.
5. No empty-looking data: seed realistic demo data. Friendly empty states only where truly empty.
6. Say each thing once per screen.
7. Every screen answers: Where am I? What can I do? What happens next?
8. Grid state understandable in 3 s; product understandable in 10 s.

Palette roles: green = healthy/clean · amber = generation/warning · blue→teal gradient = hero only · AI-blue = agent thinking · red = fault.
Type: Plus Jakarta Sans for UI, JetBrains Mono for numbers/logs only. Body text ≥ 14px.
Surfaces: 12–16px radius, 1px borders, soft shadows. Lucide icons only (stroke 1.75).
Never look like a crypto dashboard, neon hacker terminal, SCADA screen, admin template or cartoon app.

## Theme system
- Modes: `light | dark | system` (default `system`, live-follows the OS).
- Tokens live in `src/styles/tokens.css` as CSS variables, defined separately for light and dark.
- `src/styles/globals.css` maps tokens into Tailwind (`bg-surface`, `text-muted`, `border-border`, …).
- **Components never hard-code colors and never use `dark:` overrides.** Use token classes only.
- The no-flash script in `index.html` sets `data-theme` on `<html>` before React renders.
- `useTheme()` (in `src/hooks/useTheme.tsx`) reads/sets the preference; localStorage access is wrapped in try/catch.
- Both themes must pass WCAG AA.

## Folder structure
```text
src/
├── components/   ui (generic building blocks), layout (shell), grid, agents, scenarios, results, landing
├── pages/        Landing, ControlRoom, Agents, Scenarios, Memory, Results, Settings
├── styles/       tokens.css, globals.css
├── hooks/        useTheme, useCountUp, useMediaQuery, ...
├── services/     the ONLY place pages get data from (mock today, FastAPI later)
├── store/        small shared app state (zustand)
├── types/        shared TypeScript types
└── utils/        small helpers (cn, formatters)
```
Keep components small. No ad-hoc page styling: reuse `components/ui`.

## Data rule
- Pages and components import data functions from `src/services` only, never from mock files.
- Service functions: `getGridState()`, `getForecast()`, `injectFault()`, `runCommanderStep()`, `getThoughtTrace()`, `getIncidentMemory()`, `getResults()`, `setGoal()`.
- Each mock is marked with a `// MOCK:` comment. Never present mock output as real AI.
- Demo data: realistic Indian campus, UPPCL-style tariff slabs, evening peak 18:00–22:00, solar peak at midday. No lorem ipsum.
- Never put API keys in the frontend.

## Commands
- `npm run dev`: start the dev server (http://localhost:5173)
- `npm run build`: type-check and build
- `npm run lint`: type-check only
