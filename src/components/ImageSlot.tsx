import { useEffect, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext';

interface ImageSlotProps {
  mediaType?: 'placeholder' | 'image' | 'video';
  src?: string | null;
  poster?: string | null;
  alt: string;
  aspectClass?: string;
  darkSurface?: boolean;
  priority?: boolean;
  className?: string;
  slotLabel?: string;
}

export function ImageSlot({
  mediaType = 'image',
  src,
  poster,
  alt,
  aspectClass = 'aspect-[4/5]',
  darkSurface = false,
  priority = false,
  className = '',
  slotLabel,
}: ImageSlotProps) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const surfaceClasses = darkSurface
    ? 'bg-neutral-950 border-neutral-800 text-neutral-400'
    : 'bg-neutral-100 border-neutral-200 text-neutral-500';

  if (!src || mediaType === 'placeholder' || failed) {
    return (
      <div
        className={`relative w-full overflow-hidden border flex flex-col items-center justify-center text-center px-6 ${aspectClass} ${surfaceClasses} ${className}`.trim()}
        role="img"
        aria-label={alt}
      >
        <div
          aria-hidden="true"
          className={`w-10 h-px mb-3 ${darkSurface ? 'bg-neutral-700' : 'bg-neutral-300'}`}
        />
        <span
          dir="ltr"
          className="text-[11px] font-mono-code tracking-[0.18em] uppercase select-none"
        >
          {slotLabel || t.brand.imageSlot}
        </span>
        <div
          aria-hidden="true"
          className={`w-10 h-px mt-3 ${darkSurface ? 'bg-neutral-700' : 'bg-neutral-300'}`}
        />
      </div>
    );
  }

  if (mediaType === 'video') {
    if (prefersReducedMotion && poster) {
      return (
        <div className={`relative w-full overflow-hidden ${aspectClass} ${className}`.trim()}>
          <img
            src={poster}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        </div>
      );
    }

    return (
      <div className={`relative w-full overflow-hidden ${aspectClass} ${className}`.trim()}>
        <video
          src={src}
          poster={poster || undefined}
          autoPlay={!prefersReducedMotion}
          loop
          muted
          playsInline
          preload={priority ? 'auto' : 'metadata'}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          aria-label={alt}
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden ${aspectClass} ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      />
    </div>
  );
}
