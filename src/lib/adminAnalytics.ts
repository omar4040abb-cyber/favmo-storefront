import type { AdminTab, Locale, Order, Product, ProductVariant } from '../types/domain';

export type AnalyticsGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function toJsDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === 'object') {
    const obj = ts as { toDate?: () => Date; seconds?: number };
    if (typeof obj.toDate === 'function') {
      const d = obj.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof obj.seconds === 'number') {
      const d = new Date(obj.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

export function formatShortDate(ts: unknown, locale: Locale): string {
  const d = toJsDate(ts);
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(ts: unknown, locale: Locale): string {
  const d = toJsDate(ts);
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export interface ProductStockSummary {
  product: Product;
  totalStock: number;
  lowVariantsCount: number;
  outVariantsCount: number;
  threshold: number;
}

export function summarizeProductStock(
  products: Product[],
  variants: ProductVariant[]
): {
  lowStockProducts: ProductStockSummary[];
  outOfStockProducts: ProductStockSummary[];
  lowStockVariants: ProductVariant[];
  outOfStockVariants: ProductVariant[];
} {
  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.productId) || [];
    list.push(v);
    variantsByProduct.set(v.productId, list);
  }

  const lowStockProducts: ProductStockSummary[] = [];
  const outOfStockProducts: ProductStockSummary[] = [];

  for (const p of products) {
    const pVars = (variantsByProduct.get(p.id) || []).filter((v) => v.active);
    const totalStock = pVars.reduce((sum, v) => sum + Math.max(0, v.stock || 0), 0);
    const threshold = p.lowStockThreshold ?? 5;
    const lowVars = pVars.filter(
      (v) => v.stock > 0 && v.stock <= (v.lowStockThreshold ?? threshold)
    ).length;
    const outVars = pVars.filter((v) => v.stock <= 0).length;

    if (pVars.length > 0 && totalStock <= 0) {
      outOfStockProducts.push({
        product: p,
        totalStock,
        lowVariantsCount: lowVars,
        outVariantsCount: outVars,
        threshold,
      });
    } else if (lowVars > 0 || (totalStock > 0 && totalStock <= threshold)) {
      lowStockProducts.push({
        product: p,
        totalStock,
        lowVariantsCount: lowVars,
        outVariantsCount: outVars,
        threshold,
      });
    }
  }

  const lowStockVariants = variants.filter(
    (v) => v.active && v.stock > 0 && v.stock <= (v.lowStockThreshold ?? 3)
  );
  const outOfStockVariants = variants.filter((v) => v.active && v.stock <= 0);

  return { lowStockProducts, outOfStockProducts, lowStockVariants, outOfStockVariants };
}

export function computeThirtyDayDelta(
  orders: Order[],
  metric: 'revenue' | 'orders'
): number | null {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const currentStart = now - thirtyDays;
  const prevStart = now - 2 * thirtyDays;

  let currentVal = 0;
  let prevVal = 0;

  for (const o of orders) {
    if (
      metric === 'revenue' &&
      (o.status === 'cancelled' || o.status === 'refunded' || o.status === 'returned')
    ) {
      continue;
    }
    const d = toJsDate(o.createdAt);
    if (!d) continue;
    const ms = d.getTime();
    const val = metric === 'revenue' ? o.totalPiasters || 0 : 1;
    if (ms >= currentStart) currentVal += val;
    else if (ms >= prevStart && ms < currentStart) prevVal += val;
  }

  // Strictly only show a percentage delta when prior-period records exist in DB
  if (prevVal <= 0) return null;
  return Math.round(((currentVal - prevVal) / prevVal) * 100);
}

export interface ChartBucket {
  key: string;
  label: string;
  revenuePiasters: number;
  ordersCount: number;
}

export function buildSalesSeries(
  orders: Order[],
  granularity: AnalyticsGranularity,
  locale: Locale
): ChartBucket[] {
  const validOrders = orders.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'refunded' && o.status !== 'returned'
  );
  const now = new Date();
  const buckets = new Map<string, ChartBucket>();

  if (granularity === 'daily') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
        month: 'short',
        day: 'numeric',
      }).format(d);
      buckets.set(key, { key, label, revenuePiasters: 0, ordersCount: 0 });
    }
    for (const o of validOrders) {
      const d = toJsDate(o.createdAt);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const b = buckets.get(key);
      if (b) {
        b.revenuePiasters += o.totalPiasters || 0;
        b.ordersCount += 1;
      }
    }
  } else if (granularity === 'weekly') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const day = d.getDay();
      const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
      const key = `${weekStart.getFullYear()}-W${String(weekStart.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(weekStart.getDate()).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
        month: 'short',
        day: 'numeric',
      }).format(weekStart);
      if (!buckets.has(key)) {
        buckets.set(key, { key, label, revenuePiasters: 0, ordersCount: 0 });
      }
    }
    for (const o of validOrders) {
      const d = toJsDate(o.createdAt);
      if (!d) continue;
      const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
      const key = `${weekStart.getFullYear()}-W${String(weekStart.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(weekStart.getDate()).padStart(2, '0')}`;
      const b = buckets.get(key);
      if (b) {
        b.revenuePiasters += o.totalPiasters || 0;
        b.ordersCount += 1;
      }
    }
  } else if (granularity === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
        month: 'short',
        year: '2-digit',
      }).format(d);
      buckets.set(key, { key, label, revenuePiasters: 0, ordersCount: 0 });
    }
    for (const o of validOrders) {
      const d = toJsDate(o.createdAt);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = buckets.get(key);
      if (b) {
        b.revenuePiasters += o.totalPiasters || 0;
        b.ordersCount += 1;
      }
    }
  } else {
    const years = new Set<number>([now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]);
    for (const o of validOrders) {
      const d = toJsDate(o.createdAt);
      if (d) years.add(d.getFullYear());
    }
    for (const y of Array.from(years).sort((a, b) => a - b)) {
      buckets.set(String(y), {
        key: String(y),
        label: String(y),
        revenuePiasters: 0,
        ordersCount: 0,
      });
    }
    for (const o of validOrders) {
      const d = toJsDate(o.createdAt);
      if (!d) continue;
      const b = buckets.get(String(d.getFullYear()));
      if (b) {
        b.revenuePiasters += o.totalPiasters || 0;
        b.ordersCount += 1;
      }
    }
  }

  return Array.from(buckets.values());
}

export interface TopSellingProductRow {
  productId: string;
  name_ar: string;
  name_en: string;
  unitsSold: number;
  revenuePiasters: number;
  imageUrl?: string;
}

export function buildTopSellingProducts(
  orders: Order[],
  products: Product[]
): TopSellingProductRow[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const map = new Map<string, TopSellingProductRow>();

  for (const ord of orders) {
    if (ord.status === 'cancelled' || ord.status === 'refunded' || ord.status === 'returned') {
      continue;
    }
    for (const item of ord.itemsSnapshot || []) {
      const p = productMap.get(item.productId);
      const existing = map.get(item.productId) || {
        productId: item.productId,
        name_ar: item.name_ar || p?.name_ar || item.productId,
        name_en: item.name_en || p?.name_en || item.productId,
        unitsSold: 0,
        revenuePiasters: 0,
        imageUrl:
          item.imageUrl ||
          p?.media?.find((m) => m.isMain)?.url ||
          p?.colors?.[0]?.frontImageUrl ||
          p?.media?.[0]?.url,
      };
      existing.unitsSold += Number(item.quantity || 0);
      existing.revenuePiasters += Number(item.lineTotalPiasters || 0);
      map.set(item.productId, existing);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenuePiasters - a.revenuePiasters)
    .slice(0, 6);
}

export type AdminNavigateFn = (tab: AdminTab, options?: { orderId?: string; search?: string }) => void;
