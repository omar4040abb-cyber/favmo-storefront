import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category?: string;
  locale?: 'ar' | 'en';
  status: 'new' | 'read' | 'resolved';
  createdAt?: { _seconds?: number } | string;
}

const categoryLabel = (category: string | undefined, locale: string) => {
  const ar: Record<string, string> = { general: 'استفسار عام', product_issue: 'مشكلة منتج', website_issue: 'مشكلة بالموقع', order_request: 'طلب أو استفسار طلب', suggestion: 'اقتراح أو ملاحظة' };
  const en: Record<string, string> = { general: 'General question', product_issue: 'Product issue', website_issue: 'Website issue', order_request: 'Order question', suggestion: 'Suggestion' };
  return (locale === 'ar' ? ar : en)[category || 'general'] || category || '';
};

export function AdminContactMessagesPanel() {
  const { locale } = useLocale();
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/contact-messages', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load messages');
      setMessages(data.messages || []);
    } catch {
      setError(locale === 'ar' ? 'تعذر تحميل رسائل العملاء.' : 'Could not load customer messages.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, locale]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (message: ContactMessage, status: ContactMessage['status']) => {
    const token = await getIdToken();
    const response = await fetch(`/api/admin/contact-messages/${message.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error('MESSAGE_UPDATE_FAILED');
    await load();
  };

  const dateLabel = (value: ContactMessage['createdAt']) => {
    const seconds = typeof value === 'object' && value ? value._seconds : undefined;
    const date = typeof value === 'string' ? new Date(value) : seconds ? new Date(seconds * 1000) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en') : '';
  };

  return <section className="space-y-4">
    <div className="flex items-center justify-between border border-neutral-200 bg-white p-5">
      <div><h2 className="text-sm font-semibold">{locale === 'ar' ? 'رسائل وبلاغات العملاء' : 'Customer messages & reports'}</h2><p className="mt-1 text-xs text-neutral-500">{locale === 'ar' ? 'الاستفسارات والمشكلات والاقتراحات المرسلة من صفحة التواصل.' : 'Questions, issue reports and suggestions sent from Contact.'}</p></div>
      <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 border border-neutral-300 px-3 py-2 text-xs hover:border-black"><RefreshCw className="h-3.5 w-3.5" />{locale === 'ar' ? 'تحديث' : 'Refresh'}</button>
    </div>
    {error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p className="p-6 text-sm text-neutral-500">{locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</p> : messages.length === 0 ? <p className="border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">{locale === 'ar' ? 'لا توجد رسائل حتى الآن.' : 'No messages yet.'}</p> : <div className="space-y-3">{messages.map((message) => <article key={message.id} className="border border-neutral-200 bg-white p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="inline-block bg-neutral-100 px-2 py-1 text-[11px] text-neutral-700">{categoryLabel(message.category, locale)}</span><h3 className="mt-2 text-sm font-semibold">{message.subject}</h3><p className="mt-1 text-xs text-neutral-500">{message.name} · <a href={`mailto:${message.email}`} dir="ltr" className="underline">{message.email}</a>{message.phone ? ` · ${message.phone}` : ''}</p></div><div className="text-end"><span className="text-[11px] text-neutral-500">{dateLabel(message.createdAt)}</span><p className="mt-1 text-[11px] font-medium">{message.status === 'resolved' ? (locale === 'ar' ? 'تمت المعالجة' : 'Resolved') : message.status === 'read' ? (locale === 'ar' ? 'مقروءة' : 'Read') : (locale === 'ar' ? 'جديدة' : 'New')}</p></div></div>
      <p dir="auto" className="whitespace-pre-wrap border-t border-neutral-100 pt-4 text-sm leading-7 text-neutral-800">{message.message}</p>
      <div className="flex flex-wrap gap-2"><a href={`mailto:${message.email}?subject=${encodeURIComponent(locale === 'ar' ? `رد بخصوص: ${message.subject}` : `Re: ${message.subject}`)}`} className="inline-flex items-center gap-2 bg-black px-4 py-2 text-xs text-white"><Mail className="h-3.5 w-3.5" />{locale === 'ar' ? 'الرد عبر البريد' : 'Reply by email'}</a>{message.status !== 'resolved' && <button type="button" onClick={() => void setStatus(message, 'resolved')} className="border border-neutral-300 px-4 py-2 text-xs hover:border-black">{locale === 'ar' ? 'إغلاق البلاغ' : 'Mark resolved'}</button>}</div>
    </article>)}</div>}
  </section>;
}
