import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import {
  fetchAllActiveVariants,
  fetchCollections,
  fetchPublishedProducts,
} from '../lib/storeService';
import { CLOTHING_SIZES, type ClothingSize, type Collection, type Product, type ProductVariant } from '../types/domain';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';

type SortOption = 'newest' | 'best_selling' | 'price_asc' | 'price_desc';

export function ShopPage() {
  const { locale, t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const searchQuery = searchParams.get('q') || '';
  const selectedCollection = searchParams.get('collection') || '';
  const selectedSubcategory = searchParams.get('subcategory') || '';
  const selectedApparelType = searchParams.get('apparelType') || '';
  const selectedColor = searchParams.get('color') || '';
  const selectedSize = (searchParams.get('size') || '') as ClothingSize | '';
  const inStockOnly = searchParams.get('inStock') === '1';
  const offersOnly = searchParams.get('sale') === '1';
  const featuredOnly = searchParams.get('featured') === '1';
  const maxPriceEgp = searchParams.get('maxPrice') || '';
  const sortBy = (searchParams.get('sort') || 'newest') as SortOption;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [p, v, c] = await Promise.all([
          fetchPublishedProducts(),
          fetchAllActiveVariants(),
          fetchCollections(false),
        ]);
        if (active) {
          setProducts(p);
          setVariants(v);
          setCollections(c);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const list = map.get(v.productId) || [];
      list.push(v);
      map.set(v.productId, list);
    }
    return map;
  }, [variants]);

  const availableColors = useMemo(() => {
    const map = new Map<string, { key: string; name_ar: string; name_en: string; hex: string }>();
    for (const v of variants) {
      if (!map.has(v.colorKey)) {
        map.set(v.colorKey, {
          key: v.colorKey,
          name_ar: v.colorName_ar,
          name_en: v.colorName_en,
          hex: v.colorHex,
        });
      }
    }
    return Array.from(map.values());
  }, [variants]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchParams({}, { replace: true });
  };

  const parentCollections = useMemo(
    () => collections.filter((c) => !c.parentId),
    [collections]
  );

  const subCollections = useMemo(() => {
    if (!selectedCollection) return collections.filter((c) => Boolean(c.parentId));
    const colObj = collections.find((c) => c.slug === selectedCollection || c.id === selectedCollection);
    return collections.filter((c) => c.parentId && (!colObj || c.parentId === colObj.id));
  }, [collections, selectedCollection]);

  const apparelTypes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.apparelType) set.add(p.apparelType);
    }
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const maxPiasters = maxPriceEgp && Number(maxPriceEgp) > 0 ? Math.round(Number(maxPriceEgp) * 100) : null;

    const matched = products.filter((p) => {
      const pVars = variantsByProduct.get(p.id) || [];

      if (q) {
        const hay = `${p.name_ar} ${p.name_en} ${p.description_ar || ''} ${p.description_en || ''} ${p.apparelType || ''} ${p.sku || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (selectedCollection) {
        const colObj = collections.find((c) => c.slug === selectedCollection || c.id === selectedCollection);
        const targetId = colObj?.id || selectedCollection;
        if (p.collectionId !== targetId && p.collectionId !== selectedCollection) return false;
      }

      if (selectedSubcategory) {
        const subObj = collections.find((c) => c.slug === selectedSubcategory || c.id === selectedSubcategory);
        const targetSubId = subObj?.id || selectedSubcategory;
        if (p.subcategoryId !== targetSubId && p.subcategoryId !== selectedSubcategory) return false;
      }

      if (selectedApparelType && p.apparelType !== selectedApparelType) {
        return false;
      }

      if (offersOnly) {
        const isSale =
          typeof p.salePricePiasters === 'number' &&
          p.salePricePiasters > 0 &&
          p.salePricePiasters < p.pricePiasters;
        if (!isSale) return false;
      }

      if (featuredOnly && !p.featured) return false;

      if (selectedColor) {
        const hasColor =
          pVars.some((v) => v.colorKey === selectedColor) ||
          p.colors?.some((c) => c.colorKey === selectedColor);
        if (!hasColor) return false;
      }

      if (selectedSize) {
        const hasSize = pVars.some((v) => v.size === selectedSize && (!inStockOnly || v.stock > 0));
        if (!hasSize) return false;
      }

      if (inStockOnly) {
        const total = pVars.reduce((acc, v) => acc + (v.stock || 0), 0);
        if (total <= 0) return false;
      }

      if (maxPiasters !== null) {
        const effective = p.salePricePiasters ?? p.pricePiasters;
        if (effective > maxPiasters) return false;
      }

      return true;
    });

    matched.sort((a, b) => {
      if (sortBy === 'price_asc') {
        return (a.salePricePiasters ?? a.pricePiasters) - (b.salePricePiasters ?? b.pricePiasters);
      }
      if (sortBy === 'price_desc') {
        return (b.salePricePiasters ?? b.pricePiasters) - (a.salePricePiasters ?? a.pricePiasters);
      }
      if (sortBy === 'best_selling') {
        return (b.salesCount || 0) - (a.salesCount || 0);
      }
      const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
      const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
      return bTime - aTime;
    });

    return matched;
  }, [
    products,
    variantsByProduct,
    collections,
    searchQuery,
    selectedCollection,
    selectedSubcategory,
    selectedApparelType,
    offersOnly,
    featuredOnly,
    selectedColor,
    selectedSize,
    inStockOnly,
    maxPriceEgp,
    sortBy,
  ]);

  const hasActiveFilters = Boolean(
    searchQuery ||
      selectedCollection ||
      selectedSubcategory ||
      selectedApparelType ||
      offersOnly ||
      featuredOnly ||
      selectedColor ||
      selectedSize ||
      inStockOnly ||
      maxPriceEgp
  );

  return (
    <div className="bg-white text-black min-h-[75vh]">
      <section className="bg-black text-white py-14 sm:py-18 border-b border-neutral-800">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 space-y-3">
          <h1
            className={`text-3xl sm:text-5xl font-semibold ${
              locale === 'en' ? 'font-display-en tracking-[-0.02em]' : 'font-display-ar'
            }`}
          >
            {t.shop.title}
          </h1>
          <p className="text-sm sm:text-base text-neutral-400">{t.shop.subtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-10 space-y-8">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between border-b border-neutral-200 pb-6">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3.5"
              strokeWidth={1.6}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder={t.shop.searchPlaceholder}
              className="w-full border border-neutral-300 bg-white ps-10 pe-4 py-2.5 text-sm focus:border-black focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2.5 text-xs font-semibold hover:border-black transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.6} />
              <span>{t.shop.allCollections}</span>
            </button>

            <select
              value={sortBy}
              onChange={(e) => updateParam('sort', e.target.value)}
              aria-label={t.shop.sortLabel}
              className="border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold focus:border-black focus:outline-none cursor-pointer"
            >
              <option value="newest">{t.shop.sortNewest}</option>
              <option value="best_selling">{t.shop.sortBestSelling}</option>
              <option value="price_asc">{t.shop.sortPriceAsc}</option>
              <option value="price_desc">{t.shop.sortPriceDesc}</option>
            </select>

            <span className="text-xs text-neutral-500 tabular-nums">
              {filteredProducts.length} {t.shop.resultsCount}
            </span>
          </div>
        </div>

        {/* Category quick strip */}
        {parentCollections.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateParam('collection', '')}
              className={`px-4 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                !selectedCollection
                  ? 'bg-black text-white border-black'
                  : 'border-neutral-300 text-neutral-700 hover:border-black'
              }`}
            >
              {t.shop.allCollections}
            </button>
            {parentCollections.map((col) => {
              const active = selectedCollection === col.slug || selectedCollection === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => updateParam('collection', col.slug)}
                  className={`px-4 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-black text-white border-black'
                      : 'border-neutral-300 text-neutral-700 hover:border-black'
                  }`}
                >
                  {locale === 'ar' ? col.name_ar : col.name_en}
                </button>
              );
            })}
          </div>
        )}

        {/* Expandable Filter Drawer */}
        {filtersOpen && (
          <div className="border border-neutral-200 bg-neutral-50 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500">{t.shop.allSizes}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateParam('size', '')}
                  className={`px-3 py-1.5 text-xs font-semibold border cursor-pointer ${
                    !selectedSize ? 'bg-black text-white border-black' : 'bg-white border-neutral-300'
                  }`}
                >
                  {t.shop.allSizes}
                </button>
                {CLOTHING_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateParam('size', sz === selectedSize ? '' : sz)}
                    className={`px-3 py-1.5 text-xs font-semibold border cursor-pointer ${
                      selectedSize === sz
                        ? 'bg-black text-white border-black'
                        : 'bg-white border-neutral-300 hover:border-black'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {availableColors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-500">{t.shop.allColors}</p>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => updateParam('color', selectedColor === c.key ? '' : c.key)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs border cursor-pointer ${
                        selectedColor === c.key
                          ? 'bg-black text-white border-black'
                          : 'bg-white border-neutral-300 hover:border-black'
                      }`}
                    >
                      <span
                        className="w-3 h-3 border border-neutral-300"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{locale === 'ar' ? c.name_ar : c.name_en}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-500">
                {t.shop.maxPrice}
              </label>
              <input
                type="number"
                min="0"
                dir="ltr"
                value={maxPriceEgp}
                onChange={(e) => updateParam('maxPrice', e.target.value)}
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              {subCollections.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">
                    {t.shop.allSubcategories}
                  </label>
                  <select
                    value={selectedSubcategory}
                    onChange={(e) => updateParam('subcategory', e.target.value)}
                    className="w-full border border-neutral-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">{t.shop.allSubcategories}</option>
                    {subCollections.map((sc) => (
                      <option key={sc.id} value={sc.slug}>
                        {locale === 'ar' ? sc.name_ar : sc.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {apparelTypes.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">
                    {t.shop.allApparelTypes}
                  </label>
                  <select
                    value={selectedApparelType}
                    onChange={(e) => updateParam('apparelType', e.target.value)}
                    className="w-full border border-neutral-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">{t.shop.allApparelTypes}</option>
                    {apparelTypes.map((at) => (
                      <option key={at} value={at}>
                        {at}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => updateParam('inStock', e.target.checked ? '1' : '')}
                  className="w-4 h-4 accent-black"
                />
                <span>{t.shop.inStockOnly}</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={offersOnly}
                  onChange={(e) => updateParam('sale', e.target.checked ? '1' : '')}
                  className="w-4 h-4 accent-black"
                />
                <span>{t.shop.offersOnly}</span>
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-black underline self-start cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t.shop.clearFilters}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="border border-neutral-200 bg-neutral-50 p-12 sm:p-20 text-center space-y-4">
            <p className="text-base font-semibold">{t.shop.noProducts}</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center bg-black text-white px-6 py-3 text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {t.shop.clearFilters}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variants={variantsByProduct.get(product.id) || []}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
