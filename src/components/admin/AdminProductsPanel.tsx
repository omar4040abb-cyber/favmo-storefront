import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatMinorUnits } from '../../lib/currency';
import {
  deleteProductAdmin,
  logAdminActionAdmin,
  saveProductWithVariantsAdmin,
  toggleProductStatusAdmin,
  uploadAdminImage,
} from '../../lib/storeService';
import {
  CLOTHING_SIZES,
  type ClothingSize,
  type Collection,
  type Product,
  type ProductColorGallery,
  type ProductMediaItem,
  type ProductStatus,
  type ProductVariant,
} from '../../types/domain';

interface AdminProductsPanelProps {
  products: Product[];
  variants: ProductVariant[];
  collections: Collection[];
  onRefresh: () => Promise<void>;
  createMode?: boolean;
  onCreated?: () => void;
  initialSearch?: string;
}

interface ColorDraft {
  colorKey: string;
  colorName_ar: string;
  colorName_en: string;
  colorHex: string;
  stockBySize: Record<ClothingSize, number>;
  priceEgpBySize: Record<ClothingSize, string>;
  lowStockThreshold: number;
}

function emptyStockBySize(): Record<ClothingSize, number> {
  return { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, '3XL': 0 };
}

function emptyPriceBySize(): Record<ClothingSize, string> {
  return { XS: '', S: '', M: '', L: '', XL: '', XXL: '', '3XL': '' };
}

const DEFAULT_SIZES: ClothingSize[] = ['S', 'M', 'L', 'XL', 'XXL'];
const PAGE_SIZE = 12;

const APPAREL_TYPES = [
  { value: 'hoodie', ar: 'هودي', en: 'Hoodie' },
  { value: 'sweatshirt', ar: 'سويت شيرت', en: 'Sweatshirt' },
  { value: 'tshirt', ar: 'تيشيرت', en: 'T-Shirt' },
  { value: 'jacket', ar: 'جاكيت', en: 'Jacket' },
  { value: 'pants', ar: 'بنطلون', en: 'Pants' },
  { value: 'set', ar: 'طقم كامل', en: 'Full Set' },
  { value: 'accessories', ar: 'إكسسوارات', en: 'Accessories' },
];

function createDefaultColor(): ColorDraft {
  return {
    colorKey: 'black',
    colorName_ar: 'أسود',
    colorName_en: 'Black',
    colorHex: '#000000',
    stockBySize: emptyStockBySize(),
    priceEgpBySize: emptyPriceBySize(),
    lowStockThreshold: 5,
  };
}

