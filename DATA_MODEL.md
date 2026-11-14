# FAVMO — Complete Firestore Data Model (Section 11)

All monetary amounts are stored as **integer minor units (Egyptian piasters, 1 EGP = 100 piasters)**. No floating-point arithmetic is used for prices, discounts, shipping fees, or totals. All collections are structured cleanly with normalized identifiers and relational keys to support future PostgreSQL migration.

---

## 1. `users` (`/users/{userId}`)
1. **Purpose**: Customer non-PII account preferences and profile summary, plus isolated PII sub-document `/users/{userId}/private/info` and saved addresses `/users/{userId}/addresses/{addressId}`.
2. **Field Names**: `uid`, `displayName`, `preferredLocale`, `status`, `createdAt`, `updatedAt`. (PII in `/private/info`: `uid`, `email`, `phone`, `updatedAt`; Addresses in `/addresses/{addressId}`: `uid`, `label`, `fullName`, `phone`, `country`, `governorateCode`, `city`, `area`, `street`, `building`, `floor`, `apartment`, `landmark`, `isDefault`, `createdAt`, `updatedAt`).
3. **Field Types**: `uid` (string), `displayName` (string), `preferredLocale` (`"ar" | "en"`), `status` (`"active" | "suspended"`), `createdAt` (timestamp), `updatedAt` (timestamp).
4. **Required Fields**: `uid`, `displayName`, `preferredLocale`, `status`, `createdAt`, `updatedAt`.
5. **Optional Fields**: Address fields (`landmark`, `floor`, `apartment`), `phone`.
6. **Relationships**: `uid` maps 1:1 to Firebase Auth UID; referenced by `orders.userId`, `carts/{userId}`, `wishlists/{userId}`.
7. **Validation Rules**: Strict `keys().hasAll/hasOnly`, `uid == request.auth.uid`, `displayName` 1..100 chars, `preferredLocale in ['ar', 'en']`.
8. **Server-Only Fields**: `status` (suspended/active managed by admin server route).
9. **Read Permissions**: Owner (`uid == request.auth.uid`) or Admin (`owner` / `manager` / `staff`).
10. **Write Permissions**: Owner can update `displayName`, `preferredLocale`, `updatedAt` and manage `/private/info` and `/addresses/*`; cannot change `uid`, `status`, or `createdAt`.
11. **Required Indexes**: Single-field `uid`, `updatedAt`.

## 2. `adminProfiles` (`/adminProfiles/{uid}`)
1. **Purpose**: Trusted role-based access control records for FAVMO administration (`owner`, `manager`, `staff`).
2. **Field Names**: `uid`, `email`, `displayName`, `role`, `active`, `bootstrapped`, `createdAt`, `updatedAt`.
3. **Field Types**: `uid` (string), `email` (string), `displayName` (string), `role` (`"owner" | "manager" | "staff"`), `active` (boolean), `bootstrapped` (boolean), `createdAt` (timestamp), `updatedAt` (timestamp).
4. **Required Fields**: `uid`, `email`, `role`, `active`, `createdAt`, `updatedAt`.
5. **Optional Fields**: `displayName`, `bootstrapped`.
6. **Relationships**: `uid` maps 1:1 to Firebase Auth UID + custom claim `role`.
7. **Validation Rules**: `role in ['owner', 'manager', 'staff']`, `active is bool`.
8. **Server-Only Fields**: Entire document is server-managed via Firebase Admin SDK.
9. **Read Permissions**: Self (`uid == request.auth.uid`) or `owner` / `manager`.
10. **Write Permissions**: `false` from client SDK (server-only bootstrap & Owner role management).
11. **Required Indexes**: `role ASC, active ASC`.

