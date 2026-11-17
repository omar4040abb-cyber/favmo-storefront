import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import type {
  AuditLogEntry,
  ClothingSize,
  Collection,
  CustomerSummary,
  Discount,
  Locale,
  Order,
  OrderItemSnapshot,
  OrderLookup,
  OrderStatus,
  PaymentMethod,
  PaymentSettings,
  Product,
  ProductReview,
  ProductStatus,
  ProductVariant,
  ShippingAddressSnapshot,
  ShippingZone,
  StockMovement,
  StorefrontSettings,
} from '../types/domain';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAdminImage(
  file: File,
  idToken: string,
  purpose: 'product' | 'logo' | 'banner' = 'product'
): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ dataUrl, purpose }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'IMAGE_UPLOAD_FAILED');
  }
  return data.url as string;
}

export async function uploadReceiptImage(file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const res = await fetch('/api/uploads/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'RECEIPT_UPLOAD_FAILED');
  }
  return data.url as string;
}

// -----------------------------------------------------------------------------
// Collections / Categories
// -----------------------------------------------------------------------------
export async function fetchCollections(includeInactive = false): Promise<Collection[]> {
  try {
    const q = includeInactive
      ? query(collection(db, 'collections'))
      : query(collection(db, 'collections'), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Collection, 'id'>) }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'collections');
  }
}

export async function saveCollectionAdmin(
  id: string | null,
  payload: {
    slug: string;
    parentId?: string | null;
    name_ar: string;
    name_en: string;
    description_ar?: string;
    description_en?: string;
    heroImageUrl?: string;
    active: boolean;
    sortOrder: number;
  }
): Promise<string> {
  const docId = id || payload.slug.replace(/[^a-z0-9\-]/g, '-') || `col-${Date.now()}`;
  const ref = doc(db, 'collections', docId);
  const cleanData = {
    slug: payload.slug,
    parentId: payload.parentId || null,
    name_ar: payload.name_ar,
    name_en: payload.name_en,
    description_ar: payload.description_ar || '',
    description_en: payload.description_en || '',
    heroImageUrl: payload.heroImageUrl || '',
    active: Boolean(payload.active),
    sortOrder: Math.max(0, Math.trunc(payload.sortOrder || 0)),
  };
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        ...cleanData,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...cleanData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `collections/${docId}`);
  }
}

export async function deleteCollectionAdmin(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'collections', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `collections/${id}`);
  }
}

// -----------------------------------------------------------------------------
// Products & Variants
// -----------------------------------------------------------------------------
export async function fetchPublishedProducts(): Promise<Product[]> {
  try {
    const q = query(
      collection(db, 'products'),
      where('status', 'in', ['published', 'paused', 'unavailable'])
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'products');
  }
}

export async function fetchAllProductsAdmin(): Promise<Product[]> {
  try {
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'products');
  }
}

export async function fetchAllActiveVariants(): Promise<ProductVariant[]> {
  try {
    const q = query(collection(db, 'variants'), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductVariant, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'variants');
  }
}

