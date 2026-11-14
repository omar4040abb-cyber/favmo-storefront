# FAVMO Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: All unmatched paths in Firestore are denied for both reads and writes.
2. **PII Isolation**: User emails and phones are stored exclusively in `/users/{userId}/private/info`, delivery addresses in `/users/{userId}/addresses/{addressId}`, and server-managed `/orders/{orderId}`. `/users/{userId}` stores only non-PII preferences (`displayName`, `preferredLocale`, `status`).
3. **Zero Client Financial Trust**: Clients cannot create or mutate `/products`, `/variants`, `/orders`, `/counters`, `/payments`, `/discounts`, `/discountRedemptions`, `/stockMovements`, or `/auditLogs` directly; all financial totals, stock decrements, and order numbers are computed transactionally on the server.
4. **No Self-Assigned Roles**: Client writes to `/adminProfiles/{uid}` are strictly denied (`allow create, update, delete: if false;`). Roles (`owner`, `manager`, `staff`) are managed exclusively by server-side Firebase Admin SDK and verified via `adminProfiles` + `email_verified == true`.
5. **Verified Identity for Client Writes**: Customer mutations require `request.auth != null && request.auth.token.email_verified == true` and strict `uid == request.auth.uid` ownership checks.
6. **Temporal & Key Integrity**: Client-written documents require `createdAt == request.time` on creation, `updatedAt == request.time` on update, immutable `createdAt`/`uid` fields, and strict `keys().hasAll(...) && keys().hasOnly(...)` schema enforcement.
7. **Query Enforcement**: Every `allow list` rule evaluates `resource.data` directly without `get()` or `exists()` calls inside `list`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Ghost Admin Escalation**: `{ "uid": "user1", "displayName": "Attacker", "preferredLocale": "en", "status": "active", "role": "owner" }` on `/users/user1` -> `PERMISSION_DENIED` (`hasOnly` rejection).
2. **Identity Spoofing on Profile**: `{ "uid": "victimUid", "displayName": "Spoof", "preferredLocale": "ar", "status": "active" }` written by `attackerUid` to `/users/victimUid` -> `PERMISSION_DENIED`.
3. **Self-Creation of Admin Profile**: Authenticated user attempting `create` on `/adminProfiles/{uid}` with `role: "owner"` -> `PERMISSION_DENIED`.
4. **PII Cross-User Read**: Authenticated `user2` attempting `get` on `/users/user1/private/info` -> `PERMISSION_DENIED`.
5. **Direct Client Order Forgery**: Authenticated user attempting `create` on `/orders/order1` with `totalPiasters: 1` -> `PERMISSION_DENIED`.
6. **Discount Code Enumeration**: Unauthenticated or customer user attempting `list` on `/discounts` -> `PERMISSION_DENIED`.
7. **Oversized Document ID Poisoning**: Attempt `create` on `/users/user1/addresses/` + 300-char ID -> `PERMISSION_DENIED` (`isValidId` fails).
8. **Direct Variant Stock Tampering**: Authenticated user attempting `update` on `/variants/var1` setting `stock: 1000` -> `PERMISSION_DENIED`.
9. **Cart Array Overflow**: Writing > 50 items to `/carts/user1` -> `PERMISSION_DENIED`.
10. **Timestamp Backdating**: Creating `/users/user1` with client-forged past `createdAt` -> `PERMISSION_DENIED` (`createdAt == request.time` fails).
11. **Immutable Status/UID Mutation**: Customer updating `/users/user1` changing `status` to `"active"` after suspension -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(['displayName', 'preferredLocale', 'updatedAt'])`).
12. **Unscoped Blanket List Query on Orders**: Authenticated user attempting `list` on `/orders` without `where("userId", "==", auth.uid)` -> `PERMISSION_DENIED`.
