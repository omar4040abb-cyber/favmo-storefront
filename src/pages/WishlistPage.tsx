import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../contexts/LocaleContext';
import { useWishlist } from '../contexts/WishlistContext';
import { fetchAllActiveVariants, fetchPublishedProducts } from '../lib/storeService';
import type { Product, ProductVariant } from '../types/domain';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';

export function WishlistPage() {
  const { locale, t, localePath } = useLocale();
  const { productIds } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);

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

  const wishlistedProducts = useMemo(
    () => products.filter((p) => productIds.includes(p.id)),
    [products, productIds]
  );

  return (
    <div className="bg-white text-black min-h-[75vh]">
      <section className="bg-black text-white py-14 border-b border-neutral-800">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <h1
            className={`text-3xl sm:text-4xl font-semibold ${
              locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
            }`}
          >
            {t.pages.wishlistTitle}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-12 lg:py-16">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </div>
        ) : wishlistedProducts.length === 0 ? (
          <div className="border border-neutral-200 p-12 text-center space-y-5">
            <p className="text-base text-neutral-600">{t.pages.wishlistEmpty}</p>
            <Link
              to={localePath('/shop')}
              className="inline-flex bg-black text-white px-8 py-3.5 text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              {t.cart.continueShopping}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {wishlistedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variants={variants.filter((v) => v.productId === product.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
