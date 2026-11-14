import { Link } from 'react-router-dom';
import { useLocale } from '../contexts/LocaleContext';

export function NotFoundPage() {
  const { locale, t, localePath } = useLocale();

  return (
    <div className="min-h-[75vh] bg-black text-white flex items-center justify-center px-6 py-24">
      <div className="max-w-lg w-full border border-neutral-800 p-10 sm:p-14 text-center space-y-6">
        <p className="font-mono-code text-xs tracking-[0.2em] text-neutral-400">
          {t.errors.notFoundCode}
        </p>
        <h1
          className={`text-2xl sm:text-3xl font-semibold ${
            locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
          }`}
        >
          {t.errors.notFoundTitle}
        </h1>
        <p className="text-sm text-neutral-400">{t.errors.notFoundBody}</p>
        <Link
          to={localePath('/')}
          className="inline-flex items-center justify-center bg-white text-black px-8 py-3.5 text-xs font-semibold hover:bg-neutral-200 transition-colors"
        >
          {t.errors.backHome}
        </Link>
      </div>
    </div>
  );
}