## 3. `products` (`/products/{productId}`)
1. **Purpose**: Master bilingual streetwear product records.
2. **Field Names**: `slug`, `collectionId`, `name_ar`, `name_en`, `description_ar`, `description_en`, `specs_ar`, `specs_en`, `seoTitle_ar`, `seoTitle_en`, `seoDescription_ar`, `seoDescription_en`, `pricePiasters`, `salePricePiasters`, `currency`, `status`, `isNew`, `featured`, `deletedAt`, `colors`, `media`, `sizeChart`, `createdAt`, `updatedAt`.
3. **Field Types**: Strings for localized text/SEO, integers (`pricePiasters`, `salePricePiasters`), booleans (`isNew`, `featured`), `status` (`"draft" | "published" | "archived"`), `colors` (bounded array <= 10), `media` (bounded array <= 30 with `angle: 'front'|'back'|'embroidery'|'fabric'`, `colorKey`, `url`, `alt_ar`, `alt_en`, `sortOrder`), `sizeChart` (bounded array <= 10), timestamps.
4. **Required Fields**: `slug`, `collectionId`, `name_ar`, `name_en`, `pricePiasters`, `currency`, `status`, `isNew`, `featured`, `createdAt`, `updatedAt`.
5. **Optional Fields**: `description_ar`, `description_en`, `specs_ar`, `specs_en`, `seoTitle_ar`, `seoTitle_en`, `seoDescription_ar`, `seoDescription_en`, `salePricePiasters`, `deletedAt`, `colors`, `media`, `sizeChart`.
6. **Relationships**: `collectionId` references `collections/{collectionId}`. Variants stored in `variants` collection linked by `productId`.
7. **Validation Rules**: `pricePiasters > 0`, `salePricePiasters < pricePiasters` when set, `currency == 'EGP'`.
8. **Server-Only Fields**: Soft delete & price mutations protected to Admin (`owner`, `manager`) via server API.
9. **Read Permissions**: Public read when `status == 'published'` and `deletedAt == null`; Admins read all.
10. **Write Permissions**: `false` for customers/public; server-verified Admin (`owner`, `manager`).
11. **Required Indexes**: `(status ASC, collectionId ASC, createdAt DESC)`, `(status ASC, pricePiasters ASC)`, `(status ASC, featured ASC)`.

## 4. `variants` (`/variants/{variantId}`)
1. **Purpose**: Independent SKU inventory units per product color and size (`S`, `M`, `L`, `XL`, `XXL`).
2. **Field Names**: `productId`, `sku`, `colorKey`, `colorName_ar`, `colorName_en`, `colorHex`, `size`, `stock`, `reservedStock`, `lowStockThreshold`, `active`, `updatedAt`.
3. **Field Types**: Strings (`productId`, `sku`, `colorKey`, `colorName_ar`, `colorName_en`, `colorHex`), `size` (`"S" | "M" | "L" | "XL" | "XXL"`), integers (`stock`, `reservedStock`, `lowStockThreshold`), boolean (`active`), timestamp.
4. **Required Fields**: `productId`, `sku`, `colorKey`, `colorName_ar`, `colorName_en`, `colorHex`, `size`, `stock`, `lowStockThreshold`, `active`, `updatedAt`.
5. **Optional Fields**: `reservedStock`.
6. **Relationships**: `productId` -> `products/{productId}`.
7. **Validation Rules**: `stock >= 0`, `reservedStock >= 0`, unique `sku` enforced server-side.
8. **Server-Only Fields**: `stock`, `reservedStock` (mutated only via Firestore Transactions on server).
9. **Read Permissions**: Public read when `active == true`; Admins read all.
10. **Write Permissions**: `false` from client SDK (server transactional endpoints only).
11. **Required Indexes**: `(productId ASC, active ASC, colorKey ASC)`, `(sku ASC)`.

