# Feature Specification: Transaction Management (TXN-US)

> **Feature:** SRS §7 TXN-US
> **Traceability:** CDM §2.2 (Transaction), Flows §8.4, BR-03, BR-07, BR-07a
> **Roles:** MEMBER, OWNER
> **Plan:** [plan.md](plan.md)
> **Test Cases:** [test_cases.md](test_cases.md)

---

## User Scenarios & Testing *(mandatory)*

### TXN-US-01: Record Income Transaction

**As a** workspace MEMBER, **I want to** record money coming in, **so that** my balances and reports reflect it.

#### Acceptance Criteria

**AC-01: Recording money arriving**
**Given** a member supplies an active account, an arriving type, a positive amount and a date,
**When** they submit,
**Then** the transaction is recorded and that account's balance increases by the amount.

**AC-02: Which types mean money arriving**
**Given** a transaction of an arriving type — money earned, money returned, or money borrowed in,
**When** it is recorded,
**Then** it increases its account's balance, and the type is preserved so the reason for the arrival is not lost.

**AC-03: The amount is stored positive and the direction carries the sign**
**Given** any recorded transaction,
**When** the stored row is examined,
**Then** the amount is positive and a separate stored value states whether the balance went up or down.

**AC-04: The record and the balance change are one indivisible step**
**Given** a recording is in progress,
**When** any part of it fails,
**Then** neither the transaction nor the balance change survives — there is no state in which one exists without the other.

**AC-05: The transaction takes its account's currency**
**Given** an account denominated in one of the supported currencies,
**When** a transaction is recorded against it,
**Then** the transaction carries that account's currency.

**AC-06: The member is never asked to choose a currency**
**Given** the recording form,
**When** it renders,
**Then** it offers no currency choice; the currency is shown as a consequence of the account chosen.

**AC-07: A rate is captured on the row at recording time**
**Given** the account's currency differs from the workspace reporting currency,
**When** the transaction is recorded,
**Then** the rate prevailing at that moment is stored on the row and used for reporting only, so later rate movements never restate it.

**AC-08: A matching currency needs no rate and no external call**
**Given** the account's currency equals the reporting currency,
**When** the transaction is recorded,
**Then** its stored rate is exactly one and no external rate source is consulted.

**AC-09: The conversion is previewed before committing**
**Given** the account's currency differs from the reporting currency,
**When** the member has entered an amount,
**Then** the rate the system will apply and the resulting reported amount are shown, from the same source the write will use.

**AC-10: A failed preview does not block recording**
**Given** the preview cannot be obtained,
**When** the member continues,
**Then** the form warns that the rate could not be previewed but still allows submission, because the stored rate is resolved on the server regardless.

**AC-11: A rate that cannot be obtained refuses the write outright**
**Given** a rate is required and none can be obtained by any means,
**When** the member submits,
**Then** nothing is recorded, no balance moves, and the member is told the rate is unavailable and may retry.

**AC-12: Zero or a negative amount is refused**
**Given** an amount of zero or less,
**When** the member submits,
**Then** the transaction is refused as an invalid amount and nothing is recorded.

**AC-13: More than two decimal places is refused**
**Given** an amount carrying more precision than the minor unit of its currency,
**When** the member submits,
**Then** it is refused rather than silently rounded.

**AC-14: An amount beyond the supported magnitude is refused**
**Given** an amount with more digits than the system stores,
**When** the member submits,
**Then** it is refused rather than truncated or overflowed.

**AC-15: An unknown account is refused as not found**
**Given** an account reference matching no account,
**When** the member submits,
**Then** the transaction is refused as account not found.

**AC-16: An archived account is refused as archived**
**Given** an archived account,
**When** the member submits,
**Then** the transaction is refused, distinguishing "archived" from "not found" so the member knows the account exists.

**AC-17: An account of another workspace is indistinguishable from absent**
**Given** an account that exists but belongs to a different workspace,
**When** the member submits,
**Then** it is refused as not found, revealing nothing about the other workspace.

**AC-18: A category from another workspace is refused**
**Given** a category that does not belong to this workspace,
**When** the member submits,
**Then** the transaction is refused as category not found.

**AC-19: Recording without a category is allowed**
**Given** no category is chosen,
**When** the transaction is recorded,
**Then** it is accepted and presented as unclassified rather than blank, so the absence reads as deliberate.

**AC-20: Only categories of the matching direction are offered**
**Given** an arriving type is chosen,
**When** the category list renders,
**Then** it offers only arriving-side categories, and changing the type changes the list.