export async function fetchAllVariantsAdmin(): Promise<ProductVariant[]> {
  try {
    const snap = await getDocs(collection(db, 'variants'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductVariant, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'variants');
  }
}

export async function saveProductWithVariantsAdmin(
  productId: string | null,
  productPayload: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  variantInputs: Array<{
    id?: string;
    sku: string;
    colorKey: string;
    colorName_ar: string;
    colorName_en: string;
    colorHex: string;
    size: ClothingSize;
    pricePiasters?: number | null;
    stock: number;
    soldCount?: number;
    lowStockThreshold: number;
    active: boolean;
  }>
): Promise<string> {
  const safeId =
    productId ||
    `${productPayload.slug.replace(/[^a-z0-9\-]/g, '-')}-${Date.now().toString(36)}`;
  const prodRef = doc(db, 'products', safeId);

  try {
    const existing = await getDoc(prodRef);
    const cleanPayload: Record<string, unknown> = {
      sku: productPayload.sku?.trim() || '',
      slug: productPayload.slug,
      collectionId: productPayload.collectionId,
      subcategoryId: productPayload.subcategoryId || '',
      apparelType: productPayload.apparelType?.trim() || '',
      name_ar: productPayload.name_ar,
      name_en: productPayload.name_en,
      description_ar: productPayload.description_ar || '',
      description_en: productPayload.description_en || '',
      specs_ar: productPayload.specs_ar || '',
      specs_en: productPayload.specs_en || '',
      seoTitle_ar: productPayload.seoTitle_ar || '',
      seoTitle_en: productPayload.seoTitle_en || '',
      seoDescription_ar: productPayload.seoDescription_ar || '',
      seoDescription_en: productPayload.seoDescription_en || '',
      pricePiasters: Math.trunc(productPayload.pricePiasters),
      salePricePiasters:
        productPayload.salePricePiasters && productPayload.salePricePiasters > 0
          ? Math.trunc(productPayload.salePricePiasters)
          : null,
      currency: 'EGP',
      // Guard legacy/incomplete product records so Firestore never receives
      // an undefined status. Draft is the safe fallback for malformed data.
      status: productPayload.status || 'draft',
      isNew: Boolean(productPayload.isNew),
      featured: Boolean(productPayload.featured),
      isBestSelling: Boolean(productPayload.isBestSelling),
      availableSizes: productPayload.availableSizes || ['S', 'M', 'L', 'XL', 'XXL'],
      lowStockThreshold: Math.max(0, Math.trunc(productPayload.lowStockThreshold ?? 5)),
      salesCount: Math.trunc(productPayload.salesCount || 0),
      colors: productPayload.colors || [],
      media: productPayload.media || [],
      sizeChart: productPayload.sizeChart || [],
      updatedAt: serverTimestamp(),
    };

    if (existing.exists()) {
      cleanPayload.createdAt = existing.data().createdAt;
      await setDoc(prodRef, cleanPayload);
    } else {
      cleanPayload.createdAt = serverTimestamp();
      await setDoc(prodRef, cleanPayload);
    }

    // Sync variants
    const existingVariantsSnap = await getDocs(
      query(collection(db, 'variants'), where('productId', '==', safeId))
    );
    const existingSoldMap = new Map<string, number>();
    for (const oldDoc of existingVariantsSnap.docs) {
      existingSoldMap.set(oldDoc.id, Number(oldDoc.data().soldCount || 0));
    }

    const batch = writeBatch(db);
    const incomingIds = new Set<string>();

    for (const v of variantInputs) {
      const varId =
        v.id || `${safeId}-${v.colorKey}-${v.size}`.replace(/[^a-zA-Z0-9_\-]/g, '-');
      incomingIds.add(varId);
      batch.set(doc(db, 'variants', varId), {
        productId: safeId,
        sku: v.sku.trim(),
        colorKey: v.colorKey,
        colorName_ar: v.colorName_ar,
        colorName_en: v.colorName_en,
        colorHex: v.colorHex,
        size: v.size,
        pricePiasters:
          v.pricePiasters && v.pricePiasters > 0 ? Math.trunc(v.pricePiasters) : null,
        stock: Math.max(0, Math.trunc(v.stock)),
        soldCount: Math.max(0, Math.trunc(v.soldCount ?? existingSoldMap.get(varId) ?? 0)),
        lowStockThreshold: Math.max(0, Math.trunc(v.lowStockThreshold)),
        active: Boolean(v.active),
        updatedAt: serverTimestamp(),
      });
    }

    for (const oldDoc of existingVariantsSnap.docs) {
      if (!incomingIds.has(oldDoc.id)) {
        batch.delete(oldDoc.ref);
      }
    }

    await batch.commit();
    return safeId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${safeId}`);
  }
}

export async function deleteProductAdmin(productId: string): Promise<void> {
  try {
    const varsSnap = await getDocs(
      query(collection(db, 'variants'), where('productId', '==', productId))
    );
    const batch = writeBatch(db);
    for (const vDoc of varsSnap.docs) {
      batch.delete(vDoc.ref);
    }
    batch.delete(doc(db, 'products', productId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
}

export async function toggleProductStatusAdmin(
  product: Product,
  nextStatus: ProductStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'products', product.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
  }
}

export async function adjustVariantStockAdmin(
  variant: ProductVariant,
  newStock: number,
  reason: string,
  actorUid: string
): Promise<void> {
  const clamped = Math.max(0, Math.trunc(newStock));
  const delta = clamped - variant.stock;
  const batch = writeBatch(db);
  batch.update(doc(db, 'variants', variant.id), {
    stock: clamped,
    updatedAt: serverTimestamp(),
  });
  const movRef = doc(collection(db, 'stockMovements'));
  batch.set(movRef, {
    productId: variant.productId,
    variantId: variant.id,
    sku: variant.sku,
    previousQuantity: variant.stock,
    newQuantity: clamped,
    delta,
    reason: reason.trim() || 'Manual Admin Adjustment',
    actorUid,
    createdAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `variants/${variant.id}`);
  }
}

export async function fetchStockMovementsAdmin(): Promise<StockMovement[]> {
  try {
    const q = query(collection(db, 'stockMovements'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, 'id'>) }));
  } catch {
    const snap = await getDocs(collection(db, 'stockMovements'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, 'id'>) }));
  }
}

// -----------------------------------------------------------------------------
// Orders & Admin Order Management
// -----------------------------------------------------------------------------
export async function fetchAllOrdersAdmin(): Promise<Order[]> {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
      .sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'orders');
  }
}

export async function fetchCustomerOrders(uid: string): Promise<Order[]> {
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
      .sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'orders');
  }
}

export async function updateOrderAdmin(
  order: Order,
  updates: {
    status?: OrderStatus;
    paymentStatus?: Order['paymentStatus'];
    codCollectionStatus?: Order['codCollectionStatus'];
    trackingNumber?: string;
    internalNotes?: string;
  },
  actorUid: string,
  idToken?: string | null
): Promise<void> {
  const nextStatus = updates.status ?? order.status;
  const nextPayStatus = updates.paymentStatus ?? order.paymentStatus;
  const nextCodCollectionStatus = updates.codCollectionStatus ?? order.codCollectionStatus ??
    (order.paymentMethod === 'cod' ? 'pending_collection' : 'not_applicable');
  const shouldRestoreStock =
    (nextStatus === 'cancelled' || nextStatus === 'returned' || nextStatus === 'refunded') &&
    order.status !== 'cancelled' &&
    order.status !== 'returned' &&
    order.status !== 'refunded';

  const nextTimeline = [...(order.statusTimeline || [])];
  if (updates.status && updates.status !== order.status) {
    nextTimeline.push({ status: updates.status, at: new Date().toISOString() });
  }

  try {
    await runTransaction(db, async (tx) => {
      const orderRef = doc(db, 'orders', order.id);
      const lookupRef = doc(db, 'orderLookups', order.orderNumber);
      const lookupSnap = await tx.get(lookupRef);
      const stockRows = shouldRestoreStock
        ? await Promise.all((order.itemsSnapshot || []).map(async (item) => {
            const varRef = doc(db, 'variants', item.variantId);
            const varSnap = await tx.get(varRef);
            return { item, varRef, varSnap };
          }))
        : [];

      // Firestore transactions require every read to finish before the first write.
      for (const { item, varRef, varSnap } of stockRows) {
        if (varSnap.exists()) {
          const cur = Number(varSnap.data().stock || 0);
          tx.update(varRef, {
            stock: cur + item.quantity,
            updatedAt: serverTimestamp(),
          });
          const movRef = doc(collection(db, 'stockMovements'));
          tx.set(movRef, {
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            previousQuantity: cur,
            newQuantity: cur + item.quantity,
            delta: item.quantity,
            reason: `Order ${order.orderNumber} ${nextStatus}`,
            orderId: order.id,
            actorUid,
            createdAt: serverTimestamp(),
          });
        }
      }

      tx.update(orderRef, {
        status: nextStatus,
        paymentStatus: nextPayStatus,
        codCollectionStatus: nextCodCollectionStatus,
        trackingNumber: updates.trackingNumber ?? order.trackingNumber ?? '',
        internalNotes: updates.internalNotes ?? order.internalNotes ?? '',
        statusTimeline: nextTimeline,
        updatedAt: serverTimestamp(),
      });

      if (lookupSnap.exists()) {
        tx.update(lookupRef, {
          status: nextStatus,
          paymentStatus: nextPayStatus,
          trackingNumber: updates.trackingNumber ?? order.trackingNumber ?? '',
          statusTimeline: nextTimeline,
          updatedAt: serverTimestamp(),
        });
      }
    });

    if (
      idToken &&
      order.shippingAddress?.email &&
      (updates.status !== order.status || updates.paymentStatus !== order.paymentStatus)
    ) {
      fetch('/api/notify/order-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          to: order.shippingAddress.email,
          orderNumber: order.orderNumber,
          status: nextStatus,
          paymentStatus: nextPayStatus,
          locale: order.locale,
          trackingNumber: updates.trackingNumber ?? order.trackingNumber ?? '',
        }),
      }).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
  }
}

// -----------------------------------------------------------------------------
// Customer Product Reviews & Admin Moderation
// -----------------------------------------------------------------------------
export async function fetchProductReviews(productId: string): Promise<ProductReview[]> {
  try {
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', productId),
      where('status', '==', 'approved')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ProductReview, 'id'>) }))
      .sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
      });
  } catch {
    return [];
  }
}

export async function fetchAllReviewsAdmin(): Promise<ProductReview[]> {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ProductReview, 'id'>) }))
      .sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
      });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'reviews');
  }
}

export async function submitProductReview(payload: {
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
}): Promise<string> {
  const ref = doc(collection(db, 'reviews'));
  try {
    await setDoc(ref, {
      productId: payload.productId,
      userId: payload.userId,
      authorName: payload.authorName.trim().slice(0, 100),
      rating: Math.max(1, Math.min(5, Math.trunc(payload.rating))),
      comment: payload.comment.trim().slice(0, 2000),
      status: 'approved',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `reviews/${ref.id}`);
  }
}

export async function moderateReviewAdmin(
  review: ProductReview,
  status: ProductReview['status']
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reviews', review.id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reviews/${review.id}`);
  }
}

