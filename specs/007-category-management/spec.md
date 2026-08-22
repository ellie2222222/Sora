# Feature Specification: Categories & Configuration (CAT-US)

> **Feature:** SRS §7 CAT-US
> **Traceability:** CDM §2.2 (Category), Flows §8.4
> **Roles:** OWNER (manage), MEMBER (use)
> **Plan:** [plan.md](plan.md)

---

## User Scenarios & Testing *(mandatory)*

### CAT-US-01: Create Category

**As a** workspace OWNER, **I want to** add a category, **so that** transactions can be classified the way our household actually thinks about money.

### CAT-US-02: Edit Category

**As a** workspace OWNER, **I want to** rename a category, **so that** a label can be corrected without losing the transactions filed under it.

### CAT-US-03: Archive Category

**As a** workspace OWNER, **I want to** archive a category we no longer use, **so that** it stops being offered without disturbing past records.

### CAT-US-04: View Categories

**As a** workspace member, **I want to** see the categories available, **so that** I classify transactions consistently.

---

## Acceptance Criteria

**AC-01 — A new workspace already has categories**
**Given** a workspace has just been created,
**When** its owner records the first transaction,
**Then** a usable set of income and expense categories is already available, without any setup step.

**AC-02 — Creating a category**
**Given** an OWNER supplies a name and states whether it classifies income or expense,
**When** they submit,
**Then** the category becomes available for transactions of that direction.

**AC-03 — Duplicate name**
**Given** a category with the same name already exists in the workspace,
**When** the OWNER submits,
**Then** the system refuses and says the name is taken.

**AC-04 — Only an OWNER may manage categories**
**Given** a MEMBER attempts to create, rename, or archive a category,
**When** the request is processed,
**Then** it is refused as not permitted, while the member may still use existing categories.

**AC-05 — Renaming**
**Given** an OWNER renames a category,
**When** they save,
**Then** transactions already classified with it show the new name, because they reference the category rather than a copy of its text.

**AC-06 — A category's direction never changes**
**Given** an OWNER opens a category for editing,
**When** the form renders,
**Then** whether it classifies income or expense is shown but cannot be changed — changing it would silently reclassify every transaction filed under it.

**AC-07 — Archiving**
**Given** an OWNER archives a category,
**When** the change applies,
**Then** it stops being offered for new transactions, remains visible marked as archived, and stays attached to the transactions that already use it.

**AC-08 — Archiving is confirmed first**
**Given** an OWNER clicks to archive a category,
**When** the action is about to run,
**Then** they are asked to confirm, shown which category, and told that existing transactions keep it.

**AC-09 — A category in use cannot be removed outright**
**Given** transactions are classified with a category,
**When** an OWNER tries to remove it,
**Then** only archiving is available, so history is never orphaned.

**AC-10 — A failed archive does not look successful**
**Given** an archive attempt is refused,
**When** the refusal returns,
**Then** the confirmation stays open with the reason, and the category remains active in the list.

**AC-11 — Categories are offered by direction**
**Given** a member is recording a transaction,
**When** they choose a category,
**Then** only categories matching the direction of the transaction type are offered.

**AC-12 — Listing**
**Given** a member opens the category list,
**When** it renders,
**Then** categories are grouped by income and expense, with archived ones marked and default ones identifiable.

---

### Edge Cases

- **EC-001**: A category is archived while another member has the transaction form open with it selected.
- **EC-002**: A name is reused after the original category was archived.
- **EC-003**: Every expense category is archived, leaving nothing to classify an expense with.
- **EC-004**: A default seeded category is renamed.
- **EC-005**: A transaction's category is cleared, leaving it unclassified.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a starting set of income and expense categories with every new workspace.
- **FR-002**: The system MUST let an OWNER create a category with a name and a direction.
- **FR-003**: The system MUST enforce category-name uniqueness within a workspace.
- **FR-004**: The system MUST restrict creating, renaming, and archiving to an OWNER.
- **FR-005**: The system MUST let any member use any active category.
- **FR-006**: The system MUST let an OWNER rename a category, with existing transactions reflecting the new name.
- **FR-007**: The system MUST prevent a category's direction from changing after creation.
- **FR-008**: The system MUST offer only direction-matching categories when a transaction is being classified.
- **FR-009**: The system MUST exclude archived categories from the choices for new transactions.
- **FR-010**: The system MUST keep archived categories attached to the transactions that already reference them.
- **FR-011**: The system MUST require confirmation before archiving, naming the category.
- **FR-012**: The system MUST leave a category active and report the reason when an archive attempt fails.
- **FR-013**: The system MUST allow a transaction to carry no category.
- **FR-014**: The system MUST write an audit record for every category creation, rename, and archive, including failures.

### Key Entities

- **Category**: A label that classifies transactions in one direction — income or expense — scoped to a single workspace, and either active or archived.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A workspace created moments ago can classify both an income and an expense transaction with no category setup.
- **SC-002**: An archived category never appears among the choices for a new transaction.
- **SC-003**: No request sequence changes an existing category's direction.
- **SC-004**: Renaming a category updates every place it appears, with no stale copies of the old text.
- **SC-005**: A refused archive leaves the category active in every tested failure mode, with the reason shown.

---

## Assumptions

- Categories are flat; there is no sub-category hierarchy.
- Categories belong to one workspace and are never shared between workspaces.
- Colour and icon are decoration and carry no rule.
- The seeded set is a convenience, not a fixed taxonomy: seeded categories may be renamed and archived like any other.
- A transaction may be unclassified; classification is a convenience, not an integrity requirement.
