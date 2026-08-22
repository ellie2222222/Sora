# Feature Specification: Account Management (ACC-US)

> **Feature:** SRS §7 ACC-US
> **Traceability:** CDM §2.2 (Account), Flows §8.4, BR-07, BR-07a
> **Roles:** MEMBER (create, view) · OWNER (edit, archive)
> **Plan:** [plan.md](plan.md)
> **Test Cases:** [test_cases.md](test_cases.md)

---

## User Scenarios & Testing *(mandatory)*

### ACC-US-01: Create Account

**As a** workspace MEMBER, **I want to** create a financial account with an opening balance and currency, **so that** I can track the money held there.

#### Acceptance Criteria

**AC-01: Creating an account**
**Given** a member supplies a type, a name unused in the workspace, a supported currency and an opening balance,
**When** they submit,
**Then** the account is created with its balance equal to its opening balance.

**AC-02: A new account is immediately usable**
**Given** an account has just been created,
**When** a member records a transaction,
**Then** the new account is available to choose with no further configuration.

**AC-03: Optional detail is stored as given**
**Given** an institution, a masked account number, a colour or an icon is supplied,
**When** the account is created,
**Then** each is stored and returned unchanged; each may equally be omitted.

**AC-04: Any member may create an account**
**Given** a member who is not an OWNER,
**When** they create an account,
**Then** it is permitted — adding an account is not an ownership decision.

**AC-05: A non-member cannot create an account**
**Given** a user who is not a member of the workspace,
**When** they attempt to create an account,
**Then** it is refused as not permitted; a workspace that does not exist is refused as not found.

**AC-06: A name must be unused in the workspace**
**Given** an active account already carries the submitted name,
**When** the member submits,
**Then** the creation is refused as the name being taken, and no second account exists.

**AC-07: Name uniqueness ignores letter case**
**Given** an active account named in one case,
**When** the same name is submitted in another case,
**Then** it is refused as taken, because two accounts distinguished only by capitalisation cannot be told apart in a list.

**AC-08: Uniqueness is scoped to the workspace**
**Given** an account of that name exists in a different workspace,
**When** the member submits,
**Then** it is accepted, because names belong to a workspace and not to the system.

**AC-09: An archived account's name is free again**
**Given** an account of that name exists but is archived,
**When** the name is submitted for a new account,
**Then** it is accepted — the archived one is out of the active list, so the name is no longer ambiguous.

**AC-10: A name is required and bounded**
**Given** an empty name, or one longer than the stored length,
**When** the member submits,
**Then** it is refused with a validation error naming the field.

**AC-11: Only a known account type is accepted**
**Given** a type outside the fixed set the system defines,
**When** the member submits,
**Then** it is refused; members cannot invent a type.

**AC-12: Only a supported currency is accepted**
**Given** a currency outside the supported set,
**When** the member submits,
**Then** it is refused as unsupported.

**AC-13: The form never asks for an exchange rate**
**Given** the chosen currency differs from the workspace reporting currency,
**When** the member fills the form,
**Then** no rate is requested; the form states that the system will determine it.

**AC-14: A rate is captured on the account**
**Given** the account's currency differs from the reporting currency,
**When** the account is created,
**Then** the rate prevailing at that moment is stored on the account and used to express its opening balance in the reporting currency.

**AC-15: A matching currency needs no rate**
**Given** the account's currency equals the reporting currency,
**When** the account is created,
**Then** its stored rate is exactly one and no external rate source is consulted.

**AC-16: A rate that cannot be obtained refuses the creation**
**Given** a rate is required and none can be obtained,
**When** the member submits,
**Then** no account is created and the member is told the rate is unavailable and may retry.

**AC-17: The opening balance's reported value is fixed**
**Given** an account created in a foreign currency,
**When** rates move afterwards,
**Then** the reported value of its opening balance is unchanged, because it was fixed by the rate stored at creation.

**AC-18: An opening balance of zero is accepted**
**Given** an opening balance of zero,
**When** the account is created,
**Then** it is accepted and the account is fully usable — a new, empty account is the ordinary case.

**AC-19: An opening balance is bounded in precision and magnitude**
**Given** an opening balance carrying more precision than the minor unit, or more digits than the system stores,
**When** the member submits,
**Then** it is refused rather than rounded or truncated.