export async function deleteReviewAdmin(reviewId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reviews/${reviewId}`);
  }
}

// -----------------------------------------------------------------------------
// Discounts
// -----------------------------------------------------------------------------
export async function fetchAllDiscountsAdmin(): Promise<Discount[]> {
  try {
    const snap = await getDocs(collection(db, 'discounts'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Discount, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'discounts');
  }
}

export async function saveDiscountAdmin(
  idToken: string,
  payload: Omit<Discount, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'> & {
    usedCount?: number;
  }
): Promise<void> {
  const response = await fetch('/api/admin/discounts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'DISCOUNT_SAVE_FAILED');
}

export async function deleteDiscountAdmin(code: string, idToken: string): Promise<void> {
  const response = await fetch(`/api/admin/discounts/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'DISCOUNT_DELETE_FAILED');
}

export async function evaluateDiscountCode(
  codeRaw: string,
  subtotalPiasters: number,
  itemCount = 0,
  lowestUnitPricePiasters = 0
): Promise<{ valid: boolean; discountPiasters: number; freeShipping: boolean; discount?: Discount }> {
  const code = codeRaw.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
  if (!code) return { valid: false, discountPiasters: 0, freeShipping: false };
  try {
    const snap = await getDoc(doc(db, 'discounts', code));
    if (!snap.exists()) return { valid: false, discountPiasters: 0, freeShipping: false };
    const d = { id: snap.id, ...(snap.data() as Omit<Discount, 'id'>) };
    if (!d.active) return { valid: false, discountPiasters: 0, freeShipping: false };

    const nowIso = new Date().toISOString();
    if (d.startsAt && nowIso < d.startsAt) return { valid: false, discountPiasters: 0, freeShipping: false };
    if (d.endsAt && nowIso > d.endsAt) return { valid: false, discountPiasters: 0, freeShipping: false };
    if (d.minOrderPiasters && subtotalPiasters < d.minOrderPiasters) {
      return { valid: false, discountPiasters: 0, freeShipping: false };
    }
    if (d.minItems && itemCount < d.minItems) {
      return { valid: false, discountPiasters: 0, freeShipping: false };
    }
    if (d.usageLimit && d.usedCount >= d.usageLimit) {
      return { valid: false, discountPiasters: 0, freeShipping: false };
    }

    if (d.type === 'free_shipping') {
      return { valid: true, discountPiasters: 0, freeShipping: true, discount: d };
    }
    if (d.type === 'free_item') {
      return { valid: true, discountPiasters: Math.min(subtotalPiasters, lowestUnitPricePiasters), freeShipping: false, discount: d };
    }
    if (d.type === 'percentage') {
      let amount = Math.floor((subtotalPiasters * d.value) / 100);
      if (d.maxDiscountPiasters) amount = Math.min(amount, d.maxDiscountPiasters);
      return { valid: true, discountPiasters: amount, freeShipping: false, discount: d };
    }
    return {
      valid: true,
      discountPiasters: Math.min(subtotalPiasters, d.value),
      freeShipping: false,
      discount: d,
    };
  } catch {
    return { valid: false, discountPiasters: 0, freeShipping: false };
  }
}

