import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'favmo-install-prompt-dismissed';

export function InstallAppButton() {
  const { locale } = useLocale();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallSheet, setShowInstallSheet] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const isArabic = locale === 'ar';

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const mobile = ios || /android|mobile/i.test(userAgent) ||
      window.matchMedia('(max-width: 767px) and (pointer: coarse)').matches;
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsIOS(ios);
    setIsMobile(mobile);
    setIsInstalled(standalone);

    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // The install prompt still works when storage is unavailable.
    }
    if (mobile && !standalone && !wasDismissed) setShowInstallSheet(true);

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstallSheet(false);
      setShowManualSteps(false);
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isInstalled || !isMobile) return null;

  const dismiss = () => {
    setShowInstallSheet(false);
    setShowManualSteps(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Dismiss for this visit if storage is unavailable.
    }
  };

  const install = async () => {
    if (!installPrompt) {
      setShowManualSteps(true);
      setShowInstallSheet(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setShowInstallSheet(false);
    } else {
      setShowInstallSheet(false);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        // The browser's native prompt was dismissed for this visit.
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowManualSteps(false);
          setShowInstallSheet(true);
        }}
        className="inline-flex min-h-11 items-center gap-2 border border-neutral-700 px-3 py-2 text-xs text-neutral-200 transition-colors hover:border-white hover:text-white"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {isArabic ? 'ثبّت تطبيق FAVMO' : 'Install FAVMO'}
      </button>

      {showInstallSheet && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 sm:p-6" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="favmo-install-title"
            dir={isArabic ? 'rtl' : 'ltr'}
            className="w-full max-w-md rounded-2xl border border-neutral-700 bg-[#090909] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-neutral-400">FAVMO</p>
                <h2 id="favmo-install-title" className="text-xl font-semibold">
                  {isArabic ? 'تثبيت FAVMO على هاتفك' : 'Install FAVMO on your phone'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {isArabic
                    ? 'أضف المتجر إلى الشاشة الرئيسية وافتحه كتطبيق ويب بسهولة.'
                    : 'Add the store to your home screen and open it like a web app.'}
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label={isArabic ? 'إغلاق' : 'Close'}
                className="shrink-0 rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {showManualSteps && (
                <div className="mt-5 rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm leading-7 text-neutral-200" role="status">
                {isIOS ? (
                  <p className="flex items-start gap-2">
                    <Share className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{isArabic
                      ? 'في Safari: اضغط «مشاركة»، ثم «إضافة إلى الشاشة الرئيسية»، وبعدها «إضافة».'
                      : 'In Safari: tap Share, then “Add to Home Screen”, and tap “Add”.'}</span>
                  </p>
                ) : (
                  <p>{isArabic
                    ? 'افتح قائمة المتصفح ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'
                    : 'Open your browser menu ⋮ and choose “Install app” or “Add to Home screen”.'}</p>
                )}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {isArabic ? 'تثبيت التطبيق' : 'Install app'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="min-h-12 rounded-lg border border-neutral-700 px-4 py-3 text-sm text-neutral-200 transition-colors hover:border-white"
              >
                {isArabic ? 'ليس الآن' : 'Not now'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
