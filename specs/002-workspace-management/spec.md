# Feature Specification: Workspace Management (WS-US)

> **Feature:** SRS §7 WS-US
> **Traceability:** CDM §2.2 (Workspace, WorkspaceMember, WorkspaceInvitation), Flows §8.3
> **Roles:** OWNER, MEMBER
> **Plan:** [plan.md](plan.md)

---

## User Scenarios & Testing *(mandatory)*

### WS-US-01: Create Workspace

**As a** registered user, **I want to** create a workspace, **so that** my money is tracked in a space I control.

### WS-US-02: Invite Member

**As a** workspace OWNER, **I want to** invite someone by email, **so that** we can track shared finances together.

### WS-US-03: Accept/Decline Invitation

**As an** invited person, **I want to** accept or decline an invitation, **so that** I join only the spaces I agree to join.

### WS-US-04: Remove Member

**As a** workspace OWNER, **I want to** remove a member, **so that** people who have left lose access.

### WS-US-05: Change Member Role

**As a** workspace OWNER, **I want to** change a member's role, **so that** responsibility matches the person.

### WS-US-06: View Workspace Members

**As a** workspace member, **I want to** see who else is in the workspace, **so that** I know who can see and record our money.

---

## Acceptance Criteria

**AC-01 — Creating a workspace**
**Given** a verified user supplies a workspace name and a preferred currency,
**When** they submit,
**Then** the workspace is created, the creator becomes its OWNER, and a starting set of categories is provided so transactions can be classified immediately.

**AC-02 — Workspace creation does not leave the page**
**Given** a user is looking at their workspace list,
**When** they choose to create a workspace,
**Then** the form appears over the list rather than navigating to a separate page, and the new workspace appears in the list on success.

**AC-03 — Inviting a person who is not yet a member**
**Given** an OWNER supplies an email address and a role,
**When** they send the invitation,
**Then** a single-use invitation is issued with a bounded expiry and the recipient is notified.

**AC-04 — Inviting an existing member**
**Given** the address already belongs to a member of that workspace,
**When** the OWNER sends the invitation,
**Then** the system refuses and says the person is already a member.

**AC-05 — Only an OWNER may invite**
**Given** a MEMBER attempts to invite someone,
**When** the request is processed,
**Then** it is refused as not permitted.

**AC-06 — Accepting an invitation**
**Given** a valid, unexpired, unprocessed invitation,
**When** the recipient accepts,
**Then** they become a member with the role the invitation carried, and the invitation cannot be used again.

**AC-07 — Declining an invitation**
**Given** a valid, unexpired, unprocessed invitation,
**When** the recipient declines,
**Then** no membership is created and the invitation is closed.

**AC-08 — Expired invitation**
**Given** an invitation past its expiry,
**When** the recipient opens it,
**Then** it is refused as expired and they are told to ask for a new one.

**AC-09 — Already-processed invitation**
**Given** an invitation that has been accepted or declined,
**When** it is used again,
**Then** it is refused as already processed.

**AC-10 — Removing a member**
**Given** an OWNER removes a MEMBER,
**When** the change is applied,
**Then** that person immediately loses access to the workspace while the records they created remain.

**AC-11 — The owner cannot be removed or demoted**
**Given** the target of a removal or role change is the workspace owner,
**When** the request is processed,
**Then** it is refused as an unsupported operation — a workspace always has exactly one owner, and there is no flow that transfers or vacates ownership.

**AC-12 — Changing a member's role**
**Given** an OWNER changes a MEMBER's role to another non-owner role,
**When** the change is applied,
**Then** the member's permissions follow the new role on their next request.

**AC-13 — Viewing members**
**Given** a member opens the member list,
**When** it renders,
**Then** each member's identity, role, and join date are shown.

**AC-14 — Switching workspace never destroys the current view**
**Given** a member is working inside one workspace,
**When** they attempt to switch to a workspace they can no longer open,
**Then** they remain in the current workspace and are told the switch failed, rather than being shown a full-page error.

**AC-15 — Every membership change is recorded**
**Given** any invitation, acceptance, removal, or role change,
**When** it completes or fails,
**Then** an audit record is written with the actor, the target, the outcome, and the source address.

---

### Edge Cases

- **EC-001**: An invitation is sent to an address with no account yet.
- **EC-002**: Two invitations are outstanding for the same address and workspace.
- **EC-003**: A member is removed while they have the workspace open in another tab.
- **EC-004**: The last remaining member is the owner — the workspace cannot be left empty.
- **EC-005**: An invitation is accepted by a signed-in user whose address differs from the invited one.
- **EC-006**: A workspace is deleted while an invitation to it is outstanding.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST let a verified user create a workspace with a name, an optional description, and a preferred currency.
- **FR-002**: The system MUST make the creator the workspace OWNER.
- **FR-003**: The system MUST provide a starting set of categories with a new workspace.
- **FR-004**: The system MUST restrict inviting, removing, and role changes to the OWNER.
- **FR-005**: The system MUST issue single-use invitations that expire after a bounded period.
- **FR-006**: The system MUST refuse an invitation for an address that already belongs to a member of that workspace.
- **FR-007**: The system MUST require the recipient to accept before membership is created.
- **FR-008**: The system MUST allow the recipient to decline, closing the invitation without creating membership.
- **FR-009**: The system MUST distinguish an expired invitation from one already processed.
- **FR-010**: The system MUST refuse any attempt to remove or demote the workspace owner.
- **FR-011**: The system MUST revoke a removed member's access immediately.
- **FR-012**: The system MUST preserve records created by a removed member.
- **FR-013**: The system MUST show every member's identity, role, and join date to any member.
- **FR-014**: The system MUST keep the user in their current workspace when a switch fails, reporting the failure without discarding the current view.
- **FR-015**: The system MUST write an audit record for every membership and invitation event, success or failure.

### Key Entities

- **Workspace**: A space that owns accounts, categories, transactions, budgets, goals, and bills, and declares the currency its figures are reported in.
- **WorkspaceMember**: A person's membership of a workspace, carrying the role that governs what they may do there.
- **WorkspaceInvitation**: A single-use, time-limited offer of membership at a stated role, which the recipient must accept.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new workspace is usable — an account can be created in it — immediately after creation, with no further setup.
- **SC-002**: An invitation cannot be redeemed twice, verified across all accept/decline orderings.
- **SC-003**: No sequence of requests removes or demotes an owner.
- **SC-004**: A removed member's next request is refused, with no cached-permission window.
- **SC-005**: A failed workspace switch never blanks the page; the previous workspace remains on screen in every tested failure mode.
- **SC-006**: Every membership event has a matching audit record, verified across a sample of 50 events.

---

## Assumptions

- Exactly two roles exist: OWNER and MEMBER. There is no custom-role mechanism.
- A workspace has exactly one owner for its lifetime; ownership transfer is not in scope and no story requests it.
- An invitation is addressed to an email, not to an existing account, so it may be sent before the recipient registers.
- Workspace deletion is a soft delete; history is retained.
- Removing a member does not reassign or delete what they recorded.