**AC-21: A date is required, and a future date is accepted**
**Given** a member records something known in advance,
**When** they choose a date later than today,
**Then** it is accepted; a transaction with no date at all is refused.

**AC-22: Optional detail is recorded verbatim**
**Given** a description, a note, tags, a receipt reference or a location is supplied,
**When** the transaction is recorded,
**Then** each is stored as given and returned unchanged; each may equally be omitted.

**AC-23: A non-member cannot record anything**
**Given** a user who is not a member of the workspace,
**When** they attempt to record a transaction,
**Then** it is refused as not permitted, and a workspace that does not exist is refused as not found.

**AC-24: Every recording attempt is audited**
**Given** any attempt to record, successful or refused,
**When** it completes,
**Then** an audit record is written naming the actor, the outcome, the entities involved, the source address, and — on refusal — the reason.

---

### TXN-US-02: Record Expense Transaction

**As a** workspace MEMBER, **I want to** record money going out, **so that** I can see where it went.

#### Acceptance Criteria

**AC-25: Recording money leaving**
**Given** a member supplies an active account, a leaving type, a positive amount and a date,
**When** they submit,
**Then** the transaction is recorded and that account's balance decreases by the amount, in one indivisible step.

**AC-26: Which types mean money leaving**
**Given** a transaction of a leaving type — money spent, money invested, or money lent out,
**When** it is recorded,
**Then** it decreases its account's balance, and the type is preserved.

**AC-27: Borrowed and lent move opposite ways**
**Given** money borrowed in and money lent out,
**When** each is recorded,
**Then** the borrowing increases the account and the lending decreases it — the two are never treated alike merely because both concern a debt.

**AC-28: An expense may take a balance below zero**
**Given** an expense larger than the account's balance,
**When** it is recorded,
**Then** it is accepted and the balance becomes negative, because the system records what happened rather than policing an overdraft.

**AC-29: A leaving amount is still stored positive**
**Given** a recorded expense,
**When** the stored row is examined,
**Then** its amount is positive and only its direction marks it as leaving.

**AC-30: A foreign-currency expense keeps its own figure**
**Given** an expense in a currency other than the reporting currency,
**When** it is shown,
**Then** the figure in the account's own currency is the primary one — the figure a member can check against their statement — with the reported equivalent alongside.

**AC-31: Only leaving-side categories are offered for an expense**
**Given** a leaving type is chosen,
**When** the category list renders,
**Then** only leaving-side categories appear.

**AC-32: An archived account refuses an expense too**
**Given** an archived account,
**When** an expense is submitted against it,
**Then** it is refused as archived and no balance moves.

**AC-33: The expense reaches the summaries immediately**
**Given** an expense is recorded,
**When** the dashboard and the day's subtotal are next computed,
**Then** both include it without any further action.

**AC-34: The row reads as an outflow**
**Given** an expense row in the history,
**When** it renders,
**Then** its amount is signed and coloured as leaving, distinguishable at a glance from an arriving row.

**AC-35: Transfer is not an option on the ordinary form**
**Given** the recording form,
**When** the type list renders,
**Then** transfer is absent, because a transfer needs a second account and is recorded through its own operation.

**AC-36: A transfer submitted to the ordinary operation is refused**
**Given** a request that names transfer as the type of an ordinary recording,
**When** it is processed,
**Then** it is refused as an invalid transfer, so a one-sided transfer cannot exist.

**AC-37: A rate failure refuses an expense with nothing stored**
**Given** the account's currency differs from the reporting currency and no rate can be obtained,
**When** the expense is submitted,
**Then** nothing is recorded and the balance is untouched.

**AC-38: A refusal keeps the member's input**
**Given** a submission is refused for any reason,
**When** the response arrives,
**Then** the reason is shown on the form with every field still filled in, so nothing has to be retyped.

**AC-39: A second submission is prevented while the first is in flight**
**Given** a submission is in progress,
**When** the member presses submit again,
**Then** the second press does nothing, so one intent cannot become two transactions.

**AC-40: The form shows that it is working**
**Given** a submission is in progress,
**When** the form renders,
**Then** it shows a busy state and cannot be dismissed until the attempt settles.

**AC-41: Success closes the form and shows the new row**
**Given** a recording succeeds,
**When** the response arrives,
**Then** the form closes and the history reloads with the new transaction present in its day's section.

