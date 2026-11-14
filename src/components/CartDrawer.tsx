import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useCartUi } from '../contexts/CartUiContext';
import { formatMinorUnits } from '../lib/currency';
import { fetchAllActiveVariants, fetchPublishedProducts } from '../lib/storeService';
import type { Product, ProductVariant } from '../types/domain';
import { ImageSlot } from './ImageSlot';

export function CartDrawer() {
  const { locale, t, localePath } = useLocale();
  const { items, itemCount, isDrawerOpen, closeDrawer, updateQuantity, removeItem } = useCartUi();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    let active = true;
    Promise.all([fetchPublishedProducts(), fetchAllActiveVariants()])
      .then(([p, v]) => {
        if (active) {
          setProducts(p);
          setVariants(v);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  const hydratedItems = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    return items.map((item) => {
      const product = productMap.get(item.productId);
      const variant = variantMap.get(item.variantId);
      const unitPrice = product ? product.salePricePiasters ?? product.pricePiasters : 0;
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

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.pages.cartTitle}
        className="fixed inset-y-0 end-0 w-full max-w-md bg-white text-black border-s border-neutral-200 flex flex-col justify-between shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <span dir="ltr" className="inline-flex">
              <ShoppingBag className="w-4 h-4" strokeWidth={1.6} />
            </span>
            <h2
              className={`text-sm font-semibold ${
                locale === 'en' ? 'tracking-[0.14em]' : ''
              }`}
            >
              {t.pages.cartTitle} ({itemCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="inline-flex items-center justify-center w-10 h-10 text-neutral-600 hover:text-black transition-colors cursor-pointer"
            aria-label={t.nav.close}
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {hydratedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-5 py-16">
              <div className="w-12 h-12 border border-neutral-200 flex items-center justify-center">
                <span dir="ltr" className="inline-flex">
                  <ShoppingBag className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
                </span>
              </div>
              <p className="text-sm text-neutral-600 max-w-xs">{t.pages.cartEmpty}</p>
              <Link
                to={localePath('/shop')}
                onClick={closeDrawer}
                className="inline-flex items-center justify-center bg-black text-white px-8 py-3.5 text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                {t.hero.primaryCta}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {hydratedItems.map((item) => (
                <div key={item.id} className="py-4 flex gap-4">
                  <Link
                    to={item.product ? localePath(`/product/${item.product.slug}`) : localePath('/shop')}
                    onClick={closeDrawer}
                    className="w-20 shrink-0"
                  >
                    <ImageSlot src={item.imageUrl} alt={item.name} aspectClass="aspect-[4/5]" />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={item.product ? localePath(`/product/${item.product.slug}`) : localePath('/shop')}
                          onClick={closeDrawer}
                          className="text-sm font-medium hover:underline line-clamp-1"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {item.colorLabel} · {item.size}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={t.cart.remove}
                        className="text-neutral-400 hover:text-black p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <div className="inline-flex items-center border border-neutral-300">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
                          aria-label="-"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-medium tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.maxStock}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          aria-label="+"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {item.unitPrice > 0 ? formatMinorUnits(item.lineTotal, locale) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-6 space-y-4 bg-neutral-50">
          {hydratedItems.length > 0 && subtotalPiasters > 0 && (
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-neutral-600">{t.cart.subtotal}</span>
              <span className="font-semibold tabular-nums">
                {formatMinorUnits(subtotalPiasters, locale)}
              </span>
            </div>
          )}
          <div className="space-y-2.5">
            <Link
              to={localePath('/cart')}
              onClick={closeDrawer}
              className="block w-full border border-black text-black py-3.5 text-center text-xs font-semibold hover:bg-black hover:text-white transition-colors"
            >
              {t.pages.cartTitle}
            </Link>
            {hydratedItems.length > 0 && (
              <Link
                to={localePath('/checkout')}
                onClick={closeDrawer}
                className="block w-full bg-black text-white py-3.5 text-center text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                {t.cart.proceedCheckout}
              </Link>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