## 5. `collections` (`/collections/{collectionId}`)
1. **Purpose**: Bilingual product collections (e.g., `THE HOODIE COLLECTION`).
2. **Field Names**: `slug`, `name_ar`, `name_en`, `description_ar`, `description_en`, `heroImageUrl`, `active`, `sortOrder`, `createdAt`, `updatedAt`.
3. **Field Types**: Strings, boolean (`active`), integer (`sortOrder`), timestamps.
4. **Required Fields**: `slug`, `name_ar`, `name_en`, `active`, `sortOrder`, `createdAt`, `updatedAt`.
5. **Optional Fields**: `description_ar`, `description_en`, `heroImageUrl`.
6. **Relationships**: Referenced by `products.collectionId`.
7. **Validation Rules**: `slug` lowercase kebab-case `^[a-z0-9-]+$`.
8. **Server-Only Fields**: Admin-managed.
9. **Read Permissions**: Public when `active == true`; Admins read all.
10. **Write Permissions**: Server-verified `owner` / `manager`.
11. **Required Indexes**: `(active ASC, sortOrder ASC)`.

## 6. `banners` (`/banners/{bannerId}`)
1. **Purpose**: Admin-managed hero and campaign banners (images, videos, video posters).
2. **Field Names**: `placement`, `mediaType`, `mediaUrl`, `posterUrl`, `title_ar`, `title_en`, `subtitle_ar`, `subtitle_en`, `ctaLabel_ar`, `ctaLabel_en`, `ctaHref`, `active`, `sortOrder`, `updatedAt`.
3. **Field Types**: `placement` (`"hero" | "campaign" | "editorial"`), `mediaType` (`"image" | "video" | "placeholder"`), strings, boolean, integer, timestamp.
4. **Required Fields**: `placement`, `mediaType`, `active`, `sortOrder`, `updatedAt`.
5. **Optional Fields**: `mediaUrl`, `posterUrl`, `title_ar`, `title_en`, `subtitle_ar`, `subtitle_en`, `ctaLabel_ar`, `ctaLabel_en`, `ctaHref`.
6. **Relationships**: Standalone storefront media configuration.
7. **Validation Rules**: Valid URL/asset path, `placement` allowlist.
8. **Server-Only Fields**: Admin-managed.
9. **Read Permissions**: Public when `active == true`; Admins read all.
10. **Write Permissions**: Server-verified `owner` / `manager`.
11. **Required Indexes**: `(placement ASC, active ASC, sortOrder ASC)`.

## 7. `pages` (`/pages/{pageSlug}`)
1. **Purpose**: Bilingual editable storefront & legal CMS pages (`home`, `about`, `contact`, `shipping-returns`, `privacy`, `terms`, `size-guide`).
2. **Field Names**: `slug`, `title_ar`, `title_en`, `body_ar`, `body_en`, `metaTitle_ar`, `metaTitle_en`, `metaDescription_ar`, `metaDescription_en`, `heroMediaType`, `heroMediaUrl`, `heroPosterUrl`, `campaignImageUrl`, `updatedAt`, `updatedBy`.
3. **Field Types**: Strings, `heroMediaType` (`"placeholder" | "image" | "video"`), timestamp.
4. **Required Fields**: `slug`, `title_ar`, `title_en`, `body_ar`, `body_en`, `updatedAt`.
5. **Optional Fields**: SEO metadata and hero media fields.
6. **Relationships**: None.
7. **Validation Rules**: `slug` allowlist; empty policy body renders `OWNER INPUT REQUIRED`.
8. **Server-Only Fields**: `updatedBy`, `updatedAt`.
9. **Read Permissions**: Public read.
10. **Write Permissions**: Server-verified `owner` / `manager`.
11. **Required Indexes**: Document ID lookup.