**AC-20: A negative opening balance is refused**
**Given** an opening balance below zero,
**When** the member submits,
**Then** it is refused. An account that is already overdrawn is recorded by opening at zero and recording the debt as a transaction, so that the debt is dated and classified. *(The form enforces this; the API does not yet — see [plan.md](plan.md) G6.)*

**AC-21: Success closes the form and shows the account**
**Given** a creation succeeds,
**When** the response arrives,
**Then** the form closes and the list shows the new account, its balance and the workspace total, without a page reload.

**AC-22: Every creation attempt is audited**
**Given** any attempt to create an account, successful or refused,
**When** it completes,
**Then** an audit record is written naming the actor, the outcome, the account where one was created, the source address, and the reason on refusal.

---

### ACC-US-02: View Account Details

**As a** workspace member, **I want to** see an account's balance and history, **so that** I understand my position.

#### Acceptance Criteria

**AC-23: The list shows every account with its balance**
**Given** a workspace with several accounts,
**When** a member opens the list,
**Then** each account appears with its current balance.

**AC-24: A balance is stated in the account's own currency**
**Given** an account in any supported currency,
**When** its balance renders,
**Then** it is formatted in that account's currency — the figure a member can check against their statement.

**AC-25: A foreign balance also shows its reported equivalent**
**Given** an account whose currency differs from the reporting currency,
**When** its balance renders,
**Then** the equivalent in the reporting currency appears alongside, marked as an approximate equivalent rather than presented as the balance.

**AC-26: No equivalent is shown when the currencies match**
**Given** an account in the reporting currency,
**When** its balance renders,
**Then** no equivalent line appears, because repeating the same figure only adds noise.

**AC-27: Active accounts come before archived ones**
**Given** a workspace with both,
**When** the list renders,
**Then** active accounts are listed first and accounts within each group are ordered by name, so the list opens on what is in use.

**AC-28: Each field in a row is individually identifiable**
**Given** a row carrying a name, a type, a currency, an institution and a masked number,
**When** it renders,
**Then** each is separately labelled, badged or iconed, so no two can be mistaken for one another.

**AC-29: The name leads the row**
**Given** any row,
**When** it renders,
**Then** the name is the only field in strong type, because it is what a member scans for.

**AC-30: An archived account is marked as such**
**Given** an archived account in the list,
**When** it renders,
**Then** it carries an archived marker and is visually subdued.

**AC-31: The list carries a total**
**Given** a workspace with accounts in more than one currency,
**When** the list renders,
**Then** a total is shown in the reporting currency, each account converted at the rate stored on it.

**AC-32: The total agrees with the dashboard**
**Given** the accounts list total and the dashboard's total balance,
**When** both are read for the same workspace,
**Then** they agree, because a member reading two screens must not find two different answers to the same question. *(They currently disagree whenever an account is archived — see [plan.md](plan.md) G7.)*

**AC-33: Figures are comparable at a glance**
**Given** a column of balances,
**When** they render,
**Then** digits align across rows so magnitudes can be compared without reading each number.

**AC-34: The list can be narrowed to active or archived**
**Given** a member wants only what is in use, or only what is closed,
**When** they ask for one or the other,
**Then** only accounts in that state are returned.

**AC-35: The list is paginated and reports its total**
**Given** more accounts than one page holds,
**When** a page is requested,
**Then** that page is returned with the total count, the page position, the page size used, and whether more remain.

**AC-36: An out-of-range page request does not fail**
**Given** a page below one, a page size below one, or a page size above the maximum,
**When** the request is processed,
**Then** it is brought within bounds and answered, rather than failing. *(A page below one currently fails — see [plan.md](plan.md) G8.)*

**AC-37: A single account can be retrieved on its own**
**Given** an account reference,
**When** it is requested,
**Then** that account is returned with its type, name, currency, balance, opening balance, stored rate and state.

**AC-38: An account of another workspace is not retrievable**
**Given** an account belonging to a different workspace,
**When** it is requested through this workspace,
**Then** it is refused as not found, revealing nothing about the other workspace.

