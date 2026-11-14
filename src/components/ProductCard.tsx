import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, ShoppingBag, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useCartUi } from '../contexts/CartUiContext';
import { formatMinorUnits } from '../lib/currency';
import { CLOTHING_SIZES, type ClothingSize, type Product, type ProductVariant } from '../types/domain';
import { ImageSlot } from './ImageSlot';

interface ProductCardProps {
  product: Product;
  variants: ProductVariant[];
  darkSurface?: boolean;
}

export function ProductCard({ product, variants, darkSurface = false }: ProductCardProps) {
  const { locale, t, localePath } = useLocale();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addItem, openDrawer } = useCartUi();

  const colors = useMemo(() => {
    if (product.colors && product.colors.length > 0) return product.colors;
    const map = new Map<
      string,
      { colorKey: string; colorName_ar: string; colorName_en: string; colorHex: string; frontImageUrl?: string; backImageUrl?: string }
    >();
    for (const v of variants) {
      if (!map.has(v.colorKey)) {
        map.set(v.colorKey, {
          colorKey: v.colorKey,
          colorName_ar: v.colorName_ar,
          colorName_en: v.colorName_en,
          colorHex: v.colorHex,
        });
      }
    }
    return Array.from(map.values());
  }, [product.colors, variants]);

  const [selectedColorKey, setSelectedColorKey] = useState<string>(colors[0]?.colorKey || '');
  const [hovered, setHovered] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ClothingSize>('M');
  const [adding, setAdding] = useState(false);

  const activeColor = useMemo(
    () => colors.find((c) => c.colorKey === selectedColorKey) || colors[0],
    [colors, selectedColorKey]
  );

  const colorMedia = useMemo(() => {
    const items = (product.media || []).filter(
      (m) => !selectedColorKey || m.colorKey === selectedColorKey
    );
    const mainAll = (product.media || []).find((m) => m.isMain)?.url;
    const mainColor = items.find((m) => m.isMain)?.url;
    const front =
      mainColor ||
      activeColor?.frontImageUrl ||
      items.find((m) => m.angle === 'front')?.url ||
      mainAll ||
      product.media?.[0]?.url;
    const back =
      activeColor?.backImageUrl ||
      items.find((m) => m.angle === 'back')?.url ||
      items.find((m) => m.url !== front)?.url;
    return { front, back };
  }, [product.media, activeColor, selectedColorKey]);

  const totalStock = useMemo(
    () => variants.filter((v) => v.active).reduce((sum, v) => sum + (v.stock || 0), 0),
    [variants]
  );

  const lowStock = useMemo(
    () =>
      totalStock > 0 &&
      variants.some(
        (v) =>
          v.active &&
          v.stock > 0 &&
          v.stock <= (v.lowStockThreshold ?? product.lowStockThreshold ?? 5)
      ),
    [totalStock, variants, product.lowStockThreshold]
  );

  const isSalesBlocked = product.status === 'paused' || product.status === 'unavailable';
  const displayedSizes = useMemo(() => {
    if (product.availableSizes && product.availableSizes.length > 0) {
      return product.availableSizes;
    }
    const fromVariants = Array.from(new Set(variants.map((v) => v.size)));
    return fromVariants.length > 0 ? CLOTHING_SIZES.filter((s) => fromVariants.includes(s)) : CLOTHING_SIZES;
  }, [product.availableSizes, variants]);

  const displayName = locale === 'ar' ? product.name_ar : product.name_en;

  const wishlisted = isWishlisted(product.id);

  const activeVariantForQuickView = useMemo(() => {
    return (
      variants.find(
        (v) =>
          v.active &&
          (!selectedColorKey || v.colorKey === selectedColorKey) &&
          v.size === selectedSize
      ) ||
      variants.find(
        (v) => v.active && (!selectedColorKey || v.colorKey === selectedColorKey) && v.stock > 0
      ) ||
      variants.find((v) => v.active && v.stock > 0)
    );
  }, [variants, selectedColorKey, selectedSize]);

  const effectivePrice =
    activeVariantForQuickView?.pricePiasters ?? product.salePricePiasters ?? product.pricePiasters;
  const hasSale =
    typeof product.salePricePiasters === 'number' &&
    product.salePricePiasters > 0 &&
    product.salePricePiasters < product.pricePiasters &&
    !activeVariantForQuickView?.pricePiasters;

  const handleOpenQuickView = () => {
    const firstInStock = variants.find(
      (v) => v.active && v.stock > 0 && (!selectedColorKey || v.colorKey === selectedColorKey)
    );
    if (firstInStock) {
      setSelectedSize(firstInStock.size);
    }
    setQuickViewOpen(true);
  };

  const handleQuickAdd = async () => {
    if (!activeVariantForQuickView || activeVariantForQuickView.stock <= 0) return;
    setAdding(true);
    try {
      await addItem({
        productId: product.id,
        variantId: activeVariantForQuickView.id,
        colorKey: activeVariantForQuickView.colorKey,
        size: activeVariantForQuickView.size,
        quantity: 1,
      });
      setQuickViewOpen(false);
      openDrawer();
    } finally {
      setAdding(false);
    }
  };

  const borderClass = darkSurface ? 'border-neutral-800' : 'border-neutral-200';
  const titleClass = darkSurface ? 'text-white group-hover:text-neutral-300' : 'text-black group-hover:text-neutral-600';
  const priceClass = darkSurface ? 'text-neutral-200' : 'text-neutral-900';
  const strikeClass = darkSurface ? 'text-neutral-500' : 'text-neutral-400';

  return (
    <>
      <article
        className="group flex flex-col"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative overflow-hidden">
          <Link to={localePath(`/product/${product.slug}`)} className="block">
            <ImageSlot
              src={hovered && colorMedia.back ? colorMedia.back : colorMedia.front}
              alt={displayName}
              aspectClass="aspect-[4/5]"
              darkSurface={darkSurface}
            />
          </Link>

          {/* Crisp rectangular status tags (max 2) */}
          <div className="pointer-events-none absolute top-3 start-3 flex flex-col gap-1.5">
            {product.status === 'unavailable' ? (
              <span className="bg-black text-white border border-white/25 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]">
                {t.badges.unavailable}
              </span>
            ) : product.status === 'paused' ? (
              <span className="bg-black text-white border border-white/25 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]">
                {t.badges.paused}
              </span>
            ) : totalStock <= 0 ? (
              <span className="bg-black text-white border border-white/25 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]">
                {t.badges.soldOut}
              </span>
            ) : hasSale ? (
              <span className="bg-white text-black border border-black/15 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]">
                {t.badges.sale}
              </span>
            ) : product.isNew ? (
              <span className="bg-black text-white border border-white/25 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]">
                {t.badges.new}
              </span>
            ) : lowStock ? (
              <span className="bg-neutral-900 text-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em]">
                {t.badges.lowStock}
              </span>
            ) : null}
          </div>

          {/* Wishlist + Quick View Action Overlay */}
          <div className="absolute top-3 end-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label={t.nav.wishlist}
              className={`w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer ${
                wishlisted
                  ? 'bg-black text-white border-black'
                  : 'bg-white/90 text-black border-neutral-300 hover:bg-black hover:text-white hover:border-black'
              }`}
            >
              <Heart
                className="w-4 h-4"
                strokeWidth={1.6}
                fill={wishlisted ? 'currentColor' : 'none'}
              />
            </button>
            <button
              type="button"
              onClick={handleOpenQuickView}
              aria-label={t.shop.quickView}
              className="w-9 h-9 flex items-center justify-center border border-neutral-300 bg-white/90 text-black hover:bg-black hover:text-white hover:border-black transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        <div className="pt-4 space-y-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <Link
              to={localePath(`/product/${product.slug}`)}
              className={`text-sm sm:text-base font-medium transition-colors line-clamp-1 ${titleClass}`}
            >
              {displayName}
            </Link>
            <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
              <span className={`text-sm font-semibold ${priceClass}`}>
                {formatMinorUnits(effectivePrice, locale)}
              </span>
              {hasSale && (
                <span className={`text-xs line-through ${strikeClass}`}>
                  {formatMinorUnits(product.pricePiasters, locale)}
                </span>
              )}
            </div>
          </div>

          {colors.length > 0 && (
            <div className="flex items-center gap-2 pt-0.5">
              {colors.map((c, idx) => {
                const selected = c.colorKey === (activeColor?.colorKey || '');
                return (
                  <button
                    key={`${c.colorKey}-${idx}`}
                    type="button"
                    onClick={() => setSelectedColorKey(c.colorKey)}
                    aria-label={locale === 'ar' ? c.colorName_ar : c.colorName_en}
                    title={locale === 'ar' ? c.colorName_ar : c.colorName_en}
                    className={`w-4 h-4 border transition-transform cursor-pointer ${
                      selected
                        ? darkSurface
                          ? 'border-white scale-110'
                          : 'border-black scale-110'
                        : borderClass
                    }`}
                    style={{ backgroundColor: c.colorHex }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </article>

      {/* Quick View Modal */}
      {quickViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setQuickViewOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-2xl bg-white text-black border border-neutral-200 grid grid-cols-1 md:grid-cols-2 overflow-hidden shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setQuickViewOpen(false)}
              aria-label={t.nav.close}
              className="absolute top-3 end-3 z-20 w-9 h-9 bg-white text-black border border-neutral-200 flex items-center justify-center hover:bg-black hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.6} />
            </button>

            <ImageSlot src={colorMedia.front} alt={displayName} aspectClass="aspect-[4/5]" />

            <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">{displayName}</h2>
                <div className="flex items-baseline gap-3 tabular-nums">
                  <span className="text-base font-semibold">
                    {formatMinorUnits(effectivePrice, locale)}
                  </span>
                  {hasSale && (
                    <span className="text-sm text-neutral-400 line-through">
                      {formatMinorUnits(product.pricePiasters, locale)}
                    </span>
                  )}
                </div>

                {colors.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-neutral-500">
                      {t.shop.selectColor}:{' '}
                      <span className="text-black">
                        {locale === 'ar' ? activeColor?.colorName_ar : activeColor?.colorName_en}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((c, idx) => (
                        <button
                          key={`${c.colorKey}-${idx}`}
                          type="button"
                          onClick={() => setSelectedColorKey(c.colorKey)}
                          className={`w-7 h-7 border cursor-pointer ${
                            c.colorKey === activeColor?.colorKey
                              ? 'border-2 border-black'
                              : 'border-neutral-300'
                          }`}
                          style={{ backgroundColor: c.colorHex }}
                          aria-label={locale === 'ar' ? c.colorName_ar : c.colorName_en}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-neutral-500">{t.shop.selectSize}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {displayedSizes.map((sz) => {
                      const variant = variants.find(
                        (v) =>
                          v.active &&
                          (!activeColor || v.colorKey === activeColor.colorKey) &&
                          v.size === sz
                      );
                      const inStock = Boolean(variant && variant.stock > 0 && !isSalesBlocked);
                      const isSel = selectedSize === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          disabled={!inStock}
                          onClick={() => setSelectedSize(sz)}
                          className={`py-2.5 text-xs font-semibold border transition-colors ${
                            !inStock
                              ? 'border-neutral-200 text-neutral-300 line-through cursor-not-allowed'
                              : isSel
                                ? 'bg-black text-white border-black cursor-pointer'
                                : 'border-neutral-300 text-black hover:border-black cursor-pointer'
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={
                    isSalesBlocked ||
                    !activeVariantForQuickView ||
                    activeVariantForQuickView.stock <= 0 ||
                    adding
                  }
                  onClick={handleQuickAdd}
                  className="w-full bg-black text-white py-3.5 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" strokeWidth={1.6} />
                  <span>
                    {product.status === 'unavailable'
                      ? t.shop.unavailable
                      : product.status === 'paused'
                        ? t.shop.paused
                        : !activeVariantForQuickView || activeVariantForQuickView.stock <= 0
                          ? t.shop.outOfStock
                          : t.shop.addToCart}
                  </span>
                </button>
                <Link
                  to={localePath(`/product/${product.slug}`)}
                  onClick={() => setQuickViewOpen(false)}
                  className="block w-full border border-neutral-300 py-3 text-center text-xs font-semibold hover:border-black transition-colors"
                >
                  {t.shop.specifications}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