## 8. `carts` (`/carts/{userId}`)
1. **Purpose**: Persistent authenticated customer shopping bags (server-validated).
2. **Field Names**: `userId`, `items` (bounded array <= 50 of `{ itemId, productId, variantId, colorKey, size, quantity }`), `couponCode`, `updatedAt`.
3. **Field Types**: `userId` (string), `items` (array), `couponCode` (string|null), `updatedAt` (timestamp).
4. **Required Fields**: `userId`, `items`, `updatedAt`.
5. **Optional Fields**: `couponCode`.
6. **Relationships**: `userId` -> `users/{userId}`, item refs -> `products` & `variants`.
7. **Validation Rules**: `quantity` integer `1..20`, max 50 line items.
8. **Server-Only Fields**: Computed prices/totals are never persisted as trusted values on `carts`; recalculated dynamically by server.
9. **Read Permissions**: Owner (`userId == request.auth.uid`) or Admin.
10. **Write Permissions**: Owner (`userId == request.auth.uid`) with verified email or server API.
11. **Required Indexes**: Document ID (`userId`) lookup.

## 9. `wishlists` (`/wishlists/{userId}`)
1. **Purpose**: Cross-device persistent saved products per authenticated user.
2. **Field Names**: `userId`, `productIds` (bounded array <= 100), `updatedAt`.
3. **Field Types**: `userId` (string), `productIds` (array of strings), `updatedAt` (timestamp).
4. **Required Fields**: `userId`, `productIds`, `updatedAt`.
5. **Optional Fields**: None.
6. **Relationships**: `userId` -> `users/{userId}`, `productIds[]` -> `products/{productId}`.
7. **Validation Rules**: `productIds.size() <= 100`.
8. **Server-Only Fields**: None.
9. **Read Permissions**: Owner (`userId == request.auth.uid`) or Admin.
10. **Write Permissions**: Owner (`userId == request.auth.uid`) with verified email or server API.
11. **Required Indexes**: Document ID (`userId`) lookup.

## 10. `orders` (`/orders/{orderId}`)
1. **Purpose**: Immutable server-generated customer order records with line-item snapshots and minor-unit financials.
2. **Field Names**: `orderNumber`, `userId`, `idempotencyKey`, `locale`, `currency`, `status`, `paymentMethod`, `paymentStatus`, `codCollectionStatus`, `subtotalPiasters`, `discountPiasters`, `shippingPiasters`, `codFeePiasters`, `totalPiasters`, `discountCode`, `trackingNumber`, `internalNotes`, `itemsSnapshot`, `shippingAddress`, `statusTimeline`, `createdAt`, `updatedAt`.
3. **Field Types**: `orderNumber` (`FAV-YYYY-NNNNNN`), `userId` (string|null), enums for statuses/method, integer piasters, maps/arrays (`itemsSnapshot`, `shippingAddress`, `statusTimeline`), timestamps.
4. **Required Fields**: `orderNumber`, `idempotencyKey`, `locale`, `currency`, `status`, `paymentMethod`, `paymentStatus`, `codCollectionStatus`, `subtotalPiasters`, `discountPiasters`, `shippingPiasters`, `codFeePiasters`, `totalPiasters`, `itemsSnapshot`, `shippingAddress`, `createdAt`, `updatedAt`.
5. **Optional Fields**: `userId`, `discountCode`, `trackingNumber`, `internalNotes`.
6. **Relationships**: `userId` -> `users/{userId}`; `itemsSnapshot[].variantId` -> `variants/{variantId}`; linked to `payments` and `stockMovements`.
7. **Validation Rules**: Server Zod + Firestore Transaction validation only.
8. **Server-Only Fields**: All fields are server-written.
9. **Read Permissions**: Order owner (`userId == request.auth.uid`) or Admin (`owner` / `manager` / `staff`).
10. **Write Permissions**: `false` from client SDK (server-only).
11. **Required Indexes**: `(userId ASC, createdAt DESC)`, `(orderNumber ASC)`, `(status ASC, createdAt DESC)`, `(idempotencyKey ASC)`.

