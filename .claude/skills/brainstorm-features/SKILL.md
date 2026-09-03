---
name: brainstorm-features
description: >-
  Analyzes existing code patterns, capabilities, and architecture to suggest new features that would
  naturally extend the system. Identifies gaps in coverage, unexploited patterns, and opportunities to
  multiply the value of existing infrastructure. Use when asked to "suggest features based on what we've
  built", "brainstorm what we could build next", or before roadmap/backlog grooming -- grounded in this
  repo's actual current patterns (discovered live), not a fixed idea list.
---

# Brainstorm Features from Code Patterns

Analyzes existing code patterns, capabilities, and architecture to suggest new features that would
naturally extend the system. Identifies gaps in coverage, unexploited patterns, and opportunities to
multiply the value of existing infrastructure.

## When to Use

- Planning next sprint or roadmap cycle — what can we build with what we already have?
- After completing a major feature — what does this open up?
- When onboarding — understand the system's latent capabilities
- Before grooming the backlog — surface ideas that use existing patterns instead of inventing new ones
- To validate a feature request — does it align with our current architecture, or would it require new
  patterns?

## What It Covers

**Unexploited Patterns**
- A data aggregation/filtering pipeline built for one entity that could serve another
- A filter/sort/pagination pattern applied to one resource that's missing from a similar resource
- An authorization boundary already enforced for one role that should apply elsewhere
- A caching or denormalization strategy proven for one flow that could speed up a slow path

**Capability Gaps**
- Read endpoints without corresponding write/update/delete (asymmetric CRUD)
- A feature that works in one direction but not the reverse (can fetch related items, but can't set the
  relationship)
- Search or filtering on one field but not others with similar cardinality
- Batch operations missing when single operations exist (or vice versa)

**Extension Opportunities**
- Existing relationships that could be bidirectional
- Data being collected but not surfaced (fields in the model unused by any endpoint — verify this live;
  it's easy for a field to have been wired up since the last time anyone checked)
- Metrics computed in one context that could inform another (e.g. a stats aggregation that could also
  power a recommendation or trending feature)
- Workflows that are manual but could be automated given the patterns already in place

**Integration Seams**
- Two separate resources that share a common query pattern — could they share a unified interface?
- Duplication across features that suggests a shared service or shared component
- APIs that accept similar input but return different shapes — standardization opportunity
- An external integration (API call, scrape, import) that's one-off but could be templated

**Developer Experience**
- Utilities or helpers built for one feature that could be generalized (a formatter, a validation rule)
- Testing patterns that proved useful for one module but aren't replicated elsewhere
- Configuration management that's ad hoc in one place but structured in another
- Error handling or retry logic that's inconsistent across services

## Phase 0 — Scope

- **Named by the user** (a feature, an entity, a subsystem) — confine Phase 1's inventory and every
  later phase to that area, rather than the whole repo.
- **Unscoped** ("brainstorm what we could build next", "suggest features based on what we've built") —
  the whole repo, since that's what this skill is for by default.

## How It Works

**Phase 1 — Pattern Inventory**
Agent scans the codebase and catalogs, from what's actually there — not from a template of "typical"
findings carried over from a different project:
- Data access patterns (queries, aggregations, filters, sorting, pagination)
- Authorization rules and their scope
- API endpoints and their contract/shape
- Shared utilities and libraries
- Configuration and environment handling
- Existing integrations with external systems

**Phase 2 — Gap Analysis**
Compare what exists against what's possible:
- For each resource/entity, map its CRUD coverage (Create? Read? List? Update? Delete?)
- For each read endpoint, note what filters/sorts/facets are supported
- For each relationship, check if it's unidirectional or bidirectional
- For each aggregation, ask whether it could apply to other entities
- For utilities and patterns, check reuse — if built once, is it built again elsewhere?

**Phase 3 — Opportunity Synthesis**
Generate feature ideas by asking, with the real entity/pattern names from *this* codebase substituted in:
- "We have `[pattern]` for `[entity A]`; could it apply to `[entity B]`?"
- "We compute `[metric]` in one place; could it inform `[other flow]`?"
- "This workflow is manual; could automation fill in using what we already have?"
- "We're collecting `[data]` but never returning it; should we surface it, or was it speculation?" — check
  the current endpoint/serialization code before asserting this; a field can go from unsurfaced to
  surfaced between one audit and the next.
- "This integration works one-way; could the reverse be valuable?"

**Phase 4 — Prioritization and Reporting**
Each idea is scored on:
- **Effort** — how much new code/infrastructure is needed? (mostly reuse vs. entirely new)
- **Impact** — how many users/flows would benefit?
- **Confidence** — how clearly does it align with existing patterns?
- **Dependencies** — does it require another feature first, or block other ideas?

## Example Findings

These are illustrative shapes for how a finding should read — placeholder entity/field names throughout.
A real finding names this repo's actual current entities/endpoints/fields, confirmed live (grep the real
serialization/endpoint code before asserting something is unexploited — the fastest way to discredit this
skill's output is citing an opportunity that's already been built).