function slugify(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function AdminProductsPanel({
  products,
  variants,
  collections,
  onRefresh,
  createMode = false,
  onCreated,
  initialSearch = '',
}: AdminProductsPanelProps) {
  const { locale, t } = useLocale();
  const { user, getIdToken } = useAuth();

  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'stock_asc'>('newest');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [sku, setSku] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [slug, setSlug] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [apparelType, setApparelType] = useState('hoodie');
  const [priceEgp, setPriceEgp] = useState('');
  const [salePriceEgp, setSalePriceEgp] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [specsAr, setSpecsAr] = useState('');
  const [specsEn, setSpecsEn] = useState('');
  const [status, setStatus] = useState<ProductStatus>('published');
  const [isNew, setIsNew] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [isBestSelling, setIsBestSelling] = useState(false);
  const [availableSizes, setAvailableSizes] = useState<ClothingSize[]>(DEFAULT_SIZES);
  const [colors, setColors] = useState<ColorDraft[]>([createDefaultColor()]);
  const [media, setMedia] = useState<ProductMediaItem[]>([]);
  const [uploadAngle, setUploadAngle] = useState<ProductMediaItem['angle']>('front');
  const [uploadColorKey, setUploadColorKey] = useState('black');

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const topCategories = useMemo(() => collections.filter((c) => !c.parentId), [collections]);
  const subcategories = useMemo(
    () => collections.filter((c) => c.parentId === collectionId),
    [collections, collectionId]
  );

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const list = map.get(v.productId) || [];
      list.push(v);
      map.set(v.productId, list);
    }
    return map;
  }, [variants]);

  const resetForm = () => {
    setEditingId(null);
    setSku('');
    setNameAr('');
    setNameEn('');
    setSlug('');
    const firstTop = topCategories[0]?.id || collections[0]?.id || 'hoodies';
    setCollectionId(firstTop);
    setSubcategoryId('');
    setApparelType('hoodie');
    setPriceEgp('');
    setSalePriceEgp('');
    setLowStockThreshold(5);
    setDescAr('');
    setDescEn('');
    setSpecsAr('');
    setSpecsEn('');
    setStatus('published');
    setIsNew(true);
    setFeatured(false);
    setIsBestSelling(false);
    setAvailableSizes(DEFAULT_SIZES);
    setColors([createDefaultColor()]);
    setMedia([]);
    setUploadColorKey('black');
    setErrorMsg(null);
  };

  useEffect(() => {
    if (createMode) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (categoryFilter && p.collectionId !== categoryFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (q) {
        const hay = `${p.name_ar} ${p.name_en} ${p.slug} ${p.sku || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') {
        return (a.salePricePiasters ?? a.pricePiasters) - (b.salePricePiasters ?? b.pricePiasters);
      }
      if (sortBy === 'price_desc') {
        return (b.salePricePiasters ?? b.pricePiasters) - (a.salePricePiasters ?? a.pricePiasters);
      }
      if (sortBy === 'stock_asc') {
        const sa = (variantsByProduct.get(a.id) || []).reduce((s, v) => s + (v.stock || 0), 0);
        const sb = (variantsByProduct.get(b.id) || []).reduce((s, v) => s + (v.stock || 0), 0);
        return sa - sb;
      }
      const ta = (a.createdAt as { seconds?: number })?.seconds || 0;
      const tb = (b.createdAt as { seconds?: number })?.seconds || 0;
      return tb - ta;
    });
  }, [products, search, categoryFilter, statusFilter, sortBy, variantsByProduct]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    const pVars = variantsByProduct.get(p.id) || [];
    const colorMap = new Map<string, ColorDraft>();
    for (const c of p.colors || []) {
      colorMap.set(c.colorKey, {
        colorKey: c.colorKey,
        colorName_ar: c.colorName_ar,
        colorName_en: c.colorName_en,
        colorHex: c.colorHex,
        stockBySize: emptyStockBySize(),
        priceEgpBySize: emptyPriceBySize(),
        lowStockThreshold: p.lowStockThreshold ?? 5,
      });
    }
    for (const v of pVars) {
      const existing = colorMap.get(v.colorKey) || {
        colorKey: v.colorKey,
        colorName_ar: v.colorName_ar,
        colorName_en: v.colorName_en,
        colorHex: v.colorHex,
        stockBySize: emptyStockBySize(),
        priceEgpBySize: emptyPriceBySize(),
        lowStockThreshold: v.lowStockThreshold ?? p.lowStockThreshold ?? 5,
      };
      existing.stockBySize[v.size] = v.stock;
      if (v.pricePiasters && v.pricePiasters > 0) {
        existing.priceEgpBySize[v.size] = String(v.pricePiasters / 100);
      }
      existing.lowStockThreshold = v.lowStockThreshold ?? p.lowStockThreshold ?? 5;
      colorMap.set(v.colorKey, existing);
    }

    const builtColors = colorMap.size > 0 ? Array.from(colorMap.values()) : [createDefaultColor()];
    const activeSizeList =
      p.availableSizes && p.availableSizes.length > 0
        ? p.availableSizes
        : pVars.length > 0
          ? CLOTHING_SIZES.filter((sz) => pVars.some((v) => v.size === sz))
          : DEFAULT_SIZES;

    setEditingId(p.id);
    setSku(p.sku || '');
    setNameAr(p.name_ar);
    setNameEn(p.name_en);
    setSlug(p.slug);
    setCollectionId(p.collectionId);
    setSubcategoryId(p.subcategoryId || '');
    setApparelType(p.apparelType || 'hoodie');
    setPriceEgp(String(p.pricePiasters / 100));
    setSalePriceEgp(p.salePricePiasters ? String(p.salePricePiasters / 100) : '');
    setLowStockThreshold(p.lowStockThreshold ?? 5);
    setDescAr(p.description_ar || '');
    setDescEn(p.description_en || '');
    setSpecsAr(p.specs_ar || '');
    setSpecsEn(p.specs_en || '');
    // Older catalog records may not have a status yet. Keep those unpublished
    // until an admin deliberately chooses a status in the form.
    setStatus(p.status || 'draft');
    setIsNew(p.isNew);
    setFeatured(p.featured);
    setIsBestSelling(Boolean(p.isBestSelling));
    setAvailableSizes(activeSizeList.length > 0 ? activeSizeList : DEFAULT_SIZES);
    setColors(builtColors);
    setMedia([...(p.media || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    setUploadColorKey(builtColors[0]?.colorKey || 'black');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      const uploaded: ProductMediaItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadAdminImage(files[i], token, 'product');
        uploaded.push({
          angle: uploadAngle,
          colorKey: uploadColorKey || colors[0]?.colorKey || 'black',
          url,
          alt_ar: nameAr || 'FAVMO',
          alt_en: nameEn || 'FAVMO',
          sortOrder: media.length + i,
          isMain: media.length === 0 && i === 0,
        });
      }
      setMedia((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'UPLOAD_FAILED');
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceImage = async (index: number, file?: File) => {
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      const url = await uploadAdminImage(file, token, 'product');
      setMedia((prev) => prev.map((m, idx) => (idx === index ? { ...m, url } : m)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'UPLOAD_FAILED');
    } finally {
      setUploading(false);
    }
  };

  const handleSetMainImage = (index: number) => {
    setMedia((prev) =>
      prev.map((m, idx) => ({
        ...m,
        isMain: idx === index,
      }))
    );
  };

  const handleMoveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    setMedia((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
  };

  const handleDropImage = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      return;
    }
    setMedia((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
    setDragIdx(null);
  };

  const toggleAvailableSize = (sz: ClothingSize) => {
    setAvailableSizes((prev) => {
      if (prev.includes(sz)) {
        return prev.length > 1 ? prev.filter((s) => s !== sz) : prev;
      }
      return CLOTHING_SIZES.filter((s) => s === sz || prev.includes(s));
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const safeSlug = slugify(slug || nameEn) || `item-${Date.now().toString(36)}`;
    const pricePiasters = Math.round(Number(priceEgp) * 100);
    const salePricePiasters =
      salePriceEgp.trim() && Number(salePriceEgp) > 0
        ? Math.round(Number(salePriceEgp) * 100)
        : null;

    if (!nameAr.trim() || !nameEn.trim() || !Number.isFinite(pricePiasters) || pricePiasters <= 0) {
      setErrorMsg(
        locale === 'ar'
          ? 'يرجى إدخال الاسم بالعربية والإنجليزية والسعر الصحيح.'
          : 'Arabic/English names and valid price are required.'
      );
      return;
    }
    if (salePricePiasters !== null && salePricePiasters >= pricePiasters) {
      setErrorMsg(
        locale === 'ar'
          ? 'يجب أن يكون سعر الخصم أقل من السعر الأصلي.'
          : 'Sale price must be less than original price.'
      );
      return;
    }

    setSaving(true);
    try {
      const normalizedMedia = media.map((m, idx) => ({
        ...m,
        sortOrder: idx,
        isMain: media.some((x) => x.isMain) ? Boolean(m.isMain) : idx === 0,
      }));

      const colorGalleries: ProductColorGallery[] = colors.map((c) => {
        const cMedia = normalizedMedia.filter((m) => m.colorKey === c.colorKey);
        const mainForColor = cMedia.find((m) => m.isMain)?.url;
        return {
          colorKey: c.colorKey,
          colorName_ar: c.colorName_ar,
          colorName_en: c.colorName_en,
          colorHex: /^#[0-9a-fA-F]{6}$/.test(c.colorHex) ? c.colorHex : '#000000',
          frontImageUrl:
            mainForColor || cMedia.find((m) => m.angle === 'front')?.url || cMedia[0]?.url || '',
          backImageUrl: cMedia.find((m) => m.angle === 'back')?.url || cMedia[1]?.url || '',
          embroideryImageUrl: cMedia.find((m) => m.angle === 'embroidery')?.url || '',
          fabricImageUrl: cMedia.find((m) => m.angle === 'fabric')?.url || '',
        };
      });

      const threshold = Math.max(0, Math.trunc(lowStockThreshold || 5));
      const baseSkuPrefix = (sku.trim() || `FAV-${safeSlug.slice(0, 10)}`).toUpperCase();

      const variantInputs = colors.flatMap((c) =>
        availableSizes.map((sz) => {
          const overrideVal = Number(c.priceEgpBySize[sz]);
          const overridePiasters =
            c.priceEgpBySize[sz]?.trim() && Number.isFinite(overrideVal) && overrideVal > 0
              ? Math.round(overrideVal * 100)
              : null;
          return {
            sku: `${baseSkuPrefix}-${c.colorKey.slice(0, 4).toUpperCase()}-${sz}`,
            colorKey: c.colorKey,
            colorName_ar: c.colorName_ar,
            colorName_en: c.colorName_en,
            colorHex: /^#[0-9a-fA-F]{6}$/.test(c.colorHex) ? c.colorHex : '#000000',
            size: sz,
            pricePiasters: overridePiasters,
            stock: Math.max(0, Math.trunc(c.stockBySize[sz] || 0)),
            lowStockThreshold: threshold,
            active: true,
          };
        })
      );

      const savedId = await saveProductWithVariantsAdmin(
        editingId,
        {
          sku: sku.trim(),
          slug: safeSlug,
          collectionId: collectionId || 'hoodies',
          subcategoryId: subcategoryId || '',
          apparelType: apparelType || 'hoodie',
          name_ar: nameAr.trim(),
          name_en: nameEn.trim(),
          description_ar: descAr.trim(),
          description_en: descEn.trim(),
          specs_ar: specsAr.trim(),
          specs_en: specsEn.trim(),
          pricePiasters,
          salePricePiasters,
          currency: 'EGP',
          status: status || 'draft',
          isNew,
          featured,
          isBestSelling,
          availableSizes,
          lowStockThreshold: threshold,
          colors: colorGalleries,
          media: normalizedMedia,
        },
        variantInputs
      );

      if (user) {
        await logAdminActionAdmin(
          user.uid,
          editingId ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
          'products',
          savedId
        );
      }

      setModalOpen(false);
      await onRefresh();
      if (createMode && onCreated) {
        onCreated();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (p: Product) => {
    setBusyToggleId(p.id);
    try {
      const nextStatus: ProductStatus = p.status === 'published' ? 'draft' : 'published';
      await toggleProductStatusAdmin(p, nextStatus);
      if (user) {
        await logAdminActionAdmin(
          user.uid,
          nextStatus === 'published' ? 'PUBLISH_PRODUCT' : 'UNPUBLISH_PRODUCT',
          'products',
          p.id
        );
      }
      await onRefresh();
    } finally {
      setBusyToggleId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteProductAdmin(id);
    if (user) {
      await logAdminActionAdmin(user.uid, 'DELETE_PRODUCT', 'products', id);
    }
    setConfirmDeleteId(null);
    await onRefresh();
  };

  const inputCls =
    'w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none';

  const productFormMarkup = (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">اسم المنتج (عربي)</label>
          <input
            type="text"
            required
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">Product Name (EN)</label>
          <input
            type="text"
            required
            dir="ltr"
            value={nameEn}
            onChange={(e) => {
              setNameEn(e.target.value);
              if (!editingId) setSlug(slugify(e.target.value));
            }}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">SKU</label>
          <input
            type="text"
            dir="ltr"
            placeholder="FAV-HD-001"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            className={`${inputCls} font-mono-code`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">Slug (URL)</label>
          <input
            type="text"
            required
            dir="ltr"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className={`${inputCls} font-mono-code`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">
            {locale === 'ar' ? 'التصنيف الرئيسي' : 'Category'}
          </label>
          <select
            value={collectionId}
            onChange={(e) => {
              setCollectionId(e.target.value);
              setSubcategoryId('');
            }}
            className={inputCls}
          >
            {topCategories.length === 0 ? (
              <option value="hoodies">Hoodies</option>
            ) : (
              topCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === 'ar' ? c.name_ar : c.name_en}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">
            {locale === 'ar' ? 'التصنيف الفرعي' : 'Subcategory'}
          </label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className={inputCls}
          >
            <option value="">{locale === 'ar' ? '— بدون —' : '— None —'}</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {locale === 'ar' ? sub.name_ar : sub.name_en}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">
            {locale === 'ar' ? 'نوع الملابس' : 'Apparel Type'}
          </label>
          <select
            value={apparelType}
            onChange={(e) => setApparelType(e.target.value)}
            className={inputCls}
          >
            {APPAREL_TYPES.map((tp) => (
              <option key={tp.value} value={tp.value}>
                {locale === 'ar' ? tp.ar : tp.en}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">
            {locale === 'ar' ? 'السعر الأصلي (ج.م)' : 'Regular Price (EGP)'}
          </label>
          <input
            type="number"
            step="0.01"
            min="1"
            required
            dir="ltr"
            value={priceEgp}
            onChange={(e) => setPriceEgp(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">
            {locale === 'ar' ? 'سعر الخصم (اختياري)' : 'Sale Price (Optional)'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            dir="ltr"
            value={salePriceEgp}
            onChange={(e) => setSalePriceEgp(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">الوصف (عربي)</label>
          <textarea
            rows={3}
            value={descAr}
            onChange={(e) => setDescAr(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">Description (EN)</label>
          <textarea
            rows={3}
            dir="ltr"
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">المواصفات والخامة (عربي)</label>
          <textarea
            rows={2}
            value={specsAr}
            onChange={(e) => setSpecsAr(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-600">Specifications (EN)</label>
          <textarea
            rows={2}
            dir="ltr"
            value={specsEn}
            onChange={(e) => setSpecsEn(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Status, Flags & Low Stock Threshold */}
      <div className="flex flex-wrap items-center gap-6 border-y border-neutral-200 py-4 text-xs">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProductStatus)}
          className="border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
        >
          <option value="published">{t.admin.actions.publish}</option>
          <option value="draft">{t.admin.actions.draft}</option>
          <option value="paused">{t.badges.paused}</option>
          <option value="unavailable">{t.badges.unavailable}</option>
          <option value="archived">Archived</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-neutral-600">
            {locale === 'ar' ? 'تنبيه انخفاض المخزون:' : 'Low Stock Alert:'}
          </span>
          <input
            type="number"
            min="0"
            dir="ltr"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Math.max(0, Number(e.target.value) || 0))}
            className="w-16 border border-neutral-300 bg-white px-2 py-1 text-center text-black"
          />
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isNew}
            onChange={(e) => setIsNew(e.target.checked)}
            className="accent-black"
          />
          <span>{t.badges.new}</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="accent-black"
          />
          <span>{t.badges.featured}</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isBestSelling}
            onChange={(e) => setIsBestSelling(e.target.checked)}
            className="accent-black"
          />
          <span>{t.badges.bestSeller}</span>
        </label>
      </div>

      {/* Interactive Available Sizes Selector */}
      <div className="space-y-2.5 text-xs">
        <p className="font-semibold text-black">
          {locale === 'ar' ? 'المقاسات المتوفرة (XS - 3XL)' : 'Available Sizes (XS - 3XL)'}
        </p>
        <div className="flex flex-wrap gap-2">
          {CLOTHING_SIZES.map((sz) => {
            const active = availableSizes.includes(sz);
            return (
              <button
                key={sz}
                type="button"
                onClick={() => toggleAvailableSize(sz)}
                className={`px-3.5 py-1.5 border font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'bg-black text-white border-black'
                    : 'bg-white border-neutral-300 text-neutral-600 hover:border-black'
                }`}
              >
                {sz}
              </button>
            );
          })}
        </div>
      </div>

      {/* Colors & Size Stock/Price Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-black">
            {locale === 'ar'
              ? 'الألوان والمقاسات والمخزون (مع إمكانية تحديد سعر خاص للمقاس)'
              : 'Colors, Stock & Optional Per-Size Price Override'}
          </h3>
          <button
            type="button"
            onClick={() =>
              setColors((prev) => [
                ...prev,
                {
                  colorKey: `color-${prev.length + 1}`,
                  colorName_ar: 'لون',
                  colorName_en: `Color ${prev.length + 1}`,
                  colorHex: '#171717',
                  stockBySize: emptyStockBySize(),
                  priceEgpBySize: emptyPriceBySize(),
                  lowStockThreshold,
                },
              ])
            }
            className="border border-black px-3 py-1.5 text-xs font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            + {locale === 'ar' ? 'إضافة لون' : 'Add Color'}
          </button>
        </div>

        {colors.map((c, idx) => (
          <div
            key={`${c.colorKey}-${idx}`}
            className="border border-neutral-200 bg-neutral-50 p-4 space-y-4"
          >
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
              <input
                type="text"
                placeholder="Key (e.g. black)"
                dir="ltr"
                value={c.colorKey}
                onChange={(e) => {
                  const val = slugify(e.target.value) || 'color';
                  setColors((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, colorKey: val } : item))
                  );
                }}
                className="border border-neutral-300 bg-white px-2.5 py-2 text-xs text-black"
              />
              <input
                type="text"
                placeholder="الاسم بالعربي"
                value={c.colorName_ar}
                onChange={(e) =>
                  setColors((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, colorName_ar: e.target.value } : item
                    )
                  )
                }
                className="border border-neutral-300 bg-white px-2.5 py-2 text-xs text-black"
              />
              <input
                type="text"
                placeholder="Name EN"
                dir="ltr"
                value={c.colorName_en}
                onChange={(e) =>
                  setColors((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, colorName_en: e.target.value } : item
                    )
                  )
                }
                className="border border-neutral-300 bg-white px-2.5 py-2 text-xs text-black"
              />
              <input
                type="color"
                value={c.colorHex}
                onChange={(e) =>
                  setColors((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, colorHex: e.target.value } : item
                    )
                  )
                }
                className="h-9 w-full border border-neutral-300 bg-white cursor-pointer"
              />
              {colors.length > 1 && (
                <button
                  type="button"
                  onClick={() => setColors((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs text-neutral-600 hover:text-black underline cursor-pointer"
                >
                  {t.admin.actions.delete}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {availableSizes.map((sz) => (
                <div key={sz} className="space-y-1 border border-neutral-200 bg-white p-2">
                  <label className="block text-[11px] font-semibold text-black text-center">
                    {sz}
                  </label>
                  <input
                    type="number"
                    min="0"
                    dir="ltr"
                    title="Stock"
                    placeholder="Qty"
                    value={c.stockBySize[sz] ?? 0}
                    onChange={(e) =>
                      setColors((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? {
                                ...item,
                                stockBySize: {
                                  ...item.stockBySize,
                                  [sz]: Math.max(0, Number(e.target.value) || 0),
                                },
                              }
                            : item
                        )
                      )
                    }
                    className="w-full border border-neutral-300 bg-white px-2 py-1 text-xs text-center tabular-nums text-black"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    title="Optional Size Price Override (EGP)"
                    placeholder={locale === 'ar' ? 'سعر خاص' : 'Price'}
                    value={c.priceEgpBySize[sz] ?? ''}
                    onChange={(e) =>
                      setColors((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? {
                                ...item,
                                priceEgpBySize: {
                                  ...item.priceEgpBySize,
                                  [sz]: e.target.value,
                                },
                              }
                            : item
                        )
                      )
                    }
                    className="w-full border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-[11px] text-center tabular-nums text-neutral-700"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Multi-Image Upload + Main Image + Drag/Button Reorder + Replace + Delete */}
      <div className="space-y-4 border-t border-neutral-200 pt-5">
        <h3 className="text-xs font-semibold text-black">
          {locale === 'ar'
            ? 'معرض صور المنتج (سحب وإفلات للترتيب · تعيين رئيسية · استبدال)'
            : 'Product Gallery (Drag & Drop Reorder · Set Main · Replace)'}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={uploadColorKey}
            onChange={(e) => setUploadColorKey(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
          >
            {colors.map((c, idx) => (
              <option key={`${c.colorKey}-${idx}`} value={c.colorKey}>
                {locale === 'ar' ? c.colorName_ar : c.colorName_en}
              </option>
            ))}
          </select>
          <select
            value={uploadAngle}
            onChange={(e) => setUploadAngle(e.target.value as ProductMediaItem['angle'])}
            className="border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
          >
            <option value="front">Front</option>
            <option value="back">Back</option>
            <option value="embroidery">Embroidery / Logo</option>
            <option value="fabric">Fabric</option>
            <option value="detail">Detail</option>
          </select>
          <label className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 text-xs font-semibold hover:bg-neutral-800 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? t.admin.actions.uploading : t.admin.actions.uploadImage}</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleMultiUpload}
              className="sr-only"
            />
          </label>
        </div>

        {media.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {media.map((m, idx) => (
              <div
                key={m.url + idx}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropImage(idx)}
                className={`relative border bg-white flex flex-col ${
                  m.isMain ? 'border-black ring-1 ring-black' : 'border-neutral-200'
                }`}
              >
                <img src={m.url} alt="" className="w-full aspect-[4/5] object-cover" />
                {m.isMain && (
                  <span className="absolute top-2 start-2 bg-black text-white px-2 py-0.5 text-[10px] font-semibold">
                    MAIN
                  </span>
                )}
                <div className="p-2 text-[10px] text-neutral-700 space-y-2 border-t border-neutral-200">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">
                      {m.colorKey} · {m.angle}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleSetMainImage(idx)}
                      title="Set Main Image"
                      className={`p-1 border cursor-pointer ${
                        m.isMain
                          ? 'bg-black text-white border-black'
                          : 'border-neutral-300 hover:border-black'
                      }`}
                    >
                      <Star className="w-3 h-3" fill={m.isMain ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveImage(idx, -1)}
                      disabled={idx === 0}
                      title="Move Up"
                      className="p-1 border border-neutral-300 hover:border-black disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveImage(idx, 1)}
                      disabled={idx === media.length - 1}
                      title="Move Down"
                      className="p-1 border border-neutral-300 hover:border-black disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <label
                      title="Replace Image"
                      className="p-1 border border-neutral-300 hover:border-black cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handleReplaceImage(idx, e.target.files?.[0])}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))}
                      title="Delete"
                      className="p-1 border border-neutral-300 text-neutral-500 hover:text-black hover:border-black cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <p role="alert" className="border border-red-700/40 bg-red-50 text-red-900 p-3 text-xs font-medium">
          {errorMsg}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
        {!createMode && (
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="border border-neutral-300 px-6 py-2.5 text-xs font-semibold text-black hover:border-black cursor-pointer"
          >
            {t.admin.actions.cancel}
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-8 py-2.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
        >
          {saving ? t.admin.actions.saving : t.admin.actions.save}
        </button>
      </div>
    </form>
  );

  if (createMode) {
    return (
      <div className="bg-white border border-neutral-200 p-6 sm:p-8 space-y-6">
        <div className="border-b border-neutral-200 pb-4">
          <h2 className="text-base font-semibold text-black">{t.admin.tabs['add-product']}</h2>
          <p className="text-xs text-neutral-500 mt-1">
            {locale === 'ar'
              ? 'أضف قطعة جديدة مع الصور والألوان والمقاسات والمخزون مباشرة إلى قاعدة بيانات FAVMO.'
              : 'Create a complete garment listing with multi-angle photography, colors, sizes, and live variant stock.'}
          </p>
        </div>
        {productFormMarkup}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: Search, Category Filter, Status Filter, Sort, Add New */}
      <div className="bg-white border border-neutral-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.actions.searchPlaceholder}
            className="border border-neutral-300 bg-white px-3.5 py-2 text-xs text-black placeholder:text-neutral-400 w-full sm:w-64 focus:border-black focus:outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
          >
            <option value="">{t.shop.allCollections}</option>
            {topCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === 'ar' ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
          >
            <option value="">{locale === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="published">{t.admin.actions.publish}</option>
            <option value="draft">{t.admin.actions.draft}</option>
            <option value="paused">{t.badges.paused}</option>
            <option value="unavailable">{t.badges.unavailable}</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
          >
            <option value="newest">{t.shop.sortNewest}</option>
            <option value="price_asc">{t.shop.sortPriceAsc}</option>
            <option value="price_desc">{t.shop.sortPriceDesc}</option>
            <option value="stock_asc">
              {locale === 'ar' ? 'المخزون: الأقل أولاً' : 'Stock: Low to High'}
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.admin.actions.add}</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          {t.admin.metrics.noDataYet}
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 bg-neutral-50">
                <th className="p-4 text-start font-medium">{locale === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="p-4 text-start font-medium">{locale === 'ar' ? 'التصنيف' : 'Category'}</th>
                <th className="p-4 text-start font-medium">{locale === 'ar' ? 'السعر' : 'Price'}</th>
                <th className="p-4 text-start font-medium">{locale === 'ar' ? 'المخزون' : 'Stock'}</th>
                <th className="p-4 text-start font-medium">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="p-4 text-end font-medium">{locale === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginated.map((p) => {
                const totalStock = (variantsByProduct.get(p.id) || []).reduce(
                  (sum, v) => sum + (v.stock || 0),
                  0
                );
                const mainMedia = p.media?.find((m) => m.isMain)?.url;
                const thumb = mainMedia || p.colors?.[0]?.frontImageUrl || p.media?.[0]?.url;
                return (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-12 bg-neutral-100 border border-neutral-200 shrink-0 overflow-hidden">
                          {thumb && (
                            <img src={thumb} alt={p.name_en} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-black">
                            {locale === 'ar' ? p.name_ar : p.name_en}
                          </p>
                          <p className="text-[11px] text-neutral-500 font-mono-code">
                            {p.sku ? `${p.sku} · ` : ''}
                            {p.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-neutral-700">
                      {p.collectionId}
                      {p.apparelType ? ` · ${p.apparelType}` : ''}
                    </td>
                    <td className="p-4 tabular-nums">
                      <span className="font-semibold text-black">
                        {formatMinorUnits(p.salePricePiasters ?? p.pricePiasters, locale)}
                      </span>
                      {p.salePricePiasters && (
                        <span className="block text-[11px] text-neutral-400 line-through">
                          {formatMinorUnits(p.pricePiasters, locale)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 tabular-nums font-semibold text-black">{totalStock}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block border px-2 py-0.5 text-[11px] font-medium ${
                          p.status === 'published'
                            ? 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                            : 'border-neutral-300 bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-4 text-end">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyToggleId === p.id}
                          onClick={() => handleTogglePublish(p)}
                          className="border border-neutral-300 px-2.5 py-1.5 text-[11px] font-medium hover:border-black cursor-pointer"
                        >
                          {p.status === 'published'
                            ? t.admin.actions.unpublish
                            : t.admin.actions.publish}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="border border-neutral-300 px-3 py-1.5 hover:border-black cursor-pointer"
                        >
                          {t.admin.actions.edit}
                        </button>
                        {confirmDeleteId === p.id ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="bg-black text-white px-3 py-1.5 font-semibold cursor-pointer"
                          >
                            {t.admin.actions.confirmDelete}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="border border-neutral-200 px-3 py-1.5 text-neutral-500 hover:text-black hover:border-black cursor-pointer"
                          >
                            {t.admin.actions.delete}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-neutral-200 px-4 py-3 flex items-center justify-between text-xs text-neutral-600">
              <span className="tabular-nums">
                {page} / {totalPages} ({filtered.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 border border-neutral-300 px-3 py-1.5 disabled:opacity-40 hover:border-black cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{t.admin.actions.prevPage}</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 border border-neutral-300 px-3 py-1.5 disabled:opacity-40 hover:border-black cursor-pointer"
                >
                  <span>{t.admin.actions.nextPage}</span>
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white text-black border border-neutral-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h2 className="text-base font-semibold">
                {editingId ? t.admin.actions.edit : t.admin.actions.add}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {productFormMarkup}
          </div>
        </div>
      )}
    </div>
  );
}
