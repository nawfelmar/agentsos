# Relay

AI-native enterprise communication prototype (temporary product name). Built alongside AgentOS in this monorepo without replacing the existing control-plane UI (`/web`).

## Thesis

Relay autonomously coordinates organizational communication — blockers, clarifications, meetings, decisions, and stakeholder updates — while keeping humans in control of consequential actions.

## Quick start

```bash
cd relay
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

You are signed in as **Alex Rivera** (Staff Engineer) in the seeded **Northline Systems** workspace.

> AgentOS control-plane UI remains on port **3000** (`cd web && npm run dev`).

## Demo journey

1. **Command Center** — critical auth-sdk blocker + pending meeting approval  
2. Open the coordination run → inspect **evidence** and AI clarification  
3. **Approve meeting** → meeting schedules, decision + action item land in Memory, stakeholder update marked sent  
4. Inspect **Meetings**, **Calendar**, **Messages** (`#checkout-redesign`), and **Decisions & Memory**

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js on :3001 |
| `npm run db:setup` | Prisma generate + SQLite push + seed |
| `npm run db:reset` | Reset DB and reseed |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Domain workflow tests |
| `npm run build` | Production build |

## Stack

- Next.js 14 (App Router) + React + TypeScript  
- Tailwind CSS + Lucide  
- Prisma + SQLite (zero-config demo; swap `DATABASE_URL` to Postgres for production)  
- Provider boundaries for LLM / A/V / calendar with honest demo adapters  

## Environment

See `.env.example`. Without `OPENAI_API_KEY`, `LIVEKIT_API_KEY`, or calendar credentials, integrations stay in labeled demo mode.