**AC-42: The stored row names who recorded it**
**Given** any recorded transaction,
**When** it is examined,
**Then** it names the member who recorded it and when.

**AC-43: An expense is audited like any other recording**
**Given** any expense attempt, successful or refused,
**When** it completes,
**Then** an audit record is written with the actor, the account, the outcome and the reason where applicable.

**AC-44: Recording is refused in a workspace the member has left**
**Given** a member whose membership has been removed,
**When** they submit a recording against that workspace,
**Then** it is refused as not permitted even if their form was loaded while they were still a member.

---

### TXN-US-03: Record Transfer Transaction

**As a** workspace MEMBER, **I want to** move money between two of my accounts, **so that** both balances stay correct without inventing income or expense.

#### Acceptance Criteria

**AC-45: A transfer is one operation producing a linked pair**
**Given** a member names a source account, a destination account, an amount and a date,
**When** they submit,
**Then** two transactions are created — one reducing the source, one increasing the destination — and both are linked as one business event.

**AC-46: Each side states its own direction**
**Given** a recorded transfer,
**When** either side is examined alone,
**Then** it states whether it reduced or increased its account, without reference to the other side or to the order the pair was created in.

**AC-47: The source falls and the destination rises**
**Given** a transfer of a given amount,
**When** it completes,
**Then** the source balance is lower by the amount sent and the destination balance is higher by the amount received.

**AC-48: Both sides share one link**
**Given** a recorded transfer,
**When** its two sides are examined,
**Then** they carry the same link value, and that value identifies no other transaction.

**AC-49: Both sides carry the same date**
**Given** a recorded transfer,
**When** the pair is examined,
**Then** both sides fall on the date the member gave, so the movement never straddles two days.

**AC-50: Neither side counts as workspace income or expense**
**Given** a transfer between two accounts of the same workspace,
**When** workspace income and expense are reported,
**Then** neither side contributes, because the workspace's position did not change.

**AC-51: Each side still counts for its own account**
**Given** the same transfer,
**When** each account's own figures are reported,
**Then** the source shows the outflow and the destination the inflow.

**AC-52: A same-currency transfer moves the identical figure**
**Given** both accounts hold the same currency,
**When** the transfer is recorded,
**Then** the destination is credited the same figure that left the source.

**AC-53: A cross-currency transfer credits equivalent value**
**Given** the two accounts hold different currencies,
**When** the transfer is recorded,
**Then** the destination is credited the equivalent value in its own currency rather than the same numeral, so sending a hundred of one currency does not create a hundred of the other.

**AC-54: Each side carries its own rate**
**Given** a cross-currency transfer,
**When** the two rows are examined,
**Then** each carries the rate from its own account's currency to the reporting currency.

**AC-55: A transfer leaves the workspace's total position unchanged**
**Given** a cross-currency transfer,
**When** the workspace's total reported position is computed before and after,
**Then** it is the same, save for rounding to the destination's minor unit.

**AC-56: The credited figure is rounded to the destination's minor unit**
**Given** a conversion producing more precision than the destination currency holds,
**When** the credit is recorded,
**Then** it is rounded to that currency's minor unit and the rounding is the only difference between the two sides' reported value.

**AC-57: Source and destination may not be the same account**
**Given** the same account named on both sides,
**When** the member submits,
**Then** the transfer is refused as invalid and nothing is recorded.

**AC-58: An unknown account on either side refuses the transfer**
**Given** either account reference matches no account of this workspace,
**When** the member submits,
**Then** the transfer is refused as account not found and neither side is created.

**AC-59: An archived account on either side refuses the transfer**
**Given** either account is archived,
**When** the member submits,
**Then** the transfer is refused as archived and neither side is created.

**AC-60: A zero or negative transfer is refused**
**Given** an amount of zero or less,
**When** the member submits,
**Then** the transfer is refused as an invalid amount.

**AC-61: A rate failure on either side refuses the whole transfer**
**Given** a rate is needed for either account and cannot be obtained,
**When** the member submits,
**Then** neither side is recorded and neither balance moves — a transfer is never half-recorded.

**AC-62: A failure mid-way leaves nothing behind**
**Given** the first side is written and the second fails,
**When** the operation unwinds,
**Then** no side and no balance change survive.

**AC-63: A transfer carries no category**
**Given** a recorded transfer,
**When** either side is examined,
**Then** it has no category, because a transfer is not a classification of spending.

**AC-64: A transfer describes itself in terms of the other account**
**Given** no description is supplied,
**When** the pair is recorded,
**Then** each side is described in terms of the account at the other end, so a row is meaningful without opening its partner.

