import { useState } from 'react';
import { useLocale } from '../contexts/LocaleContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';

interface BrandLogoProps {
  variant: 'white' | 'black';
  className?: string;
}

const DEFAULT_WHITE_LOGO =
  '/assets/aistudio/WhatsApp_Image_2026-11-13_at_6.34.24_PM_cbfdfecc.jpeg';

/**
 * Official FAVMO Logo renderer.
 * Reads admin-configured logo URL from Store Settings, falling back to supplied original asset.
 */
export function BrandLogo({ variant, className = '' }: BrandLogoProps) {
  const { t, locale } = useLocale();
  const { storefront } = useStoreSettings();
  const [whiteAssetError, setWhiteAssetError] = useState(false);
  const [blackSvgLoaded, setBlackSvgLoaded] = useState(true);

  const storeName = locale === 'ar' ? storefront.storeName_ar : storefront.storeName_en;

  if (variant === 'white') {
    const whiteSrc = storefront.whiteLogoUrl || DEFAULT_WHITE_LOGO;
    if (whiteAssetError) {
      return (
        <span
          dir="ltr"
          className={`inline-flex items-center justify-center border border-white/35 bg-white/5 px-3 py-1.5 text-[10px] font-mono-code tracking-[0.14em] uppercase text-white whitespace-nowrap select-none ${className}`.trim()}
          aria-label={t.brand.logoMissing}
        >
          LOGO ASSET REQUIRED
        </span>
      );
    }

    return (
      <span dir="ltr" className={`inline-flex items-center shrink-0 ${className}`.trim()}>
        <img
          src={whiteSrc}
          alt={storeName || 'FAVMO'}
          className="h-11 w-11 object-contain mix-blend-screen select-none"
          draggable={false}
          onError={() => setWhiteAssetError(true)}
        />
      </span>
    );
  }

  const blackSrc = storefront.blackLogoUrl || '/brand/logo-black.svg';
  if (!blackSvgLoaded && !storefront.blackLogoUrl) {
    return (
      <span
        dir="ltr"
        className={`inline-flex items-center justify-center border border-black/25 bg-black/5 px-3 py-1.5 text-[10px] font-mono-code tracking-[0.14em] uppercase text-black whitespace-nowrap select-none ${className}`.trim()}
        aria-label={t.brand.logoMissing}
      >
        LOGO ASSET REQUIRED
      </span>
    );
  }

  return (
    <span dir="ltr" className={`inline-flex items-center shrink-0 ${className}`.trim()}>
      <img
        src={blackSrc}
        alt={storeName || 'FAVMO'}
        className="h-10 w-auto object-contain select-none"
        draggable={false}
        onError={() => setBlackSvgLoaded(false)}
      />
    </span>
  );
}
