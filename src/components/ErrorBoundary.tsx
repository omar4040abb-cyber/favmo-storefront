import React from 'react';
import { MESSAGES } from '../i18n/messages';
import { getStoredLocaleCookie } from '../contexts/LocaleContext';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled UI Error:', error);
  }

  render() {
    if (this.state.hasError) {
      const locale = getStoredLocaleCookie() || 'en';
      const t = MESSAGES[locale];
      return (
        <div
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-24"
        >
          <div className="max-w-lg w-full border border-neutral-800 p-10 text-center space-y-6">
            <p className="font-mono-code text-xs tracking-[0.2em] text-neutral-400">
              {t.errors.serverErrorCode}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{t.errors.serverErrorTitle}</h1>
            <p className="text-sm text-neutral-400">{t.errors.serverErrorBody}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center bg-white text-black px-8 py-3 text-xs font-semibold tracking-[0.14em] hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              {t.errors.retry}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
