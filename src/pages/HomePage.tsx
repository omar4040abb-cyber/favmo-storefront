import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { fetchAllActiveVariants, fetchCollections, fetchPublishedProducts } from '../lib/storeService';
import type { CmsPage, Collection, Product, ProductVariant } from '../types/domain';
import { ImageSlot } from '../components/ImageSlot';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';

const newsletterSchema = z.object({
  email: z.string().trim().email(),
});

type NewsletterFormValues = z.infer<typeof newsletterSchema>;

export function HomePage() {
  const { locale, t, localePath } = useLocale();
  const { storefront } = useStoreSettings();
  const shouldReduceMotion = useReducedMotion();

  const [homeCms, setHomeCms] = useState<CmsPage | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Collection[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [newsletterState, setNewsletterState] = useState<
    'idle' | 'success' | 'already' | 'error'
  >('idle');
  const [newsletterErrorMsg, setNewsletterErrorMsg] = useState<string | null>(null);

  const {
    register: registerNewsletter,
    handleSubmit: handleNewsletterSubmit,
    reset: resetNewsletter,
    formState: { errors: newsletterErrors, isSubmitting: newsletterSubmitting },
  } = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      try {
        const cmsRes = await fetch('/api/cms/home');
        if (cmsRes.ok) {
          const data = await cmsRes.json();
          if (active && data.page) {
            setHomeCms(data.page);
          }
        }
      } catch {
        // Fallback cleanly
      }

      try {
        const [loaded, vars, cols] = await Promise.all([
          fetchPublishedProducts(),
          fetchAllActiveVariants(),
          fetchCollections(false),
        ]);
        if (active) {
          setProducts(loaded);
          setVariants(vars);
          setCategories(cols.filter((c) => !c.parentId));
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('permission')) {
          handleFirestoreError(err, OperationType.LIST, 'products');
        }
      } finally {
        if (active) setLoadingProducts(false);
      }
    }

    loadHomeData();
    return () => {
      active = false;
    };
  }, []);

  const onSubscribe = async (values: NewsletterFormValues) => {
    setNewsletterState('idle');
    setNewsletterErrorMsg(null);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewsletterState('error');
        setNewsletterErrorMsg(data.blocked ? data.error : t.newsletter.error);
        return;
      }
      if (data.alreadySubscribed) {
        setNewsletterState('already');
      } else {
        setNewsletterState('success');
        resetNewsletter();
      }
    } catch {
      setNewsletterState('error');
      setNewsletterErrorMsg(t.newsletter.error);
    }
  };

  const fadeUpProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
      };

  const latestProducts = [...products]
    .sort((a, b) => ((b.createdAt as { seconds?: number })?.seconds || 0) - ((a.createdAt as { seconds?: number })?.seconds || 0))
    .slice(0, 6);

  const heroSrc = homeCms?.heroMediaUrl || storefront.heroImageUrl;
  const heroType = homeCms?.heroMediaUrl
    ? 'image'
    : storefront.heroImageUrl ? 'image' : homeCms?.heroMediaType || 'placeholder';
  const campaignSrc = homeCms?.campaignImageUrl || storefront.campaignImageUrl;
  const editorialSrc =
    storefront.editorialImageUrl ||
    '/assets/aistudio/WhatsApp_Image_2026-11-11_at_4.51.17_PM_fd963892.jpeg';

  return (
    <div>
      {/* 1. Full-Screen Cinematic Hero */}
      <section className="relative min-h-[92vh] bg-black text-white flex items-end pt-24 pb-16 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0">
          <ImageSlot
            mediaType={heroType}
            src={heroSrc}
            poster={homeCms?.heroPosterUrl}
            alt="FAVMO"
            aspectClass="h-full w-full"
            darkSurface
            priority
            slotLabel={t.hero.videoFallbackNote}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/35"
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl space-y-6">
            <p
              className={`text-xs font-medium text-neutral-300 ${
                locale === 'en' ? 'tracking-[0.24em]' : ''
              }`}
            >
              {locale === 'ar' ? storefront.storeName_ar || t.hero.kicker : storefront.storeName_en || t.hero.kicker}
            </p>
            <h1
              className={`text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.06] text-balance ${
                locale === 'en' ? 'font-display-en tracking-[-0.02em]' : 'font-display-ar'
              }`}
            >
              {(locale === 'ar' ? homeCms?.title_ar : homeCms?.title_en)?.trim() || t.hero.headline}
            </h1>
            <p className="text-base sm:text-lg text-neutral-300 max-w-xl">
              {(locale === 'ar' ? homeCms?.body_ar : homeCms?.body_en)?.trim() || t.hero.subheadline}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                to={localePath('/shop')}
                className="inline-flex items-center justify-center gap-2 bg-white text-black px-8 py-4 text-xs font-semibold hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{t.hero.primaryCta}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" strokeWidth={1.75} />
              </Link>
              <Link
                to={localePath('/about')}
                className="inline-flex items-center justify-center border border-white/50 text-white px-8 py-4 text-xs font-semibold hover:border-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                {t.hero.secondaryCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Brand Statement + Published Categories (Pure White) */}
      <section className="bg-white text-black border-b border-neutral-200">
        <motion.div
          {...fadeUpProps}
          className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-20 lg:py-28 space-y-14"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4">
              <p
                className={`text-xs font-medium text-neutral-500 ${
                  locale === 'en' ? 'tracking-[0.2em]' : ''
                }`}
              >
                {t.statement.eyebrow}
              </p>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <h2
                className={`text-3xl sm:text-4xl lg:text-5xl font-semibold text-balance ${
                  locale === 'en' ? 'font-display-en tracking-[-0.02em]' : 'font-display-ar'
                }`}
              >
                {t.statement.headline}
              </h2>
              <p className="text-base sm:text-lg text-neutral-600 max-w-2xl">
                {t.statement.body}
              </p>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={localePath(`/shop?category=${cat.slug}`)}
                  className="group relative h-96 bg-neutral-100 overflow-hidden block"
                >
                  {cat.heroImageUrl && (
                    <img
                      src={cat.heroImageUrl}
                      alt={locale === 'ar' ? cat.name_ar : cat.name_en}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-6 inset-x-6 text-white space-y-1">
                    <h3 className="text-lg font-semibold">
                      {locale === 'ar' ? cat.name_ar : cat.name_en}
                    </h3>
                    <p className="text-xs text-neutral-300 group-hover:underline">
                      {t.collectionSection.viewAll}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* 3. Latest Drops */}
      <section className="bg-[#FAFAFA] text-black py-24 border-b border-neutral-200">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 space-y-12">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-6">
            <div>
              <p className="text-xs font-mono-code text-neutral-500 uppercase tracking-wider">
                {t.shop.latestDrops}
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold mt-1">
                {t.collectionSection.title}
              </h2>
            </div>
            <Link
              to={localePath('/shop')}
              className="text-xs font-semibold uppercase tracking-wider underline hover:text-neutral-600"
            >
              {t.collectionSection.viewAll}
            </Link>
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <ProductCardSkeleton />
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </div>
          ) : latestProducts.length === 0 ? (
            <div className="border border-neutral-200 bg-white p-12 text-center space-y-3">
              <p className="text-sm font-semibold">{t.collectionSection.emptyTitle}</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                {t.collectionSection.emptyBody}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {latestProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  variants={variants.filter((v) => v.productId === p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Campaign Feature Banner */}
      <section className="relative min-h-[75vh] bg-black text-white flex items-center py-24 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-60">
          <img
            src={campaignSrc || editorialSrc}
            alt="Campaign"
            className="w-full h-full object-cover select-none"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
        </div>
        <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 space-y-6 max-w-2xl">
          <p className="text-xs font-mono-code tracking-[0.2em] uppercase text-neutral-300">
            {t.campaignSection.eyebrow}
          </p>
          <h2
            className={`text-4xl sm:text-6xl font-bold leading-tight ${
              locale === 'en' ? 'font-display-en tracking-[-0.02em]' : 'font-display-ar'
            }`}
          >
            {(locale === 'ar' ? homeCms?.campaignTitle_ar : homeCms?.campaignTitle_en)?.trim() || t.campaignSection.headline}
          </h2>
          <p className="text-base text-neutral-300">{(locale === 'ar' ? homeCms?.campaignBody_ar : homeCms?.campaignBody_en)?.trim() || t.campaignSection.subheadline}</p>
          <div className="pt-2">
            <Link
              to={localePath('/shop')}
              className="inline-flex items-center justify-center bg-white text-black px-8 py-4 text-xs font-semibold hover:bg-neutral-200 transition-colors"
            >
              {(locale === 'ar' ? homeCms?.campaignCta_ar : homeCms?.campaignCta_en)?.trim() || t.campaignSection.cta}
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Newsletter Dispatch */}
      <section className="bg-white text-black py-24 border-b border-neutral-200">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center space-y-6">
          <p className="text-xs font-mono-code text-neutral-500 uppercase tracking-wider">
            {t.newsletter.eyebrow}
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold">{t.newsletter.headline}</h2>
          <p className="text-sm text-neutral-600 max-w-lg mx-auto">
            {t.newsletter.description}
          </p>

          <form onSubmit={handleNewsletterSubmit(onSubscribe)} className="max-w-md mx-auto space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                required
                dir="ltr"
                placeholder={t.newsletter.emailPlaceholder}
                {...registerNewsletter('email')}
                className="flex-1 border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-black focus:bg-white focus:border-black focus:outline-none"
              />
              <button
                type="submit"
                disabled={newsletterSubmitting}
                className="bg-black text-white px-6 py-3 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                {newsletterSubmitting ? t.newsletter.submitting : t.newsletter.submit}
              </button>
            </div>
            {newsletterErrors.email && (
              <p className="text-xs text-red-600 font-medium">
                {locale === 'ar' ? 'يرجى إدخال بريد إلكتروني صالح' : 'Please enter a valid email address.'}
              </p>
            )}
            {newsletterState === 'success' && (
              <p className="text-xs text-emerald-700 font-medium p-2 bg-emerald-50 border border-emerald-200">
                {t.newsletter.success}
              </p>
            )}
            {newsletterState === 'already' && (
              <p className="text-xs text-amber-700 font-medium p-2 bg-amber-50 border border-amber-200">
                {t.newsletter.alreadySubscribed}
              </p>
            )}
            {newsletterState === 'error' && (
              <p className="text-xs text-red-700 font-medium p-2 bg-red-50 border border-red-200">
                {newsletterErrorMsg || t.newsletter.error}
              </p>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
