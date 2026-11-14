import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  Ruler,
  ShoppingBag,
  Star,
  X,
  ZoomIn,
} from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useCartUi } from '../contexts/CartUiContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import { formatMinorUnits } from '../lib/currency';
import {
  fetchAllActiveVariants,
  fetchProductReviews,
  fetchPublishedProducts,
  submitProductReview,
} from '../lib/storeService';
import {
  CLOTHING_SIZES,
  type ClothingSize,
  type Product,
  type ProductReview,
  type ProductVariant,
} from '../types/domain';
import { ImageSlot } from '../components/ImageSlot';
import { ProductCard } from '../components/ProductCard';
import { SkeletonBox } from '../components/Skeleton';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t, localePath } = useLocale();
  const { user } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addItem, openDrawer } = useCartUi();
  const { storefront } = useStoreSettings();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingPolicyBody, setShippingPolicyBody] = useState<string>('');

  const [selectedColorKey, setSelectedColorKey] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<ClothingSize | ''>('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<'specs' | 'shipping' | null>('specs');
  const [addedToast, setAddedToast] = useState(false);

  // Review submission state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmittedNotice, setReviewSubmittedNotice] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [p, v] = await Promise.all([fetchPublishedProducts(), fetchAllActiveVariants()]);
        if (active) {
          setProducts(p);
          setVariants(v);
        }
        try {
          const cmsRes = await fetch('/api/cms/shipping-returns');
          if (cmsRes.ok) {
            const data = await cmsRes.json();
            if (active && data.page) {
              setShippingPolicyBody(locale === 'ar' ? data.page.body_ar : data.page.body_en);
            }
          }
        } catch {
          // ignore
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [slug, locale]);

  const product = useMemo(
    () => products.find((p) => p.slug === slug || p.id === slug) || null,
    [products, slug]
  );

  useEffect(() => {
    let active = true;
    if (!product?.id) {
      setReviews([]);
      return;
    }
    fetchProductReviews(product.id).then((list) => {
      if (active) setReviews(list);
    });
    return () => {
      active = false;
    };
  }, [product?.id]);

  const productVariants = useMemo(
    () => (product ? variants.filter((v) => v.productId === product.id && v.active) : []),
    [product, variants]
  );

  const colors = useMemo(() => {
    if (!product) return [];
    if (product.colors && product.colors.length > 0) return product.colors;
    const map = new Map<
      string,
      {
        colorKey: string;
        colorName_ar: string;
        colorName_en: string;
        colorHex: string;
        frontImageUrl?: string;
        backImageUrl?: string;
        embroideryImageUrl?: string;
        fabricImageUrl?: string;
      }
    >();
    for (const v of productVariants) {
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
  }, [product, productVariants]);

  useEffect(() => {
    if (!product) return;
    const firstColor = colors[0]?.colorKey || productVariants[0]?.colorKey || '';
    setSelectedColorKey(firstColor);
    const firstInStock = productVariants.find(
      (v) => (!firstColor || v.colorKey === firstColor) && v.stock > 0
    );
    setSelectedSize(firstInStock?.size || '');
    setQuantity(1);
    setSelectedImageUrl('');
  }, [product?.id]);

  const activeColor = useMemo(
    () => colors.find((c) => c.colorKey === selectedColorKey) || colors[0],
    [colors, selectedColorKey]
  );

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const urls: string[] = [];
    const sortedMedia = [...(product.media || [])].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

    for (const m of sortedMedia) {
      if ((!selectedColorKey || m.colorKey === selectedColorKey) && m.isMain && m.url && !urls.includes(m.url)) {
        urls.push(m.url);
      }
    }
    if (activeColor?.frontImageUrl && !urls.includes(activeColor.frontImageUrl)) {
      urls.push(activeColor.frontImageUrl);
    }
    if (activeColor?.backImageUrl && !urls.includes(activeColor.backImageUrl)) {
      urls.push(activeColor.backImageUrl);
    }
    if (activeColor?.embroideryImageUrl && !urls.includes(activeColor.embroideryImageUrl)) {
      urls.push(activeColor.embroideryImageUrl);
    }
    if (activeColor?.fabricImageUrl && !urls.includes(activeColor.fabricImageUrl)) {
      urls.push(activeColor.fabricImageUrl);
    }
    for (const m of sortedMedia) {
      if ((!selectedColorKey || m.colorKey === selectedColorKey) && m.url && !urls.includes(m.url)) {
        urls.push(m.url);
      }
    }
    if (urls.length === 0) {
      for (const m of sortedMedia) {
        if (m.url && !urls.includes(m.url)) urls.push(m.url);
      }
    }
    return urls;
  }, [product, activeColor, selectedColorKey]);

  const mainImage =
    selectedImageUrl && galleryImages.includes(selectedImageUrl)
      ? selectedImageUrl
      : galleryImages[0] || '';

  const currentImageIdx = Math.max(0, galleryImages.indexOf(mainImage));

  const displaySizes = useMemo(() => {
    if (!product) return [];
    if (product.availableSizes && product.availableSizes.length > 0) {
      return CLOTHING_SIZES.filter((sz) => product.availableSizes!.includes(sz));
    }
    const existingSet = new Set(productVariants.map((v) => v.size));
    return CLOTHING_SIZES.filter(
      (sz) => existingSet.has(sz) || ['S', 'M', 'L', 'XL', 'XXL'].includes(sz)
    );
  }, [product, productVariants]);

  const selectedVariant = useMemo(() => {
    if (!selectedSize) return null;
    return (
      productVariants.find(
        (v) => (!activeColor || v.colorKey === activeColor.colorKey) && v.size === selectedSize
      ) || null
    );
  }, [productVariants, activeColor, selectedSize]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.id !== product.id && p.collectionId === product.collectionId)
      .slice(0, 3);
  }, [products, product]);

  // Inject dynamic Product JSON-LD
  useEffect(() => {
    if (!product) return;
    const effectivePrice =
      (selectedVariant?.pricePiasters ?? product.salePricePiasters ?? product.pricePiasters) / 100;
    const inStock = product.status === 'published' && productVariants.some((v) => v.stock > 0);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: locale === 'ar' ? product.name_ar : product.name_en,
      description: (locale === 'ar' ? product.description_ar : product.description_en) || '',
      image: galleryImages,
      sku: selectedVariant?.sku || product.sku || productVariants[0]?.sku || product.id,
      brand: { '@type': 'Brand', name: 'FAVMO' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'EGP',
        price: effectivePrice.toFixed(2),
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: window.location.href,
      },
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'favmo-product-jsonld';
    script.textContent = JSON.stringify(jsonLd);
    document.getElementById('favmo-product-jsonld')?.remove();
    document.head.appendChild(script);
    return () => {
      document.getElementById('favmo-product-jsonld')?.remove();
    };
  }, [product, productVariants, galleryImages, selectedVariant, locale]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-14 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7">
          <SkeletonBox className="aspect-[4/5] w-full" />
        </div>
        <div className="lg:col-span-5 space-y-6">
          <SkeletonBox className="h-10 w-3/4" />
          <SkeletonBox className="h-6 w-1/3" />
          <SkeletonBox className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-24 text-center space-y-6">
        <h1 className="text-3xl font-semibold">{t.errors.notFoundTitle}</h1>
        <Link
          to={localePath('/shop')}
          className="inline-flex items-center justify-center bg-black text-white px-8 py-3.5 text-xs font-semibold"
        >
          {t.cart.continueShopping}
        </Link>
      </div>
    );
  }

  const name = locale === 'ar' ? product.name_ar : product.name_en;
  const description = locale === 'ar' ? product.description_ar : product.description_en;
  const specs = locale === 'ar' ? product.specs_ar : product.specs_en;
  const effectivePrice =
    selectedVariant?.pricePiasters ?? product.salePricePiasters ?? product.pricePiasters;
  const hasSale =
    !selectedVariant?.pricePiasters &&
    typeof product.salePricePiasters === 'number' &&
    product.salePricePiasters > 0 &&
    product.salePricePiasters < product.pricePiasters;

  const isPausedOrUnavailable = product.status === 'paused' || product.status === 'unavailable';
  const canAdd = Boolean(!isPausedOrUnavailable && selectedVariant && selectedVariant.stock > 0);
  const wishlisted = isWishlisted(product.id);
  const threshold = selectedVariant?.lowStockThreshold ?? product.lowStockThreshold ?? 3;

  const handleAddToCart = async (goToCheckout = false) => {
    if (!canAdd || !selectedVariant) return;
    await addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      colorKey: selectedVariant.colorKey,
      size: selectedVariant.size,
      quantity: Math.min(quantity, selectedVariant.stock),
    });
    if (goToCheckout) {
      navigate(localePath('/checkout'));
    } else {
      setAddedToast(true);
      openDrawer();
      setTimeout(() => setAddedToast(false), 2500);
    }
  };

  const handleStepImage = (step: -1 | 1) => {
    if (galleryImages.length <= 1) return;
    const nextIdx = (currentImageIdx + step + galleryImages.length) % galleryImages.length;
    setSelectedImageUrl(galleryImages[nextIdx]);
  };

  const waDigits = (storefront.whatsappNumber || '').replace(/\D/g, '');
  const colorLabel = activeColor
    ? locale === 'ar'
      ? activeColor.colorName_ar
      : activeColor.colorName_en
    : '';
  const waText =
    locale === 'ar'
      ? `مرحباً FAVMO، أود الاستفسار عن المنتج: ${name}${colorLabel ? ` - اللون: ${colorLabel}` : ''}${selectedSize ? ` - المقاس: ${selectedSize}` : ''} - الكمية: ${quantity}`
      : `Hello FAVMO, I would like to inquire about: ${name}${colorLabel ? ` | Color: ${colorLabel}` : ''}${selectedSize ? ` | Size: ${selectedSize}` : ''} | Qty: ${quantity}`;
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : '';

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewComment.trim()) return;
    setSubmittingReview(true);
    setReviewSubmittedNotice(false);
    try {
      await submitProductReview({
        productId: product.id,
        userId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'FAVMO Member',
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewComment('');
      setReviewRating(5);
      setReviewSubmittedNotice(true);
      const updated = await fetchProductReviews(product.id);
      setReviews(updated);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="bg-white text-black pb-20 lg:pb-0">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-10 lg:py-16">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs text-neutral-500 mb-8 flex items-center gap-2">
          <Link to={localePath('/')} className="hover:text-black">
            {t.nav.home}
          </Link>
          <span>/</span>
          <Link to={localePath('/shop')} className="hover:text-black">
            {t.nav.shop}
          </Link>
          <span>/</span>
          <span className="text-black font-medium truncate">{name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* Gallery */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative group">
              <ImageSlot src={mainImage} alt={name} aspectClass="aspect-[4/5]" priority />
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStepImage(-1)}
                    aria-label="Previous image"
                    className="absolute top-1/2 -translate-y-1/2 start-4 w-10 h-10 bg-white/95 text-black border border-neutral-300 flex items-center justify-center hover:bg-black hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepImage(1)}
                    aria-label="Next image"
                    className="absolute top-1/2 -translate-y-1/2 end-4 w-10 h-10 bg-white/95 text-black border border-neutral-300 flex items-center justify-center hover:bg-black hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </>
              )}
              {mainImage && (
                <button
                  type="button"
                  onClick={() => setZoomOpen(true)}
                  aria-label="Zoom"
                  className="absolute bottom-4 end-4 w-10 h-10 bg-white text-black border border-neutral-300 flex items-center justify-center hover:bg-black hover:text-white transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" strokeWidth={1.6} />
                </button>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {galleryImages.map((url, idx) => (
                  <button
                    key={url + idx}
                    type="button"
                    onClick={() => setSelectedImageUrl(url)}
                    className={`border transition-colors cursor-pointer ${
                      mainImage === url ? 'border-black' : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <ImageSlot src={url} alt={`${name} ${idx + 1}`} aspectClass="aspect-[4/5]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info & Purchase Panel */}
          <div className="lg:col-span-5 space-y-7">
            <div className="space-y-3 border-b border-neutral-200 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  {(product.sku || selectedVariant?.sku) && (
                    <p className="text-[11px] font-mono-code text-neutral-500" dir="ltr">
                      SKU: {selectedVariant?.sku || product.sku}
                    </p>
                  )}
                  <h1
                    className={`text-2xl sm:text-3xl font-semibold ${
                      locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
                    }`}
                  >
                    {name}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={t.nav.wishlist}
                  className={`w-10 h-10 shrink-0 border flex items-center justify-center transition-colors cursor-pointer ${
                    wishlisted
                      ? 'bg-black text-white border-black'
                      : 'border-neutral-300 text-black hover:border-black'
                  }`}
                >
                  <Heart className="w-4 h-4" fill={wishlisted ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="flex items-baseline gap-3 tabular-nums">
                <span className="text-xl font-semibold">
                  {formatMinorUnits(effectivePrice, locale)}
                </span>
                {hasSale && (
                  <span className="text-sm text-neutral-400 line-through">
                    {formatMinorUnits(product.pricePiasters, locale)}
                  </span>
                )}
              </div>

              {/* Status & Exact Stock Indicator */}
              <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                {product.status === 'paused' ? (
                  <span className="border border-black bg-neutral-100 px-3 py-1 font-semibold">
                    {t.shop.paused}
                  </span>
                ) : product.status === 'unavailable' ? (
                  <span className="border border-black bg-neutral-100 px-3 py-1 font-semibold">
                    {t.shop.unavailable}
                  </span>
                ) : selectedVariant ? (
                  selectedVariant.stock <= 0 ? (
                    <span className="border border-neutral-300 text-neutral-500 px-3 py-1 font-semibold">
                      {t.shop.outOfStock}
                    </span>
                  ) : selectedVariant.stock <= threshold ? (
                    <span className="border border-black px-3 py-1 font-semibold">
                      {t.shop.lowStock} ({selectedVariant.stock} {t.shop.stockAvailableCount})
                    </span>
                  ) : (
                    <span className="border border-neutral-300 px-3 py-1 font-medium text-neutral-700">
                      {t.shop.available} ({selectedVariant.stock} {t.shop.stockAvailableCount})
                    </span>
                  )
                ) : null}
              </div>

              {description && (
                <p className="text-sm text-neutral-600 leading-relaxed pt-2">{description}</p>
              )}
            </div>

            {/* Colors */}
            {colors.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-neutral-500">
                  {t.shop.selectColor}:{' '}
                  <span className="text-black">
                    {locale === 'ar' ? activeColor?.colorName_ar : activeColor?.colorName_en}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {colors.map((c, idx) => {
                    const isSelected = c.colorKey === activeColor?.colorKey;
                    return (
                      <button
                        key={`${c.colorKey}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedColorKey(c.colorKey);
                          setSelectedImageUrl('');
                        }}
                        className={`w-8 h-8 border cursor-pointer ${
                          isSelected ? 'border-2 border-black' : 'border-neutral-300'
                        }`}
                        style={{ backgroundColor: c.colorHex }}
                        aria-label={locale === 'ar' ? c.colorName_ar : c.colorName_en}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizes (XS - 3XL) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500">{t.shop.selectSize}</span>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold underline hover:text-neutral-600 cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>{t.shop.sizeGuide}</span>
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {displaySizes.map((sz) => {
                  const variant = productVariants.find(
                    (v) => (!activeColor || v.colorKey === activeColor.colorKey) && v.size === sz
                  );
                  const inStock = Boolean(!isPausedOrUnavailable && variant && variant.stock > 0);
                  const isSelected = selectedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={!inStock}
                      onClick={() => {
                        setSelectedSize(sz);
                        setQuantity(1);
                      }}
                      className={`py-3 text-xs font-semibold border transition-colors ${
                        !inStock
                          ? 'border-neutral-200 text-neutral-300 line-through cursor-not-allowed'
                          : isSelected
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

            {/* Quantity + Buttons + WhatsApp Inquiry */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-neutral-300 h-12">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-11 h-full flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
                    aria-label="-"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-11 text-center text-sm font-medium tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={!selectedVariant || quantity >= selectedVariant.stock}
                    onClick={() =>
                      setQuantity((q) => Math.min(selectedVariant?.stock || 20, q + 1))
                    }
                    className="w-11 h-full flex items-center justify-center hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                    aria-label="+"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={() => handleAddToCart(false)}
                  className="flex-1 h-12 bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" strokeWidth={1.6} />
                  <span>
                    {product.status === 'paused'
                      ? t.shop.paused
                      : product.status === 'unavailable'
                        ? t.shop.unavailable
                        : canAdd
                          ? t.shop.addToCart
                          : t.shop.outOfStock}
                  </span>
                </button>
              </div>

              <button
                type="button"
                disabled={!canAdd}
                onClick={() => handleAddToCart(true)}
                className="w-full h-12 border border-black text-black text-xs font-semibold hover:bg-black hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                {t.shop.buyNow}
              </button>

              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-11 border border-neutral-300 text-black text-xs font-semibold flex items-center justify-center gap-2 hover:border-black transition-colors"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={1.6} />
                  <span>{t.shop.askWhatsapp}</span>
                </a>
              ) : (
                <Link
                  to={localePath('/contact')}
                  className="w-full h-11 border border-neutral-300 text-black text-xs font-semibold flex items-center justify-center gap-2 hover:border-black transition-colors"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={1.6} />
                  <span>{t.footer.contact}</span>
                </Link>
              )}

              {addedToast && (
                <p role="status" className="text-xs font-semibold text-black">
                  {t.shop.addedToBag}
                </p>
              )}
            </div>

            {/* Accordions */}
            <div className="border-t border-neutral-200 divide-y divide-neutral-200 pt-2">
              <div>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(openAccordion === 'specs' ? null : 'specs')}
                  className="w-full py-4 flex items-center justify-between text-xs font-semibold cursor-pointer"
                >
                  <span>{t.shop.specifications}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      openAccordion === 'specs' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openAccordion === 'specs' && (
                  <div className="pb-4 text-sm text-neutral-600 whitespace-pre-line">
                    {specs || t.brand.ownerInputRequired}
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(openAccordion === 'shipping' ? null : 'shipping')}
                  className="w-full py-4 flex items-center justify-between text-xs font-semibold cursor-pointer"
                >
                  <span>{t.shop.shippingInfo}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      openAccordion === 'shipping' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openAccordion === 'shipping' && (
                  <div className="pb-4 text-sm text-neutral-600 whitespace-pre-line">
                    {shippingPolicyBody || t.pages.ownerInputNotice}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews */}
        <section className="mt-20 pt-14 border-t border-neutral-200 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-5">
            <h2 className="text-xl font-semibold">{t.shop.reviewsTitle}</h2>
            {user && (
              <form onSubmit={handleSubmitReview} className="border border-neutral-200 p-6 space-y-4">
                <h3 className="text-xs font-semibold text-neutral-700">{t.shop.writeReview}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{t.shop.ratingLabel}:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      aria-label={`${star}`}
                      className="p-0.5 cursor-pointer"
                    >
                      <Star
                        className="w-4 h-4"
                        fill={star <= reviewRating ? 'currentColor' : 'none'}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t.shop.reviewCommentPlaceholder}
                  className="w-full border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-black focus:outline-none"
                />
                {reviewSubmittedNotice && (
                  <p className="text-xs font-semibold text-black">{t.shop.reviewSubmitted}</p>
                )}
                <button
                  type="submit"
                  disabled={submittingReview || !reviewComment.trim()}
                  className="bg-black text-white px-6 py-2.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
                >
                  {t.shop.submitReview}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 space-y-4">
            {reviews.length === 0 ? (
              <div className="border border-neutral-200 p-8 text-xs text-neutral-500">
                {t.shop.noReviews}
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 border border-neutral-200">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-6 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold">{rev.authorName}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className="w-3.5 h-3.5"
                            fill={star <= rev.rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-neutral-700 leading-relaxed">{rev.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Related Pieces */}
        {relatedProducts.length > 0 && (
          <section className="mt-20 pt-14 border-t border-neutral-200 space-y-8">
            <h2 className="text-2xl font-semibold">{t.shop.relatedProducts}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {relatedProducts.map((rel) => (
                <ProductCard
                  key={rel.id}
                  product={rel}
                  variants={variants.filter((v) => v.productId === rel.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile Sticky Buy Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-200 px-5 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-neutral-500 line-clamp-1">{name}</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatMinorUnits(effectivePrice, locale)}
          </p>
        </div>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => handleAddToCart(false)}
          className="bg-black text-white px-6 py-3 text-xs font-semibold disabled:opacity-40 cursor-pointer shrink-0"
        >
          {canAdd ? t.shop.addToCart : t.shop.outOfStock}
        </button>
      </div>

      {/* Zoom Modal */}
      {zoomOpen && mainImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            aria-label={t.nav.close}
            className="absolute top-5 end-5 w-10 h-10 bg-white text-black flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={mainImage} alt={name} className="max-h-[90vh] max-w-[90vw] object-contain" />
        </div>
      )}

      {/* Size Guide Modal */}
      {sizeGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/65"
            onClick={() => setSizeGuideOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg bg-white text-black border border-neutral-200 p-6 sm:p-8 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h3 className="text-sm font-semibold">{t.shop.sizeGuide}</h3>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                className="p-1 cursor-pointer"
                aria-label={t.nav.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {product.sizeChart && product.sizeChart.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500">
                      <th className="py-2 text-start">Size</th>
                      <th className="py-2 text-start">Chest (cm)</th>
                      <th className="py-2 text-start">Length (cm)</th>
                      <th className="py-2 text-start">Shoulder (cm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 tabular-nums">
                    {product.sizeChart.map((row) => (
                      <tr key={row.size}>
                        <td className="py-2.5 font-semibold">{row.size}</td>
                        <td className="py-2.5">{row.chestCm ?? '—'}</td>
                        <td className="py-2.5">{row.lengthCm ?? '—'}</td>
                        <td className="py-2.5">{row.shoulderCm ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-neutral-200 bg-neutral-50 p-6 text-center space-y-2">
                <p className="text-xs font-mono-code font-semibold">{t.brand.ownerInputRequired}</p>
                <p className="text-xs text-neutral-600">{t.pages.ownerInputNotice}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
