import { useState } from 'react';
import { BriefcaseBusiness, Send } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';

export function CareersPage() {
  const { locale, localePath } = useLocale();
  const isAr = locale === 'ar';
  const [form, setForm] = useState({ displayName: '', email: '', phone: '', desiredRole: 'employee', experience: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/staff/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 409) throw new Error('APPLICATION_EXISTS');
        if (response.status === 429) throw new Error('RATE_LIMITED');
        throw new Error(result.error || 'SUBMISSION_FAILED');
      }
      setMessage(isAr ? 'وصل طلبك بنجاح، وسيظهر للمالك لمراجعته.' : 'Your application was submitted for the owner to review.');
      setForm({ displayName: '', email: '', phone: '', desiredRole: 'employee', experience: '' });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      setError(code === 'APPLICATION_EXISTS'
        ? isAr ? 'يوجد طلب سابق بهذا البريد. لا تحتاج لإرساله مرة أخرى.' : 'An application with this email already exists.'
        : code === 'RATE_LIMITED'
          ? isAr ? 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.' : 'Too many attempts. Please wait and try again.'
          : isAr ? 'تعذّر إرسال الطلب. حاول مرة أخرى لاحقًا.' : 'Could not submit the application. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-white focus:outline-none';

  return (
    <section className="min-h-[70vh] bg-black px-5 py-16 text-white sm:px-8 lg:px-12" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 space-y-4">
          <BriefcaseBusiness className="h-8 w-8 text-neutral-300" strokeWidth={1.4} />
          <p className="text-[10px] tracking-[0.2em] text-neutral-500">FAVMO / CAREERS</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">{isAr ? 'انضم إلى فريق FAVMO' : 'Join the FAVMO team'}</h1>
          <p className="text-sm leading-7 text-neutral-400">
            {isAr ? 'أرسل بياناتك، وسيصل طلبك إلى لوحة المالك للمراجعة. لا تُمنح أي صلاحيات دخول قبل الموافقة.' : 'Send your details for the owner to review. No access permissions are granted before approval.'}
          </p>
        </div>

        <form onSubmit={submitApplication} className="space-y-5">
          <label className="block space-y-2 text-xs text-neutral-300">
            <span>{isAr ? 'الاسم الكامل' : 'Full name'}</span>
            <input className={inputClass} required minLength={2} maxLength={100} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </label>
          <label className="block space-y-2 text-xs text-neutral-300">
            <span>{isAr ? 'البريد الإلكتروني' : 'Email address'}</span>
            <input className={inputClass} type="email" required maxLength={254} dir="ltr" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2 text-xs text-neutral-300">
              <span>{isAr ? 'رقم الهاتف' : 'Phone number'}</span>
              <input className={inputClass} type="tel" required minLength={7} maxLength={32} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="block space-y-2 text-xs text-neutral-300">
              <span>{isAr ? 'نوع الطلب' : 'Application type'}</span>
              <select className={inputClass} value={form.desiredRole} onChange={(e) => setForm({ ...form, desiredRole: e.target.value })}>
                <option value="employee">{isAr ? 'موظف' : 'Employee'}</option>
                <option value="manager">{isAr ? 'مسؤول' : 'Manager'}</option>
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-xs text-neutral-300">
            <span>{isAr ? 'الخبرة أو رسالة التعريف' : 'Experience or cover note'}</span>
            <textarea className={`${inputClass} min-h-32 resize-y`} required minLength={10} maxLength={2000} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
          </label>

          {error && <p role="alert" className="border border-red-900 bg-red-950/40 p-3 text-xs text-red-300">{error}</p>}
          {message && <p role="status" className="border border-emerald-900 bg-emerald-950/40 p-3 text-xs text-emerald-300">{message}</p>}

          <button type="submit" disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-white px-5 text-xs font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-50">
            <Send className="h-4 w-4" />
            {submitting ? (isAr ? 'جارٍ الإرسال...' : 'Submitting...') : (isAr ? 'إرسال طلب الانضمام' : 'Submit application')}
          </button>
          <p className="text-center text-[11px] text-neutral-500">
            {isAr ? 'لديك حساب عميل بالفعل؟ ' : 'Already have a customer account? '}
            <a href={localePath('/account')} className="underline hover:text-white">{isAr ? 'تسجيل الدخول' : 'Sign in'}</a>
          </p>
        </form>
      </div>
    </section>
  );
}