**AC-39: An archived account remains readable**
**Given** an archived account,
**When** it is requested,
**Then** it is returned, marked archived — archiving hides an account from choices, it does not withdraw it from view.

**AC-40: An account's own movements can be reviewed**
**Given** a member wants to understand how a balance arose,
**When** they open the account,
**Then** its recent movements are listed with their dates and amounts. *(Not yet implemented: the transaction history is filterable by account through the history screen, but no per-account view exists — see [plan.md](plan.md) G9.)*

**AC-41: An empty workspace explains itself**
**Given** a workspace with no accounts,
**When** the list renders,
**Then** it explains that accounts appear here and offers to create the first one, rather than showing an empty table.

**AC-42: A non-member cannot read accounts**
**Given** a user who is not a member,
**When** they request the list or a single account,
**Then** it is refused as not permitted.

---

### ACC-US-03: Edit Account

**As a** workspace OWNER, **I want to** correct an account's name, institution, or masked number, **so that** the list stays accurate as banks and labels change.

#### Acceptance Criteria

**AC-43: Name, institution and masked number may change**
**Given** an existing account,
**When** an OWNER edits it,
**Then** its name, institution and masked number take the values supplied.

**AC-44: Type, currency and opening balance may not change**
**Given** an existing account,
**When** any request attempts to change its type, currency or opening balance,
**Then** the stored values are unchanged — there is no request that alters them.

**AC-45: The fixed fields are shown with their real values**
**Given** the edit form,
**When** it renders,
**Then** the type, currency and opening balance appear filled with the account's actual values and disabled, so the account is recognisable without being alterable. *(The opening balance currently renders as zero — see [plan.md](plan.md) G10.)*

**AC-46: The form says why those fields are fixed**
**Given** the edit form,
**When** it renders,
**Then** it states which fields cannot change, and for the currency it directs the member to the workspace reporting currency instead.

**AC-47: An account's currency is never editable anywhere**
**Given** a member who wants their figures in the other currency,
**When** they look for a way to change an account's currency,
**Then** none exists on any screen or in any request, because the balance, the opening balance and the stored rate are all denominated in it and none of them can be restated.

**AC-48: Only an OWNER may edit**
**Given** a member who is not an OWNER,
**When** they submit an edit,
**Then** it is refused as not permitted.

**AC-49: A non-owner is not offered the control**
**Given** a member who is not an OWNER,
**When** the list renders,
**Then** no edit control appears on any row, because offering an action that will be refused is a defect in the interface. *(Currently shown to every member — see [plan.md](plan.md) G11.)*

**AC-50: A non-member cannot edit**
**Given** a user who is not a member,
**When** they submit an edit,
**Then** it is refused as not permitted.

**AC-51: Renaming to a name in use is refused**
**Given** another active account already carries the new name,
**When** the OWNER saves,
**Then** it is refused as the name being taken and nothing changes.

**AC-52: Saving an unchanged name is accepted**
**Given** an edit that resubmits the account's current name,
**When** it is saved,
**Then** it is accepted — an account does not collide with itself.

**AC-53: Changing only the letter case of a name is accepted**
**Given** an edit that recapitalises the account's own name,
**When** it is saved,
**Then** it is accepted and the new capitalisation is stored.

**AC-54: Taking an archived account's name is accepted**
**Given** an archived account carrying the new name,
**When** an active account is renamed to it,
**Then** it is accepted, consistently with creating a new account under that name.

**AC-55: An archived account cannot be edited**
**Given** an archived account,
**When** an edit is submitted,
**Then** it is refused as archived; a closed account is a historical record.

**AC-56: An unknown account cannot be edited**
**Given** an account reference matching nothing in this workspace,
**When** an edit is submitted,
**Then** it is refused as not found.

**AC-57: An account of another workspace cannot be edited**
**Given** an account belonging to a different workspace,
**When** an edit is submitted through this workspace,
**Then** it is refused as not found and the other account is untouched.

**AC-58: An unmentioned field is left alone**
**Given** an edit that omits a field,
**When** it is applied,
**Then** that field keeps its current value.

