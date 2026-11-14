import { useEffect, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext';
import type { CmsPage, CmsPageSlug } from '../types/domain';
import { ImageSlot } from '../components/ImageSlot';
import { SkeletonBox } from '../components/Skeleton';

interface EditorialPolicyPageProps {
  slug: Extract<CmsPageSlug, 'about' | 'shipping-returns' | 'privacy' | 'terms'>;
}

export function EditorialPolicyPage({ slug }: EditorialPolicyPageProps) {
  const { locale, t } = useLocale();
  const [cmsPage, setCmsPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/cms/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.page) {
          setCmsPage(data.page);
        } else if (active) {
          setCmsPage(null);
        }
      })
      .catch(() => {
        if (active) setCmsPage(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const titleBySlug: Record<EditorialPolicyPageProps['slug'], string> = {
    about: t.pages.aboutTitle,
    'shipping-returns': t.pages.shippingTitle,
    privacy: t.pages.privacyTitle,
    terms: t.pages.termsTitle,
  };

  const pageTitle = cmsPage
    ? locale === 'ar'
      ? cmsPage.title_ar
      : cmsPage.title_en
    : titleBySlug[slug];

  const pageBody = cmsPage
    ? (locale === 'ar' ? cmsPage.body_ar : cmsPage.body_en).trim()
    : '';

  const isPolicyPage = slug !== 'about';

  return (
    <div className="bg-white text-black">
      <section className="bg-black text-white py-20 lg:py-24 border-b border-neutral-800">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 space-y-4">
          <p
            className={`text-xs font-medium text-neutral-400 ${
              locale === 'en' ? 'tracking-[0.2em]' : ''
            }`}
          >
            FAVMO
          </p>
          <h1
            className={`text-3xl sm:text-5xl font-semibold max-w-3xl text-balance ${
              locale === 'en' ? 'font-display-en tracking-[-0.02em]' : 'font-display-ar'
            }`}
          >
            {pageTitle}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-16 lg:py-24">
        {loading ? (
          <div className="max-w-3xl space-y-4">
            <SkeletonBox className="h-6 w-1/2" />
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-4 w-5/6" />
            <SkeletonBox className="h-4 w-2/3" />
          </div>
        ) : pageBody ? (
          <div className="max-w-3xl space-y-6 text-base text-neutral-800 whitespace-pre-line leading-relaxed">
            {pageBody}
          </div>
        ) : isPolicyPage ? (
          <div className="max-w-2xl border border-neutral-300 bg-neutral-50 p-8 sm:p-12 space-y-4">
            <p
              dir="ltr"
              className="text-xs font-mono-code tracking-[0.18em] uppercase text-black font-semibold"
            >
              {t.brand.ownerInputRequired}
            </p>
            <p className="text-sm text-neutral-600 leading-relaxed">{t.pages.ownerInputNotice}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-6 space-y-6">
              {pageBody ? (
                <p className="text-lg text-neutral-800 leading-relaxed whitespace-pre-line">{pageBody}</p>
              ) : (
                <>
                  <p className="text-lg text-neutral-800 leading-relaxed">{t.pages.aboutDefaultBody}</p>
                  <p className="text-base text-neutral-600 leading-relaxed">{t.aboutSection.body}</p>
                </>
              )}
            </div>
            <div className="lg:col-span-6">
              <ImageSlot
                src={
                  cmsPage?.heroMediaUrl ||
                  '/assets/aistudio/WhatsApp_Image_2026-11-11_at_4.51.17_PM_fd963892.jpeg'
                }
                alt={pageTitle}
                aspectClass="aspect-[4/5]"
                slotLabel={`${t.brand.imageSlot} — About FAVMO`}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