**AC-65: A transfer is audited as one event naming both sides**
**Given** any transfer attempt, successful or refused,
**When** it completes,
**Then** one audit record is written naming both transactions and both accounts, or the refusal reason.

**AC-66: A transfer is available through its own operation only**
**Given** a member wants to move money between accounts,
**When** they look for the means,
**Then** it is a distinct operation from ordinary recording. *(No form exists yet — the operation is reachable through the API only; see [plan.md](plan.md) T9.)*

---

### TXN-US-04: View Transaction History

**As a** workspace member, **I want to** browse and filter what has been recorded, **so that** I can find and check individual movements.

#### Acceptance Criteria

**AC-67: Newest first**
**Given** transactions on several dates,
**When** the history renders,
**Then** the most recent appear first.

**AC-68: The amount is stated in the account's own currency**
**Given** any row,
**When** it renders,
**Then** its amount is shown in the currency of the account it belongs to.

**AC-69: The reported equivalent appears only when it differs**
**Given** a row whose currency equals the reporting currency,
**When** it renders,
**Then** no equivalent is shown, because a second identical figure only adds noise; where the currencies differ, the equivalent is shown.

**AC-70: A section per calendar day**
**Given** transactions from more than one date,
**When** the history renders,
**Then** it is divided into one section per calendar day, each labelled with that date.

**AC-71: Today and yesterday are named**
**Given** sections for today and for yesterday,
**When** they render,
**Then** they are labelled as such alongside the date, rather than by date alone.

**AC-72: Each day carries its own subtotal**
**Given** a day's section,
**When** it renders,
**Then** that day's arriving and leaving totals are shown in the reporting currency, and a direction with nothing in it is omitted rather than shown as zero.

**AC-73: Cancelled rows are excluded from the day's subtotal**
**Given** a day containing a cancelled transaction,
**When** its subtotal renders,
**Then** the cancelled row contributes nothing.

**AC-74: Cancelled rows stay visible and marked**
**Given** a cancelled transaction,
**When** the history renders,
**Then** the row is present, visibly marked as cancelled, and its amount struck through, so the record of the mistake survives.

**AC-75: Category and type lead the row**
**Given** any row,
**When** it renders,
**Then** its category and type are the most prominent elements, because those are what a reader scans for.

**AC-76: The description supports rather than leads**
**Given** a row with a description,
**When** it renders,
**Then** the description sits beneath the category and type as secondary detail.

**AC-77: Date, account and note are individually identifiable**
**Given** a row carrying a date, an account and a note,
**When** it renders,
**Then** each is separately labelled or iconed, so no two of them can be mistaken for one another.

**AC-78: An unclassified row says so**
**Given** a row with no category,
**When** it renders,
**Then** it reads as unclassified rather than leaving the leading position empty.

**AC-79: Filtering by type**
**Given** a member chooses a type,
**When** the history refreshes,
**Then** only transactions of that type are listed, and the count shown reflects the filter.

**AC-80: Filtering by account, category, amount range, date range and text**
**Given** any of these filters is applied,
**When** results return,
**Then** only matching transactions are listed, and several filters applied together narrow the result rather than widening it.

**AC-81: An inverted date range is refused**
**Given** a range whose start falls after its end,
**When** it is submitted,
**Then** it is refused as an invalid date range rather than silently returning nothing.

**AC-82: Text search covers the free-text fields**
**Given** search text,
**When** results return,
**Then** transactions whose description, note or tags contain it are listed, matched without regard to letter case.

**AC-83: Sorting is limited to a known set of fields**
**Given** a sort field,
**When** it is one the system supports,
**Then** results are ordered by it in the direction asked; an unsupported field does not cause a failure.

**AC-84: Results are paginated with a total**
**Given** more transactions than one page holds,
**When** a page is requested,
**Then** it returns that page's transactions, the total count, the page position and whether more remain.

**AC-85: Page size is bounded**
**Given** a page size below one or above the maximum,
**When** it is submitted,
**Then** it is brought within bounds rather than refused or honoured, and the size actually used is reported back.

**AC-86: A single transaction can be retrieved on its own**
**Given** a transaction reference,
**When** it is requested,
**Then** that transaction is returned with its account and category names resolved.

**AC-87: A transaction of another workspace is not retrievable**
**Given** a transaction belonging to a different workspace,
**When** it is requested through this workspace,
**Then** it is refused as not found.

