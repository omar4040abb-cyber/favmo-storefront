import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';

const PHONE_REGEX = /^(\+?[1-9]\d{6,14}|(\+20|0020|0)?1[0125]\d{8})$/;

export function ContactPage() {
  const { locale, t } = useLocale();
  const { storefront } = useStoreSettings();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().trim().min(1, t.contactForm.validation.nameRequired).max(120),
    email: z.string().trim().email(t.contactForm.validation.emailInvalid).max(254),
    category: z.enum(['general', 'product_issue', 'website_issue', 'order_request', 'suggestion']),
    phone: z
      .string()
      .trim()
      .max(32)
      .refine((v) => v === '' || PHONE_REGEX.test(v), t.contactForm.validation.phoneInvalid),
    subject: z.string().trim().min(1, t.contactForm.validation.subjectRequired).max(200),
    message: z.string().trim().min(10, t.contactForm.validation.messageRequired).max(4000),
  });

  type ContactValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      category: 'general',
      phone: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (values: ContactValues) => {
    setSubmitStatus('idle');
    setServerError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitStatus('error');
        setServerError(data.blocked ? data.error : t.contactForm.error);
        return;
      }
      setSubmitStatus('success');
      reset();
    } catch {
      setSubmitStatus('error');
      setServerError(t.contactForm.error);
    }
  };

  const waDigits = (storefront.whatsappNumber || '').replace(/\D/g, '');
  const addressText = locale === 'ar' ? storefront.address_ar : storefront.address_en;
  const hasDirectChannels = Boolean(
    storefront.contactEmail ||
      storefront.contactPhone ||
      waDigits ||
      addressText ||
      storefront.instagramUrl ||
      storefront.tiktokUrl ||
      storefront.facebookUrl
  );

  return (
    <div className="bg-white text-black">
      <section className="bg-black text-white py-20 lg:py-24 border-b border-neutral-800">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 space-y-4">
          <p
            className={`text-xs font-medium text-neutral-400 ${
              locale === 'en' ? 'tracking-[0.2em]' : ''
            }`}
          >
            FAVMO
          </p>
          <h1
            className={`text-3xl sm:text-5xl font-semibold ${
              locale === 'en' ? 'font-display-en tracking-[-0.02em]' : 'font-display-ar'
            }`}
          >
            {t.pages.contactTitle}
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-xl">
            {t.pages.contactSubtitle}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="lg:col-span-7 space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">
                {t.contactForm.name}
              </label>
              <input
                type="text"
                dir="auto"
                {...register('name')}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:border-black focus:outline-none"
              />
              {errors.name && (
                <p role="alert" className="text-xs text-black font-medium">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">
                {t.contactForm.email}
              </label>
              <input
                type="email"
                dir="ltr"
                {...register('email')}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:border-black focus:outline-none"
              />
              {errors.email && (
                <p role="alert" className="text-xs text-black font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-700">
              {locale === 'ar' ? 'نوع الرسالة' : 'Message type'}
            </label>
            <select {...register('category')} className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-black focus:border-black focus:outline-none">
              <option value="general">{locale === 'ar' ? 'استفسار عام' : 'General question'}</option>
              <option value="product_issue">{locale === 'ar' ? 'مشكلة في منتج' : 'Product issue'}</option>
              <option value="website_issue">{locale === 'ar' ? 'مشكلة في الموقع' : 'Website issue'}</option>
              <option value="order_request">{locale === 'ar' ? 'طلب أو استفسار عن طلب' : 'Order request or question'}</option>
              <option value="suggestion">{locale === 'ar' ? 'اقتراح أو ملاحظة' : 'Suggestion or feedback'}</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">
                {t.contactForm.phone}
              </label>
              <input
                type="tel"
                dir="ltr"
                {...register('phone')}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:border-black focus:outline-none"
              />
              {errors.phone && (
                <p role="alert" className="text-xs text-black font-medium">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">
                {t.contactForm.subject}
              </label>
              <input
                type="text"
                dir="auto"
                {...register('subject')}
                className="w-full border border-neutral-300 px-4 py-3 text-sm focus:border-black focus:outline-none"
              />
              {errors.subject && (
                <p role="alert" className="text-xs text-black font-medium">
                  {errors.subject.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-700">
              {t.contactForm.message}
            </label>
            <textarea
              rows={5}
              dir="auto"
              {...register('message')}
              className="w-full border border-neutral-300 px-4 py-3 text-sm focus:border-black focus:outline-none"
            />
            {errors.message && (
              <p role="alert" className="text-xs text-black font-medium">
                {errors.message.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-black text-white px-10 py-4 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSubmitting ? t.contactForm.sending : t.contactForm.submit}
          </button>

          {submitStatus === 'success' && (
            <p role="status" className="text-sm text-black font-medium border border-black p-4">
              {t.contactForm.success}
            </p>
          )}
          {submitStatus === 'error' && (
            <p role="alert" className="text-sm text-black font-medium border border-neutral-400 p-4">
              {serverError || t.contactForm.error}
            </p>
          )}
        </form>

        {hasDirectChannels && (
          <aside className="lg:col-span-5 border border-neutral-200 bg-neutral-50 p-8 space-y-6">
            <h2 className="text-sm font-semibold border-b border-neutral-200 pb-4">
              {t.admin.tabs.social}
            </h2>

            <div className="space-y-4 text-sm">
              {waDigits && (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 hover:underline"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span dir="ltr">WhatsApp: {storefront.whatsappNumber}</span>
                </a>
              )}

              {storefront.contactPhone && (
                <a
                  href={`tel:${storefront.contactPhone}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span dir="ltr">{storefront.contactPhone}</span>
                </a>
              )}

              {storefront.contactEmail && (
                <a
                  href={`mailto:${storefront.contactEmail}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span dir="ltr">{storefront.contactEmail}</span>
                </a>
              )}

              {addressText && (
                <div className="flex items-start gap-3 text-neutral-700">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{addressText}</span>
                </div>
              )}
            </div>

            {(storefront.instagramUrl || storefront.tiktokUrl || storefront.facebookUrl) && (
              <div className="pt-4 border-t border-neutral-200 flex flex-wrap gap-3 text-xs font-semibold">
                {storefront.instagramUrl && (
                  <a
                    href={storefront.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
                  >
                    Instagram
                  </a>
                )}
                {storefront.tiktokUrl && (
                  <a
                    href={storefront.tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
                  >
                    TikTok
                  </a>
                )}
                {storefront.facebookUrl && (
                  <a
                    href={storefront.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
                  >
                    Facebook
                  </a>
                )}
              </div>
            )}
          </aside>
        )}
      </section>
    </div>
  );
}