// -----------------------------------------------------------------------------
// Shipping Zones & Store Settings
// -----------------------------------------------------------------------------
export async function fetchShippingZones(includeInactive = false): Promise<ShippingZone[]> {
  try {
    const q = includeInactive
      ? query(collection(db, 'shippingZones'))
      : query(collection(db, 'shippingZones'), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShippingZone, 'id'>) }));
  } catch {
    return [];
  }
}

export async function saveShippingZoneAdmin(
  id: string | null,
  payload: Omit<ShippingZone, 'id' | 'updatedAt'>
): Promise<string> {
  const safeId = id || `zone-${Date.now().toString(36)}`;
  try {
    await setDoc(doc(db, 'shippingZones', safeId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    return safeId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shippingZones/${safeId}`);
  }
}

export async function deleteShippingZoneAdmin(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'shippingZones', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `shippingZones/${id}`);
  }
}

export async function logAdminActionAdmin(
  actorUid: string,
  action: string,
  targetCollection: string,
  targetId: string
): Promise<void> {
  try {
    const ref = doc(collection(db, 'auditLogs'));
    await setDoc(ref, {
      actorUid,
      actorRole: 'owner',
      action: action.slice(0, 120),
      targetCollection: targetCollection.slice(0, 80),
      targetId: targetId.slice(0, 128),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Audit logging is best-effort and must not block primary admin operation
  }
}

export async function fetchAuditLogsAdmin(): Promise<AuditLogEntry[]> {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) }));
  } catch {
    try {
      const snap = await getDocs(collection(db, 'auditLogs'));
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) }))
        .sort((a, b) => {
          const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
          const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
          return bTime - aTime;
        });
    } catch {
      return [];
    }
  }
}

export async function fetchAdminProfileDoc(uid: string): Promise<{
  displayName?: string;
  photoUrl?: string;
} | null> {
  try {
    const snap = await getDoc(doc(db, 'adminProfiles', uid));
    if (snap.exists()) {
      return {
        displayName: snap.data().displayName as string | undefined,
        photoUrl: snap.data().photoUrl as string | undefined,
      };
    }
    const uSnap = await getDoc(doc(db, 'users', uid));
    if (uSnap.exists()) {
      return {
        displayName: uSnap.data().displayName as string | undefined,
        photoUrl: uSnap.data().photoUrl as string | undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveAdminProfileDoc(
  uid: string,
  email: string,
  data: { displayName: string; photoUrl?: string; preferredLocale?: Locale }
): Promise<void> {
  const safeName = data.displayName.trim().slice(0, 100) || 'FAVMO Owner';
  const safePhoto = (data.photoUrl || '').trim().slice(0, 1000);
  const ref = doc(db, 'adminProfiles', uid);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        displayName: safeName,
        photoUrl: safePhoto,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        email,
        displayName: safeName,
        photoUrl: safePhoto,
        role: 'owner',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        displayName: safeName,
        photoUrl: safePhoto,
        ...(data.preferredLocale ? { preferredLocale: data.preferredLocale } : {}),
        updatedAt: serverTimestamp(),
      });
    }
    await logAdminActionAdmin(uid, 'UPDATE_ADMIN_PROFILE', 'adminProfiles', uid);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `adminProfiles/${uid}`);
  }
}

export async function saveStorefrontSettingsAdmin(
  payload: StorefrontSettings,
  actorUid: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== actorUid) throw new Error('ADMIN_SESSION_REQUIRED');
  const token = await currentUser.getIdToken();
  const response = await fetch('/api/admin/storefront', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || 'STOREFRONT_SAVE_FAILED');
}

export async function savePaymentSettingsAdmin(
  payload: PaymentSettings,
  actorUid: string
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'settings', 'payment'),
      {
        ...payload,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid,
      },
      { merge: true }
    );
    await logAdminActionAdmin(actorUid, 'UPDATE_PAYMENT_SETTINGS', 'settings', 'payment');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/payment');
  }
}

export async function fetchAllCustomersAdmin(): Promise<CustomerSummary[]> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const results = await Promise.all(
      usersSnap.docs.map(async (uDoc) => {
        const uData = uDoc.data();
        let email: string | undefined;
        let phone: string | undefined;
        try {
          const privSnap = await getDoc(doc(db, 'users', uDoc.id, 'private', 'info'));
          if (privSnap.exists()) {
            email = privSnap.data().email;
            phone = privSnap.data().phone;
          }
        } catch {
          // ignore
        }
        return {
          uid: uDoc.id,
          displayName: String(uData.displayName || 'Customer'),
          preferredLocale: (uData.preferredLocale as Locale) || 'en',
          status: String(uData.status || 'active'),
          email,
          phone,
          createdAt: uData.createdAt,
        };
      })
    );
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

// -----------------------------------------------------------------------------
// Checkout & Order Tracking (Server-first with Transactional Fallback)
// -----------------------------------------------------------------------------
export interface PlaceOrderInput {
  idempotencyKey: string;
  locale: Locale;
  userId: string | null;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  discountCode?: string | null;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  shippingAddress: ShippingAddressSnapshot;
}

export async function placeOrder(
  input: PlaceOrderInput
): Promise<{ orderId: string; orderNumber: string }> {
  // 1. Primary path: Server-side authoritative /api/checkout
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (res.ok && data.orderNumber) {
      return { orderId: data.orderId, orderNumber: data.orderNumber };
    }
    if (res.status !== 503) {
      throw new Error(data.error || 'CHECKOUT_FAILED');
    }
  } catch (err) {
    if (
      err instanceof Error &&
      !err.message.includes('Failed to fetch') &&
      err.message !== 'FIREBASE_ADMIN_UNAVAILABLE'
    ) {
      // Only fall through on 503 server admin unavailability
      throw err;
    }
  }

  // 2. Hardened Firestore Transactional path (when sandbox server lacks SA key)
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'counters', `orders_${year}`);
  const orderRef = doc(collection(db, 'orders'));

  // Pre-fetch shipping zones & discount doc outside transaction write phase
  const zones = await fetchShippingZones(false);
  const matchedZone = zones.find((z) =>
    z.governorateCodes?.includes(input.shippingAddress.governorateCode)
  );

  const normalizedDiscountCode = input.discountCode
    ? input.discountCode.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '')
    : null;

  const result = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const nextSeq = (counterSnap.exists() ? Number(counterSnap.data().value || 0) : 0) + 1;
    const orderNumber = `FAV-${year}-${String(nextSeq).padStart(6, '0')}`;

    const itemDocuments = input.items.map((item) => ({
      item,
      productRef: doc(db, 'products', item.productId),
      variantRef: doc(db, 'variants', item.variantId),
    }));
    const itemSnapshots = await Promise.all(itemDocuments.map(async (row) => {
      const [productSnap, variantSnap] = await Promise.all([tx.get(row.productRef), tx.get(row.variantRef)]);
      return { ...row, productSnap, variantSnap };
    }));
    const preparedItems = itemSnapshots.map(({ item, productRef, variantRef, productSnap, variantSnap }) => {
      if (!productSnap.exists() || productSnap.data().status !== 'published') throw new Error('PRODUCT_UNAVAILABLE');
      if (!variantSnap.exists() || !variantSnap.data().active) throw new Error('VARIANT_UNAVAILABLE');
      const product = productSnap.data() as Product;
      const variant = variantSnap.data() as ProductVariant;
      if (variant.stock < item.quantity) throw new Error(`INSUFFICIENT_STOCK:${variant.sku}`);
      const unitPrice = Math.trunc(variant.pricePiasters ?? product.salePricePiasters ?? product.pricePiasters);
      const colorMatch = product.colors?.find((color) => color.colorKey === variant.colorKey);
      const mainMedia = product.media?.find((media) => media.isMain) || product.media?.[0];
      return { item, productRef, variantRef, product, variant, unitPrice, lineTotal: unitPrice * item.quantity, imageUrl: colorMatch?.frontImageUrl || mainMedia?.url || '' };
    });
    const subtotalPiasters = preparedItems.reduce((sum, row) => sum + row.lineTotal, 0);
    const itemsSnapshot: OrderItemSnapshot[] = preparedItems.map(({ item, product, variant, unitPrice, lineTotal, imageUrl }) => ({
      productId: item.productId,
      variantId: item.variantId,
      slug: product.slug,
      name_ar: product.name_ar,
      name_en: product.name_en,
      colorKey: variant.colorKey,
      colorName_ar: variant.colorName_ar,
      colorName_en: variant.colorName_en,
      size: variant.size,
      sku: variant.sku,
      unitPricePiasters: unitPrice,
      quantity: item.quantity,
      lineTotalPiasters: lineTotal,
      imageUrl,
    }));

    let shippingPiasters = matchedZone?.feePiasters ? Math.trunc(matchedZone.feePiasters) : 0;
    if (
      matchedZone?.freeShippingThresholdPiasters &&
      subtotalPiasters >= matchedZone.freeShippingThresholdPiasters
    ) {
      shippingPiasters = 0;
    }
    const codFeePiasters =
      input.paymentMethod === 'cod' && matchedZone?.codFeePiasters
        ? Math.trunc(matchedZone.codFeePiasters)
        : 0;

    let discountPiasters = 0;
    let appliedCode: string | null = null;
    let discountDocUpdate: ReturnType<typeof doc> | null = null;
    let discountUsedCount = 0;
    if (normalizedDiscountCode) {
      const discRef = doc(db, 'discounts', normalizedDiscountCode);
      const discSnap = await tx.get(discRef);
      if (discSnap.exists() && discSnap.data().active) {
        const d = discSnap.data() as Discount;
        const nowIso = new Date().toISOString();
        const minOk = !d.minOrderPiasters || subtotalPiasters >= d.minOrderPiasters;
        const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
        const minItemsOk = !d.minItems || itemCount >= d.minItems;
        const dateOk =
          (!d.startsAt || nowIso >= d.startsAt) && (!d.endsAt || nowIso <= d.endsAt);
        const limitOk = !d.usageLimit || d.usedCount < d.usageLimit;
        if (minOk && minItemsOk && dateOk && limitOk) {
          if (d.type === 'percentage') {
            discountPiasters = Math.floor((subtotalPiasters * d.value) / 100);
            if (d.maxDiscountPiasters) {
              discountPiasters = Math.min(discountPiasters, d.maxDiscountPiasters);
            }
          } else if (d.type === 'fixed') {
            discountPiasters = Math.min(subtotalPiasters, d.value);
          } else if (d.type === 'free_shipping') {
            shippingPiasters = 0;
          } else if (d.type === 'free_item') {
            const lowestUnitPrice = itemsSnapshot.reduce((min, item) => Math.min(min, item.unitPricePiasters), Number.POSITIVE_INFINITY);
            discountPiasters = Math.min(subtotalPiasters, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
          }
          appliedCode = normalizedDiscountCode;
          discountDocUpdate = discRef;
          discountUsedCount = Number(d.usedCount || 0);
        }
      }
    }

    const promotionRef = doc(db, 'quantityPromotions', 'current');
    const promotionSnap = await tx.get(promotionRef);
    const promotion = promotionSnap.exists() ? promotionSnap.data() : null;
    const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
    if (promotion?.active === true && itemCount >= Number(promotion.minItems || 1)) {
      if (promotion.rewardType === 'percentage') {
        discountPiasters = Math.max(discountPiasters, Math.floor(subtotalPiasters * Number(promotion.value || 0) / 100));
      } else if (promotion.rewardType === 'fixed') {
        discountPiasters = Math.max(discountPiasters, Math.min(subtotalPiasters, Number(promotion.value || 0)));
      } else if (promotion.rewardType === 'free_item') {
        const lowestUnitPrice = itemsSnapshot.reduce((min, item) => Math.min(min, item.unitPricePiasters), Number.POSITIVE_INFINITY);
        discountPiasters = Math.max(discountPiasters, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
      } else if (promotion.rewardType === 'free_shipping') {
        shippingPiasters = 0;
      }
    }

    // Complete all reads above before writing stock, counters, payments, or orders.
    if (discountDocUpdate) {
      tx.update(discountDocUpdate, { usedCount: discountUsedCount + 1, updatedAt: serverTimestamp() });
    }
    for (const row of preparedItems) {
      tx.update(row.variantRef, {
        stock: row.variant.stock - row.item.quantity,
        soldCount: Number(row.variant.soldCount || 0) + row.item.quantity,
        updatedAt: serverTimestamp(),
      });
      tx.set(doc(collection(db, 'stockMovements')), {
        productId: row.item.productId,
        variantId: row.item.variantId,
        sku: row.variant.sku,
        previousQuantity: row.variant.stock,
        newQuantity: row.variant.stock - row.item.quantity,
        delta: -row.item.quantity,
        reason: `Order ${orderNumber}`,
        orderId: orderRef.id,
        actorUid: input.userId || 'guest',
        createdAt: serverTimestamp(),
      });
    }

    const totalPiasters = Math.max(
      1,
      subtotalPiasters - discountPiasters + shippingPiasters + codFeePiasters
    );

    const paymentStatus =
      input.paymentMethod === 'instapay' ? 'awaiting_verification' : 'pending';
    const codCollectionStatus =
      input.paymentMethod === 'cod' ? 'pending_collection' : 'not_applicable';

    const timeline = [{ status: 'pending' as OrderStatus, at: new Date().toISOString() }];

    tx.set(counterRef, { value: nextSeq, updatedAt: serverTimestamp() });
    tx.set(orderRef, {
      orderNumber,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      locale: input.locale,
      currency: 'EGP',
      status: 'pending',
      paymentMethod: input.paymentMethod,
      paymentStatus,
      codCollectionStatus,
      subtotalPiasters,
      discountPiasters,
      shippingPiasters,
      codFeePiasters,
      totalPiasters,
      discountCode: appliedCode,
      receiptUrl: input.receiptUrl || '',
      itemsSnapshot,
      shippingAddress: input.shippingAddress,
      statusTimeline: timeline,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const phoneLast4 = input.shippingAddress.phone.replace(/\D/g, '').slice(-4);
    tx.set(doc(db, 'orderLookups', orderNumber), {
      orderNumber,
      phoneLast4,
      status: 'pending',
      paymentStatus,
      paymentMethod: input.paymentMethod,
      currency: 'EGP',
      totalPiasters,
      itemsCount: itemsSnapshot.length,
      statusTimeline: timeline,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(doc(collection(db, 'payments')), {
      orderId: orderRef.id,
      orderNumber,
      method: input.paymentMethod,
      status: paymentStatus,
      amountPiasters: totalPiasters,
      currency: 'EGP',
      receiptFilePath: input.receiptUrl || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { orderId: orderRef.id, orderNumber };
  });

  return result;
}

export async function trackOrderLookup(
  orderNumberRaw: string,
  phoneRaw: string
): Promise<OrderLookup | null> {
  const orderNumber = orderNumberRaw.trim().toUpperCase();
  const phoneLast4 = phoneRaw.replace(/\D/g, '').slice(-4);
  if (!/^FAV-[0-9]{4}-[0-9]{6}$/.test(orderNumber) || phoneLast4.length < 4) {
    return null;
  }

  try {
    const res = await fetch('/api/track-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, phone: phoneRaw }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.tracking as OrderLookup;
    }
    if (res.status === 404) return null;
  } catch {
    // fallback below
  }

  const snap = await getDoc(doc(db, 'orderLookups', orderNumber));
  if (!snap.exists()) return null;
  const data = snap.data() as OrderLookup;
  if (data.phoneLast4 !== phoneLast4) return null;
  return data;
}

export async function initiatePaymobSession(payload: {
  orderId: string;
  orderNumber: string;
  amountPiasters: number;
  billing: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    country?: string;
  };
}): Promise<{ ok: boolean; iframeUrl?: string; blocked?: boolean; error?: string; paymobMode?: string }> {
  const res = await fetch('/api/paymob/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as {
    ok: boolean;
    iframeUrl?: string;
    blocked?: boolean;
    error?: string;
    paymobMode?: string;
  };
}