**AC-88: An empty history explains itself**
**Given** a workspace with nothing recorded,
**When** the history renders,
**Then** it explains that transactions will appear here; a workspace with no accounts at all instead says an account is needed first and offers the way there, with recording disabled until then.

**AC-89: A non-member cannot read the history**
**Given** a user who is not a member,
**When** they request the history or a single transaction,
**Then** it is refused as not permitted, and the refusal is recorded.

---

### TXN-US-05: Cancel Transaction

**As a** workspace MEMBER, **I want to** cancel a transaction I recorded in error, **so that** balances return to what they should be while the record of the mistake survives.

#### Acceptance Criteria

**AC-90: Cancelling reverses the balance effect**
**Given** a recorded transaction,
**When** it is cancelled,
**Then** its account's balance returns to what it would have been had the transaction never been recorded.

**AC-91: Cancelled, not deleted**
**Given** a cancelled transaction,
**When** the stored row is examined,
**Then** it still exists, marked cancelled, with its amount, date and classification intact.

**AC-92: The cancellation time is recorded**
**Given** a cancellation,
**When** it completes,
**Then** the moment it happened is stored on the transaction.

**AC-93: A reason is recorded when given**
**Given** a reason accompanies the cancellation,
**When** it completes,
**Then** the reason is stored on the transaction and appears in the audit record; no reason is equally acceptable.

**AC-94: Both halves of a transfer cancel together**
**Given** either side of a transfer,
**When** it is cancelled,
**Then** both sides are cancelled and both balances are restored, because a transfer is one business event.

**AC-95: Either half is an equally valid starting point**
**Given** a transfer,
**When** the cancellation begins from the credited side rather than the debited one,
**Then** the outcome is identical.

**AC-96: A cross-currency transfer reverses in each account's own terms**
**Given** a transfer whose two sides carry different amounts,
**When** it is cancelled,
**Then** each account is restored by the figure that account actually moved, not by a single shared figure.

**AC-97: Reversal follows the stored direction**
**Given** any transaction,
**When** it is cancelled,
**Then** the reversal is derived from the direction stored on the row, never inferred from the order rows were created in.

**AC-98: The creator may cancel their own**
**Given** the member who recorded the transaction,
**When** they cancel it,
**Then** it is permitted.

**AC-99: An OWNER may cancel anyone's**
**Given** a workspace OWNER,
**When** they cancel a transaction another member recorded,
**Then** it is permitted.

**AC-100: Another member may not**
**Given** a member who is neither the creator nor an OWNER,
**When** they attempt to cancel,
**Then** it is refused as not permitted, the transaction stays recorded, and the balance is untouched.

**AC-101: Cancelling twice is refused**
**Given** an already-cancelled transaction,
**When** cancellation is attempted again,
**Then** it is refused as already cancelled, and the balance is not reversed a second time.

**AC-102: A cancelled transaction cannot be edited**
**Given** a cancelled transaction,
**When** an edit is attempted,
**Then** it is refused as already cancelled.

**AC-103: A cancellation cannot be undone**
**Given** a cancelled transaction,
**When** a member looks for a way to reinstate it,
**Then** none is offered; the correction is to record the transaction again.

**AC-104: Cancelling is confirmed first**
**Given** a member starts a cancellation,
**When** the confirmation appears,
**Then** it identifies the transaction by its date, amount and description, and states the action is destructive.

**AC-105: The confirmation can be abandoned**
**Given** the confirmation is open,
**When** the member declines or dismisses it,
**Then** nothing is cancelled and no balance moves.

**AC-106: A failed cancellation says so and stays open**
**Given** a cancellation is refused by the system,
**When** the response arrives,
**Then** the confirmation stays open showing the reason, rather than closing as though it had worked.

**AC-107: A cancelled row loses its controls**
**Given** a cancelled row,
**When** it renders,
**Then** neither an edit nor a cancel control is offered on it.

**AC-108: A cancelled transaction stops counting everywhere**
**Given** a cancelled transaction,
**When** any total, subtotal, series or per-account figure is computed,
**Then** its contribution is exactly zero, while it remains listed.

**AC-109: Cancelling an unknown transaction is refused**
**Given** a transaction reference matching nothing in this workspace,
**When** cancellation is attempted,
**Then** it is refused as not found.

**AC-110: Cancelling outside one's workspaces is refused**
**Given** a user who is not a member of the workspace,
**When** they attempt a cancellation,
**Then** it is refused as not permitted.