**AC-59: An institution or masked number can be emptied**
**Given** an account carrying an institution or a masked number,
**When** an edit supplies empty text for it,
**Then** it becomes empty — a member who no longer wants a label must be able to remove it. *(Currently an empty value is treated as "leave alone" — see [plan.md](plan.md) G12.)*

**AC-60: An edit never changes the balance**
**Given** any edit,
**When** it completes,
**Then** the account's balance and opening balance are unchanged, because relabelling an account moves no money.

**AC-61: An edit never changes the stored rate**
**Given** any edit,
**When** it completes,
**Then** the stored rate and the reported value of the opening balance are exactly as before.

**AC-62: A successful edit closes the form and shows the change**
**Given** an edit succeeds,
**When** the response arrives,
**Then** the form closes and the row shows the new values without a page reload.

**AC-63: A refused edit keeps the form open**
**Given** an edit is refused,
**When** the response arrives,
**Then** the form stays open, states the reason, and keeps what the member typed.

**AC-64: Every edit is audited with what changed**
**Given** any edit attempt, successful or refused,
**When** it completes,
**Then** an audit record is written naming the actor, the account, the outcome, and — where the name changed — its old and new values.

---

### ACC-US-04: Archive Account

**As a** workspace OWNER, **I want to** archive a closed account, **so that** it leaves the active list while its history remains.

#### Acceptance Criteria

**AC-65: Archiving withdraws the account from new recording**
**Given** an account is archived,
**When** a member records a transaction,
**Then** the archived account is not among the accounts offered.

**AC-66: An archived account stays visible**
**Given** an archived account,
**When** the list renders,
**Then** it is present and marked archived, so a member can still see the account existed.

**AC-67: Its history is untouched**
**Given** an account with recorded transactions,
**When** it is archived,
**Then** every transaction against it remains exactly as it was.

**AC-68: Its balance is untouched**
**Given** an account with a balance,
**When** it is archived,
**Then** the balance is unchanged — archiving is not a withdrawal.

**AC-69: Recording against an archived account is refused**
**Given** an archived account,
**When** a transaction is submitted against it,
**Then** it is refused as archived, distinguishably from an account that does not exist.

**AC-70: Transferring to or from an archived account is refused**
**Given** an archived account on either side of a transfer,
**When** it is submitted,
**Then** the whole transfer is refused and neither side is created.

**AC-71: Archiving is confirmed first**
**Given** a member starts an archive,
**When** the confirmation appears,
**Then** it names the account and states its balance, so the right account is being closed.

**AC-72: The confirmation can be abandoned**
**Given** the confirmation is open,
**When** the member declines or dismisses it,
**Then** nothing is archived.

**AC-73: A refused archive does not look successful**
**Given** an archive attempt is refused by the system,
**When** the refusal returns,
**Then** the confirmation stays open showing the reason and the account remains active in the list.

**AC-74: Only an OWNER may archive**
**Given** a member who is not an OWNER,
**When** they submit an archive,
**Then** it is refused as not permitted.

**AC-75: A non-owner is not offered the control**
**Given** a member who is not an OWNER,
**When** the list renders,
**Then** no archive control appears on any row. *(Currently shown to every member — see [plan.md](plan.md) G11.)*

**AC-76: A non-member cannot archive**
**Given** a user who is not a member,
**When** they submit an archive,
**Then** it is refused as not permitted.

**AC-77: Archiving twice is refused**
**Given** an already-archived account,
**When** an archive is attempted again,
**Then** it is refused as already archived.

**AC-78: An unknown account cannot be archived**
**Given** an account reference matching nothing in this workspace,
**When** an archive is attempted,
**Then** it is refused as not found.

**AC-79: An account of another workspace cannot be archived**
**Given** an account belonging to a different workspace,
**When** an archive is attempted through this workspace,
**Then** it is refused as not found and the other account stays active.

**AC-80: Archiving cannot be undone**
**Given** an archived account,
**When** a member looks for a way to restore it,
**Then** none is offered on any screen or in any request; a new account is created instead.

**AC-81: An archived account's history still counts**
**Given** an archived account with recorded transactions,
**When** the workspace's figures are computed,
**Then** its transactions and its opening balance still contribute, because the money was real and the totals must still agree with their own rows.

