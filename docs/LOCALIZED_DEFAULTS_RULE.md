# Localized Defaults vs. User-Owned Data Rule

This document defines the system rule for handling default resource names, initial seeds, and internationalization (i18n) across Sora.

---

## The System Rule

> **Localized defaults are resolved ONCE at resource creation time using the user's active locale. After creation, the value is stored in the database as literal user data and is NEVER automatically retranslated when the user's locale changes.**

---

## Core Principles

1. **Resolution at Creation Time**:
   When a user registers or creates a new resource (Wallet, Account, Category, Goal, Budget), the server or client uses the active user locale to generate the initial default name string (e.g., `"Ví của tôi"` vs. `"My Wallet"`).

2. **Literal Value Persistence**:
   The value persisted in the database is the resolved literal text string (`name: "Ví của tôi"`). The database **never** stores translation keys (e.g., `wallet.defaults.personal`) or template placeholders.

3. **User Ownership & Immutability under Locale Shift**:
   Once created, default names become ordinary user-owned financial data. If the user changes their language setting (e.g. from Vietnamese to English), stored resource names remain completely unchanged.

   ```text
   User locale = Vietnamese ("vi")
           ↓
   Create default wallet
           ↓
   Persisted DB name = "Ví của tôi"
           ↓
   User changes language preference to English ("en")
           ↓
   Stored Wallet name remains "Ví của tôi" (Unchanged)
   ```

4. **User Modifications**:
   If a user renames a resource (e.g., from `"Ví của tôi"` to `"My Family Wallet"`), the custom name is updated in the database and remains unchanged across language switches.

---

## Registration & Seeding Flow

### Option B: Server Stores User Locale & Seeds Localized Defaults

During user registration (`POST /api/v1/auth/register` or `POST /api/v1/auth/google`):

1. The client optionally supplies `locale` (e.g., `{ "locale": "vi" }`).
2. The server stores `user.locale` in the `users` table.
3. The server uses `user.locale` to seed localized defaults:
   * **Default Wallet Name**: `"Ví của tôi"` (`vi`) / `"My Wallet"` (`en`)
   * **Default Account Name**: `"Tiền mặt"` (`vi`) / `"Cash"` (`en`)
   * **Starter Categories**: Localized starter names resolved at seed time.

---

## Summary Checklist for Future Development

* [x] **Never store translation keys in entity `name` fields in DB.**
* [x] **Resolve default names once using `user.locale` during entity creation.**
* [x] **Do not dynamic-translate user-owned domain data when rendering UI lists.**
* [x] **Allow updating `user.locale` in settings without mutating existing database records.**
