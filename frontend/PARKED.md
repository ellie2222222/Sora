# Parked — not part of the current build

This Next.js web app targets the **superseded workspace model** and the **deleted FastAPI
backend**. It is kept on disk deliberately, for its visual design, its VI/EN i18n work, and its
form/dialog structure, all of which are worth porting rather than re-deriving.

**It does not run.** The API it calls (`http://localhost:8001`, FastAPI) no longer exists, and its
route tree, API service layer and Zod schemas are all shaped around a concept the product no
longer has.

Current work is `mobile/` (Expo React Native) against `api/` (NestJS). Mobile is the priority;
this is on hold until that vertical slice is working.

## Why it still says "workspace" everywhere

The repo-wide removal of that concept deliberately skipped this directory — rewriting parked code
would be churn. Every occurrence here is legacy by design. Nothing outside this directory should
mention it.

## What porting it would involve

Roughly, in dependency order:

1. Routes: `/app/workspaces/[id]/*` → `/app/wallets/[id]/*`. Every page under
   `src/app/app/workspaces/` moves, and the `[id]` param changes meaning from a workspace to a
   wallet.
2. Delete `src/lib/workspace-api.service.ts` and `src/schemas/workspace.ts`; replace both with
   imports from `@finance/contracts`, which already supplies the types, the Zod schemas and the
   money math this code hand-rolls.
3. Point the axios base URL at the NestJS API and adopt the `ApiEnvelope` response shape.
4. Replace every `number` amount with the string + `parseMoney` handling — this code does float
   arithmetic on money, which the new stack forbids (see the money rule in `CLAUDE.md`).
5. Add the surfaces that have no equivalent here: wallet switcher across own + shared wallets,
   members list with roles, invite-by-email, accept-invitation, and role-gated affordances.
6. Replace the OWNER/MEMBER role checks with OWNER/EDITOR/VIEWER via `roleSatisfies()`.

Step 4 is the one that cannot be skipped or deferred: a float amount that reaches a balance is a
silent data error, not a display bug.