**AC-82: The last account may be archived**
**Given** a workspace whose only account is archived,
**When** a member opens the transaction screen,
**Then** it explains that an account is needed and offers the way to create one, rather than presenting a form that cannot be submitted.

**AC-83: The moment of archiving is recorded**
**Given** an account is archived,
**When** the stored row is examined,
**Then** the time it was archived is recorded, and that is what marks it archived.

**AC-84: Every archive attempt is audited**
**Given** any archive attempt, successful or refused,
**When** it completes,
**Then** an audit record is written naming the actor, the account, the outcome, the source address and the reason on refusal. *(A repeated archive is currently refused without an audit record — see [plan.md](plan.md) G13.)*

---

### Edge Cases

- **EC-001**: An account is archived while another member has a transaction form open against it.
- **EC-002**: An account name is reused after the original account was archived.
- **EC-003**: An opening balance of zero — the account must still be usable.
- **EC-004**: The reporting currency changes after the account was created.
- **EC-005**: The last active account in a workspace is archived, leaving nowhere to record transactions.
- **EC-006**: Two members create an account with the same name at the same moment.
- **EC-007**: A workspace holds more accounts than one page returns.
- **EC-008**: An account carrying a negative balance is archived.
- **EC-009**: An account is archived while an OWNER has its edit form open.
- **EC-010**: An account is created while the rate source is degraded and a recent rather than live rate is used.
- **EC-011**: An account name differing from an existing one only by surrounding whitespace.
- **EC-012**: A masked account number containing separators or letters rather than only digits.
- **EC-013**: A workspace where every account is archived.
- **EC-014**: An account whose currency equals the reporting currency at creation, which is later changed so it no longer does.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST let any member create an account with a type, a name, a supported currency and an opening balance, plus an optional institution, masked number, colour and icon.
- **FR-002**: The system MUST set a new account's balance equal to its opening balance.
- **FR-003**: The system MUST make a newly created account immediately available for recording.
- **FR-004**: The system MUST enforce account-name uniqueness within a workspace, ignoring letter case.
- **FR-005**: The system MUST scope name uniqueness to the workspace, and MUST NOT count archived accounts against it.
- **FR-006**: The system MUST require a name and bound its length.
- **FR-007**: The system MUST accept only the account types it defines, and only supported currencies.
- **FR-008**: The system MUST NOT accept an exchange rate from any client on any account operation.
- **FR-009**: The system MUST determine the rate between the account's currency and the reporting currency itself and store it on the account, using exactly one — with no external lookup — when they match.
- **FR-010**: The system MUST refuse the creation, storing nothing, when a required rate cannot be determined.
- **FR-011**: The system MUST fix the reported value of the opening balance at creation so later rate movements do not restate it.
- **FR-012**: The system MUST accept an opening balance of zero and MUST refuse one below zero.
- **FR-013**: The system MUST bound the opening balance's precision to the minor unit and its magnitude to what it stores.
- **FR-014**: The system MUST state each balance in the account's own currency, with the reported equivalent alongside only where the currencies differ.
- **FR-015**: The system MUST show a workspace total in the reporting currency that covers the same accounts as the dashboard's total balance.
- **FR-016**: The system MUST order active accounts before archived ones, and order within each group by name.
- **FR-017**: The system MUST present each field of a row distinctly, with the name as the only emphasised field, and MUST mark archived accounts.
- **FR-018**: The system MUST allow the list to be narrowed to active or to archived accounts.
- **FR-019**: The system MUST paginate the account list, reporting the total count, the page position, the page size used and whether more remain.
- **FR-020**: The system MUST bring an out-of-range page or page size within bounds rather than failing.
- **FR-021**: The system MUST allow a single account to be retrieved, MUST keep an archived one retrievable, and MUST refuse one belonging to another workspace as not found.
- **FR-022**: The system MUST let a member review an individual account's own movements.
- **FR-023**: The system MUST explain an empty account list and offer the creation of the first account.
- **FR-024**: The system MUST allow an OWNER to change an account's name, institution and masked number, and MUST allow those to be emptied.
- **FR-025**: The system MUST prevent any change to an account's type, currency or opening balance after creation, in the request contract and not merely by ignoring the values.
- **FR-026**: The system MUST show the immutable fields, populated with their actual values and disabled, and MUST state why they are fixed and where the reporting currency is changed instead.
- **FR-027**: The system MUST restrict editing and archiving to an OWNER, and MUST NOT offer either control to a member who cannot use it.
- **FR-028**: The system MUST leave an unmentioned field unchanged on an edit.
- **FR-029**: The system MUST leave the balance, the opening balance and the stored rate unchanged by an edit.
- **FR-030**: The system MUST refuse an edit of an archived account, of an unknown account, and of an account in another workspace.
- **FR-031**: The system MUST withdraw an archived account from the accounts offered for new transactions and MUST refuse any recording or transfer against it.
- **FR-032**: The system MUST keep an archived account visible and marked, with its balance and its history untouched.
- **FR-033**: The system MUST record the moment an account was archived, and MUST treat that as what marks it archived.
- **FR-034**: The system MUST require confirmation before archiving, naming the account and its balance, and MUST allow the confirmation to be abandoned.
- **FR-035**: The system MUST leave the account active and report the reason when an archive is refused.
- **FR-036**: The system MUST refuse archiving an already-archived account.
- **FR-037**: The system MUST NOT provide any means of restoring an archived account.
- **FR-038**: The system MUST continue to count an archived account's opening balance and transactions in the workspace's figures.
- **FR-039**: The system MUST write an audit record for every account creation, edit and archive, successful or refused, including the old and new name where a name changed.