## 11. `counters` (`/counters/{counterId}`)
1. **Purpose**: Transactional atomic counters for sequential order numbers (`orders_2026` -> `FAV-2026-000001`).
2. **Field Names**: `value`, `updatedAt`.
3. **Field Types**: `value` (integer), `updatedAt` (timestamp).
4. **Required Fields**: `value`, `updatedAt`.
5. **Optional Fields**: None.
6. **Relationships**: Used inside `orders` creation Firestore transaction.
7. **Validation Rules**: Server-only increment inside transaction.
8. **Server-Only Fields**: All fields.
9. **Read Permissions**: `false` for all clients.
10. **Write Permissions**: `false` for all clients.
11. **Required Indexes**: Document ID lookup.

## 12. `payments` (`/payments/{paymentId}`)
1. **Purpose**: Payment transaction records, InstaPay receipt references/verification status, Paymob webhook event deduplication, and COD collection state.
2. **Field Names**: `orderId`, `orderNumber`, `method`, `status`, `amountPiasters`, `currency`, `providerTransactionId`, `receiptFilePath`, `reviewedBy`, `reviewedAt`, `rejectionReason`, `webhookEventIds`, `createdAt`, `updatedAt`.
3. **Field Types**: Strings, integer `amountPiasters`, enums, array `webhookEventIds`, timestamps.
4. **Required Fields**: `orderId`, `orderNumber`, `method`, `status`, `amountPiasters`, `currency`, `createdAt`, `updatedAt`.
5. **Optional Fields**: `providerTransactionId`, `receiptFilePath`, `reviewedBy`, `reviewedAt`, `rejectionReason`, `webhookEventIds`.
6. **Relationships**: `orderId` -> `orders/{orderId}`.
7. **Validation Rules**: Server-side HMAC verification for Paymob; admin-verified approval for InstaPay.
8. **Server-Only Fields**: All fields.
9. **Read Permissions**: Order owner (non-sensitive summary via server API) or Admin (`owner` / `manager`).
10. **Write Permissions**: `false` from client SDK.
11. **Required Indexes**: `(orderId ASC, createdAt DESC)`, `(providerTransactionId ASC)`.

## 13. `discounts` (`/discounts/{discountId}`)
1. **Purpose**: Server-evaluated discount/coupon rules.
2. **Field Names**: `code`, `type`, `value`, `minOrderPiasters`, `maxDiscountPiasters`, `startsAt`, `endsAt`, `usageLimit`, `usedCount`, `perCustomerLimit`, `eligibleProductIds`, `eligibleCollectionIds`, `active`, `createdAt`, `updatedAt`.
3. **Field Types**: `code` (string uppercase), `type` (`"percentage" | "fixed" | "free_shipping"`), integers (`value`, limits, piasters), arrays of IDs, boolean, timestamps.
4. **Required Fields**: `code`, `type`, `value`, `usedCount`, `active`, `createdAt`, `updatedAt`.
5. **Optional Fields**: `minOrderPiasters`, `maxDiscountPiasters`, `startsAt`, `endsAt`, `usageLimit`, `perCustomerLimit`, `eligibleProductIds`, `eligibleCollectionIds`.
6. **Relationships**: Linked to `discountRedemptions` and `orders`.
7. **Validation Rules**: Percentage `1..100`, fixed integer piasters `> 0`.
8. **Server-Only Fields**: `usedCount` (atomically incremented inside checkout transaction).
9. **Read Permissions**: Admin (`owner`, `manager`) only; public validation runs through server `/api/checkout/validate-discount`.
10. **Write Permissions**: `false` from client SDK (server-only).
11. **Required Indexes**: `(code ASC, active ASC)`.

## 14. `discountRedemptions` (`/discountRedemptions/{redemptionId}`)
1. **Purpose**: Tracks per-customer / per-email / per-phone coupon usage to enforce `perCustomerLimit`.
2. **Field Names**: `discountId`, `code`, `orderId`, `customerKey` (normalized userId or email/phone hash), `createdAt`.
3. **Field Types**: Strings, timestamp.
4. **Required Fields**: `discountId`, `code`, `orderId`, `customerKey`, `createdAt`.
5. **Optional Fields**: None.
6. **Relationships**: `discountId` -> `discounts/{discountId}`, `orderId` -> `orders/{orderId}`.
7. **Validation Rules**: Written inside checkout transaction.
8. **Server-Only Fields**: All fields.
9. **Read Permissions**: Admin (`owner`, `manager`).
10. **Write Permissions**: `false` from client SDK.
11. **Required Indexes**: `(discountId ASC, customerKey ASC)`.

