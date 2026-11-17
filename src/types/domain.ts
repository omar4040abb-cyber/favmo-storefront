export type Locale = 'ar' | 'en';

export type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL';

export const CLOTHING_SIZES: ClothingSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

export type AdminRole = 'owner' | 'staff';
export type AdminPermission =
  | 'catalog'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'discounts'
  | 'reviews'
  | 'analytics'
  | 'settings'
  | 'content';

export interface StaffApplication {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  desiredRole: 'employee' | 'manager';
  experience: string;
  status: 'pending' | 'approved' | 'rejected';
  permissions: AdminPermission[];
  passwordSetupRequired?: boolean;
  createdAt?: unknown;
}

export type ProductStatus = 'draft' | 'published' | 'paused' | 'unavailable' | 'archived';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PaymentMethod = 'cod' | 'instapay' | 'paymob';

export type PaymentStatus =
  | 'pending'
  | 'awaiting_verification'
  | 'paid'
  | 'failed'
  | 'rejected'
  | 'refunded';

export type CodCollectionStatus =
  | 'not_applicable'
  | 'pending_collection'
  | 'collected'
  | 'failed';

export interface ProductMediaItem {
  id?: string;
  angle: 'front' | 'back' | 'embroidery' | 'fabric' | 'detail';
  colorKey: string;
  url: string;
  alt_ar: string;
  alt_en: string;
  sortOrder: number;
  isMain?: boolean;
}

export interface ProductColorGallery {
  colorKey: string;
  colorName_ar: string;
  colorName_en: string;
  colorHex: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  embroideryImageUrl?: string;
  fabricImageUrl?: string;
}

export interface SizeMeasurementRow {
  size: ClothingSize;
  chestCm?: number | null;
  lengthCm?: number | null;
  shoulderCm?: number | null;
  sleeveCm?: number | null;
}

export interface Product {
  id: string;
  sku?: string;
  slug: string;
  collectionId: string;
  subcategoryId?: string;
  apparelType?: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  specs_ar?: string;
  specs_en?: string;
  seoTitle_ar?: string;
  seoTitle_en?: string;
  seoDescription_ar?: string;
  seoDescription_en?: string;
  pricePiasters: number;
  salePricePiasters?: number | null;
  currency: 'EGP';
  status: ProductStatus;
  isNew: boolean;
  featured: boolean;
  isBestSelling?: boolean;
  availableSizes?: ClothingSize[];
  lowStockThreshold?: number;
  salesCount?: number;
  deletedAt?: string | null;
  colors?: ProductColorGallery[];
  media?: ProductMediaItem[];
  sizeChart?: SizeMeasurementRow[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  colorKey: string;
  colorName_ar: string;
  colorName_en: string;
  colorHex: string;
  size: ClothingSize;
  pricePiasters?: number | null;
  stock: number;
  reservedStock?: number;
  soldCount?: number;
  lowStockThreshold: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface Collection {
  id: string;
  slug: string;
  parentId?: string | null;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  heroImageUrl?: string;
  active: boolean;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CmsPageSlug =
  | 'home'
  | 'about'
  | 'contact'
  | 'shipping-returns'
  | 'privacy'
  | 'terms'
  | 'size-guide';

export interface CmsPage {
  slug: CmsPageSlug;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  metaTitle_ar?: string;
  metaTitle_en?: string;
  metaDescription_ar?: string;
  metaDescription_en?: string;
  heroMediaType: 'placeholder' | 'image' | 'video';
  heroMediaUrl?: string;
  heroPosterUrl?: string;
  campaignImageUrl?: string;
  campaignTitle_ar?: string;
  campaignTitle_en?: string;
  campaignBody_ar?: string;
  campaignBody_en?: string;
  campaignCta_ar?: string;
  campaignCta_en?: string;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface CartItemLocal {
  id: string;
  productId: string;
  variantId: string;
  colorKey: string;
  size: ClothingSize;
  quantity: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  preferredLocale: Locale;
  photoUrl?: string;
  status: 'active' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomerSummary {
  uid: string;
  displayName: string;
  preferredLocale: Locale;
  status: string;
  email?: string;
  phone?: string;
  createdAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorRole: 'owner' | 'manager' | 'staff';
  action: string;
  targetCollection: string;
  targetId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  createdAt?: unknown;
}

export type AdminTab =
  | 'dashboard'
  | 'products'
  | 'add-product'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'discounts'
  | 'reviews'
  | 'analytics'
  | 'settings'
  | 'content'
  | 'social'
  | 'my-account'
  | 'contact-messages'
  | 'staff-applications';

export interface UserAddress {
  id: string;
  uid: string;
  label: string;
  fullName: string;
  phone: string;
  country: string;
  governorateCode: string;
  city: string;
  area: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  isDefault: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderItemSnapshot {
  productId: string;
  variantId: string;
  slug: string;
  name_ar: string;
  name_en: string;
  colorKey: string;
  colorName_ar: string;
  colorName_en: string;
  size: ClothingSize;
  sku: string;
  unitPricePiasters: number;
  quantity: number;
  lineTotalPiasters: number;
  imageUrl?: string;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  email: string;
  country: string;
  governorateCode: string;
  governorateName_ar: string;
  governorateName_en: string;
  city: string;
  area: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  deliveryNotes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  idempotencyKey: string;
  locale: Locale;
  currency: 'EGP';
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  codCollectionStatus: CodCollectionStatus;
  subtotalPiasters: number;
  discountPiasters: number;
  shippingPiasters: number;
  codFeePiasters: number;
  totalPiasters: number;
  discountCode?: string | null;
  trackingNumber?: string;
  internalNotes?: string;
  receiptUrl?: string;
  itemsSnapshot: OrderItemSnapshot[];
  shippingAddress: ShippingAddressSnapshot;
  statusTimeline: OrderTimelineEntry[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderLookup {
  orderNumber: string;
  phoneLast4: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  currency: 'EGP';
  totalPiasters: number;
  itemsCount: number;
  trackingNumber?: string;
  statusTimeline: OrderTimelineEntry[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_shipping' | 'free_item';
  value: number;
  minItems?: number | null;
  minOrderPiasters?: number | null;
  maxDiscountPiasters?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface QuantityPromotion {
  id: string;
  minItems: number;
  rewardType: 'percentage' | 'fixed' | 'free_item' | 'free_shipping';
  value: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface ShippingZone {
  id: string;
  name_ar: string;
  name_en: string;
  governorateCodes: string[];
  feePiasters: number | null;
  codFeePiasters: number | null;
  freeShippingThresholdPiasters: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  active: boolean;
  updatedAt?: unknown;
}

export interface StockMovement {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  previousQuantity: number;
  newQuantity: number;
  delta: number;
  reason: string;
  orderId?: string;
  actorUid: string;
  createdAt?: unknown;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  status: 'approved' | 'pending' | 'hidden';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StorefrontSettings {
  storeName_ar: string;
  storeName_en: string;
  storeDescription_ar?: string;
  storeDescription_en?: string;
  currency?: 'EGP';
  announcementEnabled?: boolean;
  announcementText_ar?: string;
  announcementText_en?: string;
  whiteLogoUrl?: string;
  blackLogoUrl?: string;
  heroImageUrl?: string;
  campaignImageUrl?: string;
  editorialImageUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  address_ar?: string;
  address_en?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface PaymentSettings {
  codEnabled: boolean;
  instapayEnabled: boolean;
  instapayInstructions_ar?: string;
  instapayInstructions_en?: string;
  paymobEnabled: boolean;
  paymobMode?: 'test' | 'live';
  updatedAt?: unknown;
  updatedBy?: string;
}
