import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { uploadAdminImage } from '../../lib/storeService';
import type { CmsPage, CmsPageSlug } from '../../types/domain';

const pages: Array<{ slug: CmsPageSlug; ar: string; en: string }> = [
  { slug: 'home', ar: 'الواجهة الرئيسية', en: 'Home page' },
  { slug: 'about', ar: 'من نحن', en: 'About FAVMO' },
  { slug: 'shipping-returns', ar: 'الشحن والاسترجاع', en: 'Shipping & returns' },
  { slug: 'privacy', ar: 'سياسة الخصوصية', en: 'Privacy policy' },
  { slug: 'terms', ar: 'الشروط والأحكام', en: 'Terms & conditions' },
  { slug: 'size-guide', ar: 'دليل المقاسات', en: 'Size guide' },
];

const emptyPage = (slug: CmsPageSlug): CmsPage => ({
  slug,
  title_ar: '', title_en: '', body_ar: '', body_en: '',
  heroMediaType: 'image', heroMediaUrl: '', campaignImageUrl: '',
  campaignTitle_ar: '', campaignTitle_en: '', campaignBody_ar: '', campaignBody_en: '',
  campaignCta_ar: '', campaignCta_en: '',
});

export function AdminContentPanel() {
  const { locale } = useLocale();
  const { getIdToken, user } = useAuth();
  const [slug, setSlug] = useState<CmsPageSlug>('home');
  const [page, setPage] = useState<CmsPage>(emptyPage('home'));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'heroMediaUrl' | 'campaignImageUrl' | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotice('');
    setError('');
    fetch(`/api/cms/${slug}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('تعذر تحميل الصفحة. حاول مجددًا.');
        return response.json();
      })
      .then((data) => {
        if (active) setPage({ ...emptyPage(slug), ...(data.page || {}), slug });
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'تعذر تحميل الصفحة.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const update = (key: keyof CmsPage, value: string) => setPage((old) => ({ ...old, [key]: value }));

  const upload = async (key: 'heroMediaUrl' | 'campaignImageUrl', file?: File) => {
    if (!file) return;
    setUploading(key);
    setError('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('يرجى تسجيل الدخول مجددًا.');
      const url = await uploadAdminImage(file, token, 'banner');
      update(key, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    } finally {
      setUploading(null);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const token = await getIdToken();
      const response = await fetch(`/api/admin/pages/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(page),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ المحتوى.');
      setNotice(locale === 'ar' ? 'تم حفظ المحتوى. سيظهر على الموقع مباشرة.' : 'Content saved and published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ المحتوى.');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof CmsPage, label: string, english = false, multiline = false) => (
    <label className="block space-y-1.5 text-xs">
      <span className="font-medium text-neutral-600">{label}</span>
      {multiline ? (
        <textarea rows={key === 'body_ar' || key === 'body_en' ? 9 : 3} value={String(page[key] || '')} dir={english ? 'ltr' : 'rtl'} onChange={(e) => update(key, e.target.value)} className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black" />
      ) : (
        <input value={String(page[key] || '')} dir={english ? 'ltr' : 'rtl'} onChange={(e) => update(key, e.target.value)} className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black" />
      )}
    </label>
  );

  const imageField = (key: 'heroMediaUrl' | 'campaignImageUrl', label: string) => (
    <div className="space-y-3 border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-semibold">{label}</p>
      {page[key] && <img src={page[key]} alt={label} className="h-40 w-full object-cover bg-black" />}
      <input value={page[key] || ''} dir="ltr" onChange={(e) => update(key, e.target.value)} placeholder="https://…" className="w-full border border-neutral-300 bg-white px-3 py-2 text-xs text-black" />
      <label className="inline-flex cursor-pointer items-center gap-2 border border-neutral-300 bg-white px-3 py-2 text-xs hover:border-black">
        <Upload className="h-3.5 w-3.5" />
        {uploading === key ? (locale === 'ar' ? 'جارٍ الرفع…' : 'Uploading…') : (locale === 'ar' ? 'رفع صورة' : 'Upload image')}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={(e) => { void upload(key, e.target.files?.[0]); e.currentTarget.value = ''; }} className="sr-only" />
      </label>
    </div>
  );

  return (
    <form onSubmit={save} className="max-w-5xl space-y-6">
      <div className="border border-neutral-200 bg-white p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold">{locale === 'ar' ? 'محتوى صفحات الموقع' : 'Website page content'}</h2>
        <p className="text-xs leading-6 text-neutral-500">{locale === 'ar' ? 'عدّل النصوص باللغتين والصور. استخدم أسطرًا جديدة للفصل بين الفقرات.' : 'Edit Arabic and English copy and page images. Use new lines to separate paragraphs.'}</p>
        <select value={slug} onChange={(e) => setSlug(e.target.value as CmsPageSlug)} className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black sm:max-w-sm">
          {pages.map((item) => <option key={item.slug} value={item.slug}>{locale === 'ar' ? item.ar : item.en}</option>)}
        </select>
      </div>

      {loading ? <p className="text-sm text-neutral-500">{locale === 'ar' ? 'جارٍ تحميل المحتوى…' : 'Loading content…'}</p> : (
        <>
          {slug === 'home' && <div className="border border-neutral-200 bg-white p-5 sm:p-6 space-y-5"><h3 className="text-xs font-semibold uppercase tracking-wider">{locale === 'ar' ? 'واجهة الصفحة الرئيسية' : 'Home hero'}</h3><div className="grid gap-4 sm:grid-cols-2">{field('title_ar', 'العنوان الرئيسي (عربي)')}{field('title_en', 'Main headline (English)', true)}{field('body_ar', 'الوصف (عربي)', false, true)}{field('body_en', 'Description (English)', true, true)}</div><div className="grid gap-4 md:grid-cols-2">{imageField('heroMediaUrl', locale === 'ar' ? 'صورة الواجهة الرئيسية' : 'Hero image')}{imageField('campaignImageUrl', locale === 'ar' ? 'صورة الحملة' : 'Campaign image')}</div><h3 className="text-xs font-semibold uppercase tracking-wider">{locale === 'ar' ? 'قسم الحملة' : 'Campaign section'}</h3><div className="grid gap-4 sm:grid-cols-2">{field('campaignTitle_ar', 'عنوان الحملة (عربي)')}{field('campaignTitle_en', 'Campaign title (English)', true)}{field('campaignBody_ar', 'وصف الحملة (عربي)', false, true)}{field('campaignBody_en', 'Campaign description (English)', true, true)}{field('campaignCta_ar', 'نص الزر (عربي)')}{field('campaignCta_en', 'Button label (English)', true)}</div></div>}
          {slug !== 'home' && <div className="border border-neutral-200 bg-white p-5 sm:p-6 space-y-5"><h3 className="text-xs font-semibold uppercase tracking-wider">{locale === 'ar' ? 'محتوى الصفحة' : 'Page content'}</h3><div className="grid gap-4 sm:grid-cols-2">{field('title_ar', 'العنوان (عربي)')}{field('title_en', 'Title (English)', true)}</div><div className="grid gap-4 sm:grid-cols-2">{field('body_ar', 'النص (عربي)', false, true)}{field('body_en', 'Body (English)', true, true)}</div>{imageField('heroMediaUrl', locale === 'ar' ? 'صورة الصفحة' : 'Page image')}</div>}
        </>
      )}

      {error && <p role="alert" className="border border-red-700 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="border border-emerald-700/30 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <button type="submit" disabled={loading || saving || Boolean(uploading)} className="bg-black px-8 py-3 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">{saving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : (locale === 'ar' ? 'حفظ ونشر المحتوى' : 'Save and publish')}</button>
    </form>
  );
}
