import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useCartUi } from '../contexts/CartUiContext';
import { formatMinorUnits } from '../lib/currency';
import {
  evaluateDiscountCode,
  fetchAllActiveVariants,
  fetchPublishedProducts,
} from '../lib/storeService';
import type { Product, ProductVariant } from '../types/domain';
import { ImageSlot } from '../components/ImageSlot';
import { calculateQuantityPromotion, fetchQuantityPromotion } from '../lib/quantityPromotion';
import type { QuantityPromotion } from '../types/domain';

export function CartPage() {
  const { locale, t, localePath } = useLocale();
  const { items, updateQuantity, removeItem } = useCartUi();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountPiasters, setDiscountPiasters] = useState(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [quantityPromotion, setQuantityPromotion] = useState<QuantityPromotion | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchPublishedProducts(), fetchAllActiveVariants()])
      .then(([p, v]) => {
        if (active) {
          setProducts(p);
          setVariants(v);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => { void fetchQuantityPromotion().then(setQuantityPromotion); }, []);

  const hydratedItems = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return items.map((item) => {
      const product = productMap.get(item.productId);
      const variant = variantMap.get(item.variantId);
      const unitPrice = product ? variant?.pricePiasters ?? product.salePricePiasters ?? product.pricePiasters : 0;
      const colorObj = product?.colors?.find((c) => c.colorKey === item.colorKey);
      const imageUrl =
        colorObj?.frontImageUrl ||
        product?.media?.find((m) => m.colorKey === item.colorKey)?.url ||
        product?.media?.[0]?.url;

      return {
        ...item,
        product,
        variant,
        name: product ? (locale === 'ar' ? product.name_ar : product.name_en) : item.productId,
        colorLabel: variant
          ? locale === 'ar'
            ? variant.colorName_ar
            : variant.colorName_en
          : item.colorKey,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        maxStock: variant?.stock ?? 20,
        imageUrl,
      };
    });
  }, [items, products, variants, locale]);

  const subtotalPiasters = useMemo(
    () => hydratedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [hydratedItems]
  );
  const itemCount = hydratedItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowestUnitPrice = hydratedItems.reduce((min, item) => item.quantity > 0 ? Math.min(min, item.unitPrice) : min, Number.POSITIVE_INFINITY);
  const quantityDeal = calculateQuantityPromotion(quantityPromotion, subtotalPiasters, itemCount, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
  const totalDiscountPiasters = Math.max(discountPiasters, quantityDeal.discountPiasters);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponMessage(null);
    if (!couponInput.trim()) return;
    const res = await evaluateDiscountCode(couponInput, subtotalPiasters, itemCount, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
    if (!res.valid) {
      setAppliedCode(null);
      setDiscountPiasters(0);
      setCouponMessage(t.cart.couponInvalid);
    } else {
      setAppliedCode(res.discount?.code || couponInput.trim().toUpperCase());
      setDiscountPiasters(res.discountPiasters);
      setCouponMessage(t.cart.couponApplied);
    }
  };

  const totalPiasters = Math.max(0, subtotalPiasters - totalDiscountPiasters);

  return (
    <div className="bg-white text-black min-h-[75vh]">
      <section className="bg-black text-white py-14 border-b border-neutral-800">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <h1
            className={`text-3xl sm:text-4xl font-semibold ${
              locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
            }`}
          >
            {t.cart.title}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-12 lg:py-16">
        {loading ? (
          <p className="text-sm text-neutral-500">...</p>
        ) : hydratedItems.length === 0 ? (
          <div className="border border-neutral-200 p-12 text-center space-y-6">
            <p className="text-base text-neutral-600">{t.cart.empty}</p>
            <Link
              to={localePath('/shop')}
              className="inline-flex items-center justify-center bg-black text-white px-8 py-3.5 text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              {t.cart.continueShopping}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-8 divide-y divide-neutral-200 border-t border-b border-neutral-200">
              {hydratedItems.map((item) => (
                <div key={item.id} className="py-6 flex gap-5 sm:gap-6">
                  <Link
                    to={item.product ? localePath(`/product/${item.product.slug}`) : localePath('/shop')}
                    className="w-24 sm:w-28 shrink-0"
                  >
                    <ImageSlot src={item.imageUrl} alt={item.name} aspectClass="aspect-[4/5]" />
                  </Link>
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          to={item.product ? localePath(`/product/${item.product.slug}`) : localePath('/shop')}
                          className="text-base font-semibold hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-neutral-500 mt-1">
                          {item.colorLabel} · {item.size}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.cart.remove}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center border border-neutral-300">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
                          aria-label="-"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-xs font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.maxStock}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          aria-label="+"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-base font-semibold tabular-nums">
                        {formatMinorUnits(item.lineTotal, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="lg:col-span-4 border border-neutral-200 bg-neutral-50 p-6 sm:p-8 space-y-6">
              <h2 className="text-sm font-semibold border-b border-neutral-200 pb-4">
                {t.checkout.orderSummary}
              </h2>

              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={t.cart.couponPlaceholder}
                  className="flex-1 border border-neutral-300 bg-white px-3 py-2.5 text-xs focus:border-black focus:outline-none uppercase"
                />
                <button
                  type="submit"
                  className="border border-black bg-white text-black px-4 py-2.5 text-xs font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer"
                >
                  {t.cart.applyCoupon}
                </button>
              </form>
              {couponMessage && <p className="text-xs font-medium">{couponMessage}</p>}

              <div className="space-y-3 text-sm border-t border-neutral-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t.cart.subtotal}</span>
                  <span className="font-medium tabular-nums">
                    {formatMinorUnits(subtotalPiasters, locale)}
                  </span>
                </div>
                {totalDiscountPiasters > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">{t.cart.discount}</span>
                    <span className="font-medium tabular-nums">
                      -{formatMinorUnits(totalDiscountPiasters, locale)}
                    </span>
                  </div>
                )}
                {quantityDeal.qualifies && <p className="text-xs text-emerald-800">{locale === 'ar' ? 'تم تطبيق عرض عدد القطع تلقائيًا.' : 'Automatic quantity offer applied.'}</p>}
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t.cart.shippingEstimate}</span>
                  <span className="text-xs text-neutral-500">{t.cart.shippingAtCheckout}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold">
                  <span>{t.cart.total}</span>
                  <span className="tabular-nums">{formatMinorUnits(totalPiasters, locale)}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <Link
                  to={localePath(
                    appliedCode ? `/checkout?coupon=${encodeURIComponent(appliedCode)}` : '/checkout'
                  )}
                  className="block w-full bg-black text-white py-4 text-center text-xs font-semibold hover:bg-neutral-800 transition-colors"
                >
                  {t.cart.proceedCheckout}
                </Link>
                <Link
                  to={localePath('/shop')}
                  className="block w-full border border-neutral-300 bg-white py-3.5 text-center text-xs font-semibold hover:border-black transition-colors"
                >
                  {t.cart.continueShopping}
                </Link>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
