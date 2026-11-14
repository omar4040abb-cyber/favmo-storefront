import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallAppButton() {
  const { locale } = useLocale();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const isArabic = locale === 'ar';

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowIOSHelp(false);
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isInstalled || (!installPrompt && !isIOS)) return null;

  const install = async () => {
    if (!installPrompt) {
      setShowIOSHelp((visible) => !visible);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 border border-neutral-700 px-3 py-2 text-xs text-neutral-200 transition-colors hover:border-white hover:text-white"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {isArabic ? 'ثبّت تطبيق FAVMO' : 'Install FAVMO'}
      </button>
      {showIOSHelp && (
        <div className="flex max-w-sm items-start justify-between gap-3 border border-neutral-700 p-3 text-xs leading-6 text-neutral-300" role="status">
          <p>
            {isArabic
              ? 'في Safari، اضغط زر المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية». '
              : 'In Safari, tap Share, then choose “Add to Home Screen”.'}
          </p>
          <button
            type="button"
            onClick={() => setShowIOSHelp(false)}
            aria-label={isArabic ? 'إغلاق' : 'Close'}
            className="shrink-0 text-neutral-400 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
