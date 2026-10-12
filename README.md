# GridMind

**A control room that thinks, acts, and explains.**

GridMind is an agentic-AI system that manages a simulated campus microgrid: solar, a 2 MWh battery, the main grid, 4 hostels, 2 labs, a library and an admin block. AI agents forecast demand, build plans, test them in a digital twin, act within hard safety rules, explain their reasoning, and learn from every incident.

This repository holds the **website** (landing page at `/`) and the **Control Room app** (`/app/*`). It was built for **BITSETGO'26 (Agentic AI & ML)**. The Python/FastAPI backend (simulator, ML forecaster, agent loop) is built separately; until it is connected, the app runs on realistic mock data.

> Everything shown is a simulated campus calibrated on public data. No real grid is controlled.

## Quick start

Requirements: Node.js 20.19+ or 22.12+ (required by Vite).

```bash
git clone https://github.com/girdmind-arch/Grid_Mind.git
cd Grid_Mind
npm install
npm run dev
```

Open http://localhost:5173. The landing page is at `/`, the Control Room at `/app`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server at http://localhost:5173 |
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | Type-check only |

## What's inside

| Route | Page | What it shows |
| --- | --- | --- |
| `/` | Landing | What GridMind is, how it works, the agents, a results teaser |
| `/app` | Control Room | Live grid diagram, agent thought trace, operator goal, today's cost |
| `/app/agents` | Agents | The seven agents, their live status, the decision loop, guardrails |
| `/app/scenarios` | Scenarios | Inject a fault (cloud cover, heatwave, line failure, grid outage), watch the response, replay it |
| `/app/memory` | Memory | Every incident handled and the lessons learned from it |
| `/app/results` | Results | GridMind vs. a no-AI baseline: cost, peak, recovery, run-by-run learning, Save as PDF |
| `/app/settings` | Settings | Operating mode (AI / Fallback / Manual), goal presets, guardrails, theme |

Light, Dark and System themes are supported everywhere (System follows the device live).

## Folder structure

```text
src/
├── components/   ui (generic building blocks), layout (app shell), grid, agents,
│                 control-room, scenarios, memory, results, settings, landing
├── pages/        Landing, ControlRoom, Agents, Scenarios, Memory, Results, Settings
├── styles/       tokens.css (all colors, light + dark), globals.css (Tailwind mapping)
├── hooks/        useTheme, useService, useCountUp, useMediaQuery, ...
├── services/     the ONLY place pages get data from (mock today, FastAPI later)
│   ├── index.ts  every service function + its backend endpoint
│   ├── api.ts    HTTP helper; switches mock ↔ backend via VITE_API_URL
│   └── mock/     demo data, each file marked // MOCK:
├── store/        small shared app state (zustand): mode, goal, scenario loop, toasts
├── types/        shared TypeScript types (the API contract)
└── utils/        helpers: cn, formatters, simulated clock, print
```

Project rules for contributors (design, theme tokens, data flow) are in [`CLAUDE.md`](CLAUDE.md).

## Connecting the FastAPI backend

Pages never import mock data. They call functions in `src/services/index.ts`, and each function either returns mock data or calls the backend:

1. Copy `.env.example` to `.env.local` and set the backend URL:
   ```bash
   VITE_API_URL=http://localhost:8000
   ```
2. Restart `npm run dev`. Every service now calls the backend instead of the mocks.
3. The backend must return JSON matching the types in `src/types/` (`grid.ts`, `agents.ts`).

If the backend is unreachable or returns an error, the UI shows a calm message ("Safe rule-based control is active") instead of crashing.

### Endpoints the frontend expects

These are the proposed contract. If the backend team picks different paths, change them in one place: `src/services/index.ts`.