**AC-111: Every cancellation is audited**
**Given** any cancellation attempt, successful or refused,
**When** it completes,
**Then** an audit record is written with the actor, the transaction, the outcome, the reason where given, and the source address.

---

### TXN-US-06: Correct a Recorded Transaction

**As a** workspace MEMBER, **I want to** correct how a transaction is classified and described, **so that** my history reads accurately without rewriting what actually happened.

#### Acceptance Criteria

**AC-112: Classification and free text may change**
**Given** a recorded transaction,
**When** a member edits it,
**Then** its category, description, note and tags may all be changed.

**AC-113: Amount, account, type and date may not change**
**Given** a recorded transaction,
**When** any request attempts to change its amount, account, type or date,
**Then** the stored values are unchanged — there is no request that alters them.

**AC-114: The form says why those fields are fixed**
**Given** the edit form,
**When** it renders,
**Then** the amount, account, type and date appear filled but disabled, with a note explaining that a correction to any of them is made by cancelling and recording a replacement.

**AC-115: Clearing a category differs from leaving it alone**
**Given** a transaction with a category,
**When** an edit removes it,
**Then** the transaction becomes unclassified — an outcome distinguishable from an edit that simply did not mention the category.

**AC-116: An unmentioned field is left alone**
**Given** an edit that omits a field entirely,
**When** it is applied,
**Then** that field keeps its current value.

**AC-117: A category can be replaced**
**Given** a transaction with one category,
**When** an edit names another belonging to the workspace,
**Then** the classification changes to it.

**AC-118: A category from another workspace is refused**
**Given** an edit naming a category outside this workspace,
**When** it is submitted,
**Then** it is refused as category not found and nothing changes.

**AC-119: A description can be replaced or emptied**
**Given** a transaction with a description,
**When** an edit supplies different text or empty text,
**Then** the description becomes what was supplied.

**AC-120: A note and tags can be replaced or emptied**
**Given** a transaction carrying a note or tags,
**When** an edit supplies different or empty text,
**Then** they become what was supplied.

**AC-121: An edit never changes the stored rate**
**Given** any edit,
**When** it completes,
**Then** the rate stored on the transaction and its reported amount are exactly as before, because nothing about the money changed.

**AC-122: An edit never moves a balance**
**Given** any edit,
**When** it completes,
**Then** the account balance is unchanged.

**AC-123: A cancelled transaction cannot be edited**
**Given** a cancelled transaction,
**When** an edit is submitted,
**Then** it is refused as already cancelled.

**AC-124: An unknown transaction cannot be edited**
**Given** a transaction reference matching nothing in this workspace,
**When** an edit is submitted,
**Then** it is refused as not found.

**AC-125: A transaction of another workspace cannot be edited**
**Given** a transaction belonging to a different workspace,
**When** an edit is submitted through this workspace,
**Then** it is refused as not found.

**AC-126: A non-member cannot edit**
**Given** a user who is not a member,
**When** they submit an edit,
**Then** it is refused as not permitted.

**AC-127: Only the creator or an OWNER may edit**
**Given** a member who is neither the creator nor an OWNER,
**When** they submit an edit,
**Then** it is refused as not permitted, on the same footing as cancellation. *(Intended contract — not currently enforced; see [plan.md](plan.md) G6.)*

**AC-128: Saving closes the form and shows the change**
**Given** an edit succeeds,
**When** the response arrives,
**Then** the form closes and the row shows its new classification and description without a manual refresh.

**AC-129: A refused edit keeps the form open with the reason**
**Given** an edit is refused,
**When** the response arrives,
**Then** the form stays open, states the reason, and keeps what the member typed.

**AC-130: Every edit is audited**
**Given** any edit attempt, successful or refused,
**When** it completes,
**Then** an audit record is written naming the actor, the transaction, the outcome and the reason where applicable.

---

### Edge Cases