## 15. `shippingZones` (`/shippingZones/{zoneId}`)
1. **Purpose**: Admin-configured shipping fee tiers, free-shipping thresholds, COD fees, and delivery estimates.
2. **Field Names**: `name_ar`, `name_en`, `governorateCodes`, `feePiasters`, `codFeePiasters`, `freeShippingThresholdPiasters`, `estimatedDaysMin`, `estimatedDaysMax`, `active`, `updatedAt`.
3. **Field Types**: Strings, `governorateCodes` (array of uppercase codes), nullable integers (`feePiasters`, `codFeePiasters`, `freeShippingThresholdPiasters`, `estimatedDaysMin`, `estimatedDaysMax`), boolean, timestamp.
4. **Required Fields**: `name_ar`, `name_en`, `governorateCodes`, `active`, `updatedAt`.
5. **Optional Fields**: Fee/estimate integers (null until owner configures real rates).
6. **Relationships**: Linked to `governorates.zoneId`.
7. **Validation Rules**: Non-negative integer piasters.
8. **Server-Only Fields**: Admin-managed.
9. **Read Permissions**: Public when `active == true`; Admins read all.
10. **Write Permissions**: Server-verified `owner` / `manager`.
11. **Required Indexes**: `(active ASC)`.

## 16. `governorates` (`/governorates/{governorateCode}`)
1. **Purpose**: All 27 Egyptian governorates mapped to shipping zones and bilingual names.
2. **Field Names**: `code`, `name_ar`, `name_en`, `zoneId`, `active`, `sortOrder`, `updatedAt`.
3. **Field Types**: Strings, boolean, integer, timestamp.
4. **Required Fields**: `code`, `name_ar`, `name_en`, `active`, `sortOrder`, `updatedAt`.
5. **Optional Fields**: `zoneId`.
6. **Relationships**: `zoneId` -> `shippingZones/{zoneId}`.
7. **Validation Rules**: Uppercase code `^[A-Z0-9_-]+$`.
8. **Server-Only Fields**: Admin-managed.
9. **Read Permissions**: Public read for active governorates; Admins read all.
10. **Write Permissions**: Server-verified `owner` / `manager`.
11. **Required Indexes**: `(active ASC, sortOrder ASC)`.

## 17. `stockMovements` (`/stockMovements/{movementId}`)
1. **Purpose**: Immutable audit history of every stock change (orders, cancellations, admin adjustments).
2. **Field Names**: `productId`, `variantId`, `sku`, `previousQuantity`, `newQuantity`, `delta`, `reason`, `orderId`, `actorUid`, `actorRole`, `createdAt`.
3. **Field Types**: Strings, integers (`previousQuantity`, `newQuantity`, `delta`), timestamp.
4. **Required Fields**: `productId`, `variantId`, `sku`, `previousQuantity`, `newQuantity`, `delta`, `reason`, `actorUid`, `createdAt`.
5. **Optional Fields**: `orderId`, `actorRole`.
6. **Relationships**: `variantId` -> `variants/{variantId}`, `orderId` -> `orders/{orderId}`.
7. **Validation Rules**: Server-only write inside transactions.
8. **Server-Only Fields**: All fields.
9. **Read Permissions**: Admin (`owner`, `manager`, `staff`).
10. **Write Permissions**: `false` from client SDK.
11. **Required Indexes**: `(variantId ASC, createdAt DESC)`, `(productId ASC, createdAt DESC)`.

