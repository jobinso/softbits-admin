# admin-0001: Token service permissions kept as orthogonal layer to role access

**Date:** 2026-05-03
**Status:** accepted

## Context

When user-linked API tokens were introduced, an open question was whether the token's coarse service permissions (`get`, `post`, `browse`, `build`, `utils`) were still needed given that the linked user already carries a Role with permissions in the access matrix.

A first-pass investigation suggested the two were redundant and that user-linked tokens should inherit permissions from the user's role. Closer reading of the runtime path showed this premise was wrong. The two permission systems live at different layers and serve different purposes:

1. **Token service permissions** are checked in `softbits-bridge/src/middleware/auth.js` (around line 194) against `requiredService` derived per-route. They gate **which top-level service categories** a token may call (e.g. "this token may not call POST endpoints at all"). The set is also globally enable/disable-able via `tokenManager.services` so an operator can shut down a whole service class without revoking individual tokens.

2. **Role access permissions** are stored in `adm_RoleAccess` and resolved by `softbits-bridge/src/auth/role-access.js::getEffectivePermissions(roleId)` as `entity x action`. They gate **which business entities and actions** a request may perform. The vocabulary (entity x action) is incompatible with the token service vocabulary (service categories) — they cannot meaningfully be substituted for one another.

3. There is also `api_TokenEndpoints` for fine-grained per-endpoint allow-listing on a token, plus `EntityPermissions`, `AllowedModules`, and `McpPermissions` carried on the user — all of which sit alongside the role access matrix.

Removing token service permissions for user-linked tokens would remove the operational gate (`isServiceEnabled` + per-token service deny) while leaving the business gate (role access) in place. That is not a simplification — it is a regression in operational control, and it cannot be expressed in the role-access vocabulary.

## Decision

Keep token service permissions as a distinct orthogonal layer. Treat them as a coarse operational/scoping gate that runs **before** role access checks. Do not attempt to fold them into the role access matrix.

For UX, default user-linked tokens to **all** service permissions (since the user's role already gates the meaningful business actions) and hide the permissions selector behind a "Customize (advanced)" toggle. Standalone tokens continue to require explicit permission selection because they have no user/role to ride on.

Concretely:
- Backend: no change to `tokenManager.createToken` defaults (already grants all five services when no list is supplied) or to the auth middleware permission gate.
- Frontend (admin Security > Tokens): when a user is selected, render an explanatory panel ("All services enabled. The linked user's role determines which entities and actions this token can access.") with a "Customize (advanced)" link that reveals the full checkbox list for the scope-down case (e.g. issuing a read-only CI token from an admin user).
- Vocabulary: `utils` remains a token-service-only concept and is intentionally not mirrored in the access matrix.

## Consequences

**Easier:**
- Operators can still globally disable a service category (e.g. POST) and have it take effect across all tokens immediately, including user-linked ones.
- Users issuing tokens for themselves do not have to think about token-level permissions in the common case — the UI reflects "the user's role already gates this".
- Power users can still scope a token down (e.g. read-only) via the "Customize (advanced)" affordance.
- No JWT format change, no breaking change to existing standalone tokens or to OAuth-issued tokens (which already inject the full service set in `auth.js`).

**Harder:**
- The two-layer model has to be explained in docs and onboarding. A naive reader may still wonder why both exist.
- Audits of "what can this token actually do?" require checking BOTH layers and intersecting the result with `api_TokenEndpoints` if endpoint-level grants are in play.
- A future move to a single unified permission model would still require reconciling vocabularies (`get/post/browse/build/utils` vs `entity x action`).

---
*This ADR is managed by Softbit Forge. ID: `admin-0001`*
