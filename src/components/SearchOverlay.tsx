import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';

export function SearchOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { locale, t, localePath } = useLocale();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    onClose();
    if (trimmed) {
      navigate(`${localePath('/shop')}?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(localePath('/shop'));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.nav.search}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-start justify-center"
      onClick={onClose}
    >
      <div
        className="w-full bg-black text-white border-b border-neutral-800 px-5 sm:px-8 lg:px-12 py-8"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-[1000px] flex items-center gap-4 border-b border-neutral-700 pb-4"
        >
          <span dir="ltr" className="inline-flex text-neutral-400">
            <Search className="w-5 h-5" strokeWidth={1.6} />
          </span>
          <input
            ref={inputRef}
            type="search"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locale === 'ar' ? 'ابحث في منتجات FAVMO...' : 'Search FAVMO products...'
            }
            className="flex-1 bg-transparent text-white placeholder:text-neutral-500 text-lg sm:text-xl focus:outline-none"
          />
          <button
            type="submit"
            className="bg-white text-black px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            {t.nav.search}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-10 h-10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label={t.nav.close}
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </form>
      </div>
    </div>
  );
}