| Service function | Method & path | Returns |
| --- | --- | --- |
| `getGridState()` | `GET /api/grid/state` | `GridState` |
| `getForecast()` | `GET /api/forecast` | `Forecast` |
| `injectFault(req)` | `POST /api/scenarios/inject` | `FaultResult` |
| `clearScenario()` | `POST /api/scenarios/clear` | — |
| `runCommanderStep()` | `POST /api/agents/commander/step` | `Decision` |
| `respondToApproval(decision, response)` | `POST /api/agents/decisions/{id}/approval` | `Decision` |
| `getThoughtTrace()` | `GET /api/agents/trace` | `Decision[]` |
| `getAgents()` | `GET /api/agents` | `Agent[]` |
| `getGuardrails()` | `GET /api/guardrails` | `GuardrailRule[]` |
| `getIncidentMemory()` | `GET /api/memory` | `IncidentMemory` |
| `getResults()` | `GET /api/results` | `Results` |
| `getRunHistory()` | `GET /api/results/runs` | `ScenarioRunHistory[]` |
| `setGoal(goal)` | `POST /api/goal` | `GoalAck` |
| `setControlMode(mode)` | `POST /api/control/mode` | `ControlModeAck` |

**Never put API keys in the frontend.** Anything secret (LLM keys, weather API keys) belongs in the backend.

### What still lives in the browser (move to the backend later)

- **Session incidents and lessons.** When you run a scenario, the new incident, its outcome and any lesson are kept in `useScenarioStore` (`src/store/scenarioStore.ts`: `history`, `sessionIncidents`, `sessionLessons`) and merged with the data from `getIncidentMemory()`. Once the backend writes incidents and lessons itself, drop these and read everything from `/api/memory` and `/api/results/runs`.
- **Operating mode and goal.** Held in `useAppStore` (`src/store/appStore.ts`) and reset to AI Control and the Balanced goal on reload. The backend should be the source of truth: add `GET /api/control/mode` and `GET /api/goal` and load them when the app opens.
- **Simulated clock.** `src/utils/simTime.ts` fixes the demo at 17:20 IST, 12 May 2026, just before the evening peak. Replace it with the backend's simulation time.

## Demo data

Mock data describes a mid-sized Indian campus on a hot May evening: UPPCL-style tariff slabs (peak ₹9.70/kWh from 18:00 to 22:00, off-peak ₹6.90/kWh overnight), solar peaking at midday, and an evening demand peak of about 1,510 kW at 19:00. The numbers are kept consistent across pages. For example, the Results headline (18.4% cost saved, 22.1% lower peak, 2.6 vs 14 min recovery) is derived from the chart data in `src/services/mock/results.ts`. Nothing in the mocks is real AI output.

## Judge demo script (about 3 minutes)

1. **Control Room** (`/app`). "This is the campus right now: solar, battery, grid, and eight buildings. The agents are preparing for the 18:00 peak." Point at the thought trace: Observe → Reason → Plan A vs Plan B → Safety check → Act.
2. **Break something.** Go to **Scenarios** and click **Try a line failure**. Watch the Fault Responder isolate the feeder, the Planner test a reroute in the digital twin, and the Guardrail check it before anything is switched.
3. **Replay.** Click **Replay same scenario**. The agents reuse the lesson from the first run and recover faster. The learning panel shows run 1 vs run 2 against the no-AI baseline.
   Optional: run **Grid Outage** to show a high-impact plan pausing for the operator's approval.
4. **Memory** (`/app/memory`). The incident you just ran is at the top of the timeline, with the lesson it produced.
5. **Results** (`/app/results`). Close on the three numbers: **18.4% lower cost, 22.1% lower peak, 2.6 min vs 14 min recovery**. Pick **Line Failure** under "Better with every run" to show the improvement, and use **Save as PDF** to hand the judges a copy.

Tip: press the theme toggle in the top bar if the projector washes out Light mode.

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS v4 (token-based theming), React Router, Zustand, Recharts, Framer Motion, Radix UI primitives, Lucide icons, Plus Jakarta Sans and JetBrains Mono.

## Team

Built for BITSETGO'26. Team names and roles to be added.