- **EC-001**: An account is archived between the form being opened and the transaction being submitted.
- **EC-002**: A transfer is attempted where one of the two accounts was archived after the form was opened.
- **EC-003**: A transaction is dated in the future, then the day arrives — it must not be counted twice or move.
- **EC-004**: A category is archived after transactions were classified with it.
- **EC-005**: Two members cancel the same transaction at the same moment.
- **EC-006**: A cross-currency transfer whose conversion rounds so the two sides are not exactly equal in reported value.
- **EC-007**: The reporting currency is changed after transactions were recorded.
- **EC-008**: The rate source returns a syntactically valid but wildly wrong rate, which is then snapshotted.
- **EC-009**: A member is removed from the workspace while their recording form is open.
- **EC-010**: The same recording form is submitted twice in quick succession.
- **EC-011**: An amount whose conversion to the reporting currency exceeds the stored precision of the reported figure.
- **EC-012**: A transaction is recorded against an account whose balance is already negative.
- **EC-013**: A day's section contains only cancelled transactions.
- **EC-014**: All transactions fall on the same date, so the history is one section.
- **EC-015**: A transfer's two sides are requested individually and each must be intelligible alone.
- **EC-016**: A transaction is edited to clear its category while another member is filtering the list by that category.
- **EC-017**: A page beyond the last is requested.
- **EC-018**: Search text containing the wildcard characters the underlying matching uses.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST record a transaction with an account, a type, a positive amount, a date, and optionally a category, description, note, tags, receipt reference and location.
- **FR-002**: The system MUST apply the balance effect and persist the transaction as one indivisible operation.
- **FR-003**: The system MUST increase the balance for arriving types and decrease it for leaving types, and MUST document which type is which.
- **FR-004**: The system MUST store every amount as a positive figure and carry the sign in a stored direction.
- **FR-005**: The system MUST take the transaction's currency from its account and MUST NOT accept a currency from the client.
- **FR-006**: The system MUST determine the rate to the reporting currency itself and store it on the transaction.
- **FR-007**: The system MUST use exactly one as the rate, with no external call, when the account's currency equals the reporting currency.
- **FR-008**: The system MUST refuse the write, storing nothing and moving no balance, when a required rate cannot be determined.
- **FR-009**: The system MUST offer a preview of the rate and the converted amount before submission, from the same source the write uses.
- **FR-010**: The system MUST allow submission when the preview is unavailable, warning rather than blocking.
- **FR-011**: The system MUST refuse amounts of zero or less.
- **FR-012**: The system MUST refuse amounts carrying more precision than the minor unit, and amounts beyond the stored magnitude.
- **FR-013**: The system MUST refuse an account that does not exist in the workspace, and MUST distinguish that from an account that is archived.
- **FR-014**: The system MUST refuse a category that does not belong to the workspace.
- **FR-015**: The system MUST accept a transaction with no category and present it as unclassified.
- **FR-016**: The system MUST offer only categories matching the direction of the chosen type.
- **FR-017**: The system MUST require a date and MUST accept a future one.
- **FR-018**: The system MUST record the member who recorded each transaction, and when.
- **FR-019**: The system MUST accept an expense that takes a balance negative.
- **FR-020**: The system MUST refuse transfer as the type of an ordinary recording, and MUST NOT offer it on the ordinary form.
- **FR-021**: The system MUST record a transfer as a linked pair, applied indivisibly, both sides carrying the same date and the same link.
- **FR-022**: The system MUST exclude both sides of a transfer from workspace income and expense, and MUST include each side in its own account's figures.
- **FR-023**: The system MUST credit the destination of a cross-currency transfer with the equivalent value in the destination's currency, rounded to that currency's minor unit.
- **FR-024**: The system MUST store, on each side of a transfer, the rate from its own account's currency to the reporting currency.
- **FR-025**: The system MUST refuse a transfer whose source and destination are the same account.
- **FR-026**: The system MUST refuse a transfer if either account is unknown or archived, or if a rate for either is unavailable, creating neither side.
- **FR-027**: The system MUST leave a transfer's two sides without a category.
- **FR-028**: The system MUST describe each side of an undescribed transfer in terms of the account at the other end.
- **FR-029**: The system MUST store, on each transaction, which way it moved its account's balance, independent of creation order.
- **FR-030**: The system MUST present history newest first, in the account's own currency, with the reported equivalent only where the currencies differ.
- **FR-031**: The system MUST group history into one section per calendar day, naming today and yesterday, with that day's arriving and leaving subtotals.
- **FR-032**: The system MUST exclude cancelled transactions from every subtotal while keeping them listed and marked.
- **FR-033**: The system MUST lead each row with its category and type, with the description as secondary detail and the date, account and note each separately identifiable.
- **FR-034**: The system MUST support filtering history by type, account, category, amount range, date range and free text.
- **FR-035**: The system MUST refuse a date range whose start falls after its end.
- **FR-036**: The system MUST match free-text search against description, note and tags without regard to letter case.
- **FR-037**: The system MUST order results by a supported field in the requested direction, and MUST NOT fail on an unsupported one.
- **FR-038**: The system MUST paginate list results, returning the total count, the page position, the page size used, and whether more remain.
- **FR-039**: The system MUST bring an out-of-range page size within bounds and report the size actually used.
- **FR-040**: The system MUST allow a single transaction to be retrieved with its account and category names resolved, and MUST refuse one belonging to another workspace as not found.
- **FR-041**: The system MUST allow the category, description, note and tags of a recorded transaction to change, and MUST prevent any change to its amount, account, type or date.
- **FR-042**: The system MUST distinguish clearing a category from leaving it unchanged, and MUST leave any unmentioned field untouched.
- **FR-043**: The system MUST leave the stored rate, the reported amount and the account balance unchanged by an edit.
- **FR-044**: The system MUST refuse an edit or a cancellation of an already-cancelled transaction.
- **FR-045**: The system MUST restrict cancellation to the transaction's creator or an OWNER.
- **FR-046**: The system MUST reverse the balance effect on cancellation using the stored direction, mark the transaction cancelled rather than delete it, record the moment and any reason, and cancel both halves of a transfer together.
- **FR-047**: The system MUST require a confirmation identifying the transaction before cancelling, and MUST keep the confirmation open with the reason if the cancellation is refused.
- **FR-048**: The system MUST NOT offer a means of reinstating a cancelled transaction.
- **FR-049**: The system MUST refuse every operation in this feature to a non-member, and MUST refuse an unknown workspace as not found.
- **FR-050**: The system MUST write an audit record for every recording, transfer, edit and cancellation, successful or refused, naming the actor, the entities, the outcome, the reason where applicable and the source address.