### Key Entities

- **Account**: A place money is held — cash, a bank account, a card, savings, an investment, crypto, or a digital wallet — carrying its own currency, an opening balance, a current balance, the rate that converts it into the reporting currency, the reported value of its opening balance, and an active or archived state.
- **Archived state**: The moment an account was closed. It withdraws the account from new recording without withdrawing it from view or from the totals.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A newly created account can receive a transaction with no further configuration.
- **SC-002**: No request sequence changes an existing account's currency, type or opening balance.
- **SC-003**: An archived account never appears among the accounts offered for a new transaction.
- **SC-004**: A refused archive leaves the account active in every tested failure mode, with the reason shown.
- **SC-005**: Two accounts in one workspace never share a name, compared without regard to case, across a 100-operation sequence of creations and renames.
- **SC-006**: Every account mutation has a matching audit record across a sample of 50 operations.
- **SC-007**: The accounts list total equals the dashboard's total balance, within one minor unit, for every tested workspace including those with archived accounts.
- **SC-008**: A rate movement changes no account's reported opening balance.
- **SC-009**: No refused creation leaves an account behind, verified by the account count being unchanged after each refusal path.
- **SC-010**: An archived account's transactions contribute the same figures to every summary before and after archiving.
- **SC-011**: Every list response reports a page size within the documented bounds, whatever was requested, and no page request produces a server error.
- **SC-012**: Every action a member is offered succeeds for that member — no control is displayed that its viewer's role would have refused.

---

## Assumptions

- Account numbers are intended to be partial — a recognisable fragment, not a usable credential — and the field is stored verbatim with no shape imposed, because masking formats vary by institution. The system does not itself mask or truncate what it is given, so nothing prevents a member from storing a full number; that is a gap rather than a design choice (see [plan.md](plan.md) G4).
- Archiving is the only removal; accounts are never hard-deleted, because transactions reference them.
- An account's opening balance is a statement of fact at creation time and is not revisable — a correction is made by recording a transaction, so the correction is dated.
- The set of account types is fixed; members cannot define new ones.
- Negative *balances* are permitted — a credit card is expected to carry one — while the *opening* balance is constrained to be non-negative.
- An account belongs to exactly one workspace and is never moved between workspaces.
- Creating an account is a member-level action, while editing and archiving are ownership decisions, because those change or withdraw something others depend on.
- The reported equivalent shown beside a foreign balance is an approximation for orientation; the dashboard's per-account figure is the authoritative one, because it converts each movement at the rate that movement was recorded at.
- Two accounts of the same type at the same institution are ordinary, so nothing beyond the name is required to be unique.
- Colour and icon are presentation only and carry no meaning the system reasons about.
- Archiving is not reversible; a member who archived in error creates a new account and the history of both remains.