## 18. `subscribers` (`/subscribers/{subscriberId}`)
1. **Purpose**: Newsletter subscription records with duplicate prevention.
2. **Field Names**: `email`, `locale`, `status`, `createdAt`.
3. **Field Types**: `email` (string lowercase), `locale` (`"ar" | "en"`), `status` (`"subscribed" | "unsubscribed"`), timestamp.
4. **Required Fields**: `email`, `locale`, `status`, `createdAt`.
5. **Optional Fields**: None.
6. **Relationships**: Document ID is deterministic base64url of normalized email.
7. **Validation Rules**: Valid email, server-only write.
8. **Server-Only Fields**: All fields.
9. **Read Permissions**: Admin (`owner`, `manager`).
10. **Write Permissions**: `false` from client SDK (server `/api/newsletter`).
11. **Required Indexes**: `(status ASC, createdAt DESC)`.

## 19. `contactMessages` (`/contactMessages/{messageId}`)
1. **Purpose**: Customer inquiry inbox submissions.
2. **Field Names**: `name`, `email`, `phone`, `subject`, `message`, `locale`, `status`, `createdAt`.
3. **Field Types**: Strings, `locale` (`"ar" | "en"`), `status` (`"new" | "read" | "resolved"`), timestamp.
4. **Required Fields**: `name`, `email`, `subject`, `message`, `locale`, `status`, `createdAt`.
5. **Optional Fields**: `phone`.
6. **Relationships**: None.
7. **Validation Rules**: Zod server validation + rate limiting.
8. **Server-Only Fields**: `status`, `createdAt`.
9. **Read Permissions**: Admin (`owner`, `manager`, `staff`).
10. **Write Permissions**: `false` from client SDK (server `/api/contact` and admin status updates).
11. **Required Indexes**: `(status ASC, createdAt DESC)`.

## 20. `settings` (`/settings/{settingKey}`)
1. **Purpose**: Storefront global configuration (payment methods enabled/instructions, InstaPay instructions, social links, footer text, contact details, media library index).
2. **Field Names**: Keyed documents (`payment`, `storefront`, `social`, `mediaLibrary`) with strictly typed bilingual fields and zero secrets.
3. **Field Types**: Maps, booleans, strings, timestamps.
4. **Required Fields**: `updatedAt`, `updatedBy`.
5. **Optional Fields**: Method-specific public configuration (never private API secrets).
6. **Relationships**: Referenced by storefront footer/checkout/contact.
7. **Validation Rules**: Server-side Zod validation; private API keys remain strictly in environment variables.
8. **Server-Only Fields**: `updatedAt`, `updatedBy`.
9. **Read Permissions**: Public for `storefront`, `social`, and non-secret `payment` instructions; Admin for all.
10. **Write Permissions**: `false` from client SDK (server-verified `owner` / `manager`).
11. **Required Indexes**: Document ID lookup.

## 21. `auditLogs` (`/auditLogs/{logId}`)
1. **Purpose**: Immutable server-written record of every administrative action.
2. **Field Names**: `actorUid`, `actorRole`, `action`, `targetCollection`, `targetId`, `previousValue`, `newValue`, `createdAt`.
3. **Field Types**: Strings, `actorRole` (`"owner" | "manager" | "staff"`), optional maps (`previousValue`, `newValue`), timestamp.
4. **Required Fields**: `actorUid`, `actorRole`, `action`, `targetCollection`, `targetId`, `createdAt`.
5. **Optional Fields**: `previousValue`, `newValue`.
6. **Relationships**: References actor in `adminProfiles` and affected entity.
7. **Validation Rules**: Strictly immutable; server-written only.
8. **Server-Only Fields**: All fields.
9. **Read Permissions**: Admin (`owner`, `manager`).
10. **Write Permissions**: `false` from client SDK.
11. **Required Indexes**: `(createdAt DESC)`, `(actorUid ASC, createdAt DESC)`, `(targetCollection ASC, createdAt DESC)`.