### Key Entities

- **Transaction**: One movement of money against one account, carrying its amount, its own currency, the direction it moved the balance, the date, an optional classification, the rate that converts it into the reporting currency, the reported amount that rate produces, who recorded it, and a recorded/cancelled state.
- **Transfer group**: The link binding the two sides of a single transfer so they are treated, cancelled and audited as one business event.
- **Day section**: One calendar day of history with its own arriving and leaving subtotals, computed from recorded rows only.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: An account's balance always equals its opening balance plus the signed sum of its recorded transactions, verified after every operation in a 200-operation sequence.
- **SC-002**: A cross-currency transfer leaves the workspace's total reported position unchanged, within one minor unit of rounding.
- **SC-003**: No request sequence alters a recorded transaction's amount, account, type or date.
- **SC-004**: A cancelled transaction's contribution to every subtotal and summary is exactly zero.
- **SC-005**: The direction of any transaction, including each side of a transfer, is determinable from that row alone.
- **SC-006**: Every transaction mutation has a matching audit record across a sample of 100 operations.
- **SC-007**: No refused write leaves a transaction behind, verified by the transaction count being unchanged after each of the refusal paths.
- **SC-008**: No refused write moves a balance, verified by the account balance being unchanged after each of the refusal paths.
- **SC-009**: A rate movement after recording changes no already-recorded reported amount.
- **SC-010**: Cancelling either side of a transfer produces byte-identical account balances to cancelling the other.
- **SC-011**: The per-day subtotals of a history page sum to the same figures as the equivalent server-side aggregate over that range.
- **SC-012**: A history page of 50 rows resolves account and category names without a per-row query, verified by query count.
- **SC-013**: Every list response reports a page size within the documented bounds, whatever was requested.

---

## Assumptions

- Transfers are recorded through their own operation, not by choosing a transfer type on the ordinary form.
- A wrong amount is never edited; it is cancelled and re-recorded, so the ledger keeps both facts.
- Cancellation is not reversible; a cancelled transaction cannot be reinstated.
- Amounts are always stored positive; direction carries the sign.
- Future-dated transactions are permitted — a member may record something known in advance — and are counted from the moment they are recorded, not from their date.
- Receipt attachments are referenced, not stored; file upload is out of scope.
- Negative balances are permitted; the system records what happened rather than enforcing an overdraft rule.
- The direction of each type is a design decision recorded in the plan, not stated by the SRS: money earned, returned and borrowed in arrive; money spent, invested and lent out leave.
- Cross-currency rounding to the destination's minor unit is accepted, which is why the position-preservation criterion carries a tolerance.
- A transaction's own currency is never converted for display; only the reported equivalent is.
- Deleting a transaction outright is not offered at all — cancellation is the only removal.
- Free-text search is a containment match, not a ranked or fuzzy one.