**Pattern extension (high confidence, low effort)**:
```
Faceted search/filtering for [entity B], matching what [entity A] already has

What: [Entity A]'s list endpoint has a rich filter/facet pipeline (categories, ranges, status buckets).
[Entity B]'s list endpoint has only basic sorting/pagination, despite having comparably rich attributes.

Why: Users would benefit from discovering [entity B] the same faceted way they already discover [entity A].

Effort: 1 day (reuse the existing facet-pipeline pattern, apply it to [entity B]'s endpoint)
Confidence: High (proven pattern, same underlying data-access layer)
Impact: Medium (enables a comparable discovery feature for [entity B])
```

**Bidirectional relationship**:
```
Reverse relationship: [related entities]

What: Currently, from [entity A] you can fetch its [related entity B]s, but there's no reverse lookup —
"which [entity A]s relate to this [entity B]".

Why: The underlying data supports it; the relationship just isn't exposed in the other direction. A
"related/similar" feature would multiply the value of data already being collected.

Effort: 2 days (new aggregation building the reverse index; caching if it's expensive)
Confidence: Medium (requires new pipeline design, not just reuse)
Impact: High (enables discovery/navigation that doesn't exist today)
```

**Unexploited data**:
```
[Field] is stored but never returned

What: [Entity]'s persisted schema has a [field] that's populated at write time, but the read
endpoint/serializer doesn't include it. Confirmed live by reading the actual serialization code, not
assumed.

Why: Either (a) it was collected speculatively and isn't reliable, or (b) it's reliable but was simply
never wired into the response. If (b), it's a small, low-risk feature.

Effort: 0.5 days (if confirmed reliable)
Confidence: High (data already present, just unsurfaced)
Impact: Low-to-medium depending on how visible/useful the field is
```

**Automation opportunity**:
```
Scheduled refresh instead of manual-only

What: Users can manually trigger a refresh/re-fetch of [entity]'s data. The system already tracks when it
was last updated, and infrastructure for background/async work already exists somewhere in the codebase.

Why: Rather than waiting for users to remember to refresh, background jobs could refresh anything stale
past a threshold — surfacing fresher data automatically.

Effort: 2 days (scheduler + background-job wiring, but the underlying refresh logic already exists)
Confidence: High (extends an existing manual flow rather than inventing a new one)
Impact: Medium (improves data freshness, reduces user friction)
Dependencies: Validate the background-job infrastructure can handle the added throughput.
```

## Output Format

A report with:
- **Analysis date & scope** (what was looked at)
- **Pattern inventory summary** (counts: endpoints, entity types, aggregation pipelines, integrations,
  shared utilities)
- **Opportunities by category** (Extension, Gap-fill, Automation, Integration, DX Improvement)
- **Each opportunity** scored and described (what, why, effort, confidence, impact, dependencies)
- **Quick wins** (ideas you could ship this sprint)
- **Strategic bets** (ideas that unlock other features or significantly expand capability)
- **Investigations needed** (ideas that look promising but need a deeper dive before committing)
- **Cross-cutting themes** (if 3+ ideas point to the same platform opportunity, highlight it)

If this repo already has an established convention for recording this kind of analysis (a reports
directory, a template described in its own conventions doc), write it there in that shape. If no such
convention exists, write a dated report somewhere sensible (ask the user where, if it's not obvious)
rather than inventing a new location silently.

## Notes

- This is **not** a wishlist of "nice to have" features — it's ideas grounded in patterns already proven
  in this repo's own code.
- A strong alignment to existing patterns means lower risk and faster shipping.
- Confidence score reflects how directly an idea reuses existing infrastructure, not how hard it would be
  to sell to stakeholders.
- Some ideas will be "interesting but not right now" — that's fine. The point is to know what's *possible*
  without building from scratch.
- Verify every "unexploited" claim against the live codebase before including it — code moves between
  audits, and a stale claim ("X is never surfaced") that's since been fixed undermines the whole report.
