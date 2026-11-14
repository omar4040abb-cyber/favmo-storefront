import { useEffect, useState } from 'react';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSettings } from '../../contexts/StoreSettingsContext';
import { saveStorefrontSettingsAdmin } from '../../lib/storeService';

export function AdminContactSocialPanel() {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const { storefront, refreshStorefront } = useStoreSettings();

  const [whatsappNumber, setWhatsappNumber] = useState(storefront.whatsappNumber || '');
  const [contactPhone, setContactPhone] = useState(storefront.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(storefront.contactEmail || '');
  const [addressAr, setAddressAr] = useState(storefront.address_ar || '');
  const [addressEn, setAddressEn] = useState(storefront.address_en || '');
  const [instagramUrl, setInstagramUrl] = useState(storefront.instagramUrl || '');
  const [tiktokUrl, setTiktokUrl] = useState(storefront.tiktokUrl || '');
  const [facebookUrl, setFacebookUrl] = useState(storefront.facebookUrl || '');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setWhatsappNumber(storefront.whatsappNumber || '');
    setContactPhone(storefront.contactPhone || '');
    setContactEmail(storefront.contactEmail || '');
    setAddressAr(storefront.address_ar || '');
    setAddressEn(storefront.address_en || '');
    setInstagramUrl(storefront.instagramUrl || '');
    setTiktokUrl(storefront.tiktokUrl || '');
    setFacebookUrl(storefront.facebookUrl || '');
  }, [storefront]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedNotice(false);
    setSaveError('');
    try {
      await saveStorefrontSettingsAdmin(
        {
          ...storefront,
          whatsappNumber: whatsappNumber.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          address_ar: addressAr.trim(),
          address_en: addressEn.trim(),
          instagramUrl: instagramUrl.trim(),
          tiktokUrl: tiktokUrl.trim(),
          facebookUrl: facebookUrl.trim(),
        },
        user.uid
      );
      await refreshStorefront();
      setSavedNotice(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'STOREFRONT_SAVE_FAILED';
      setSaveError(
        locale === 'ar'
          ? code === 'ADMIN_PERMISSION_REQUIRED'
            ? 'حسابك لا يملك صلاحية تعديل بيانات التواصل. اطلب من المالك صلاحية محتوى الموقع أو الإعدادات.'
            : code === 'FIREBASE_ADMIN_UNAVAILABLE'
              ? 'تعذر الاتصال بخدمة الإدارة في Firebase. راجع إعدادات الخادم المحلي.'
              : 'لم يتم حفظ البيانات. تحقق من اتصال الخادم وFirebase ثم حاول مرة أخرى.'
          : code === 'ADMIN_PERMISSION_REQUIRED'
            ? 'Your account does not have permission to edit contact settings.'
            : 'The settings could not be saved. Check the server and Firebase connection, then try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-black focus:border-black focus:outline-none';

  return (
    <form
      onSubmit={handleSave}
      className="border border-neutral-200 bg-white p-6 space-y-6 max-w-3xl"
    >
      <div className="border-b border-neutral-200 pb-3 space-y-1">
        <h2 className="text-sm font-semibold text-black">{t.admin.tabs.social}</h2>
        <p className="text-xs text-neutral-500">
          {locale === 'ar'
            ? 'تظهر هذه البيانات تلقائياً في صفحة التواصل والفوتر وزر الاستفسار عبر واتساب في صفحات المنتجات.'
            : 'Configured channels appear automatically in the Contact page, Footer, and Product WhatsApp Inquiry buttons.'}
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-black">
            {locale === 'ar' ? 'قنوات التواصل المباشر' : 'Direct contact'}
          </h3>
          <p className="mt-1 text-[11px] text-neutral-500">
            {locale === 'ar' ? 'الهاتف والبريد وواتساب لخدمة العملاء.' : 'Phone, email, and WhatsApp for customer support.'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">
            {locale === 'ar'
              ? 'رقم واتساب (بصيغة دولية مثل 2010...)'
              : 'WhatsApp Number (International)'}
          </label>
          <input
            type="tel"
            dir="ltr"
            placeholder="+2010..."
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">{t.checkout.phone}</label>
          <input
            type="tel"
            dir="ltr"
            placeholder="+20..."
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">{t.checkout.email}</label>
          <input
            type="email"
            dir="ltr"
            placeholder="care@favmo.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-5">
        <div>
          <h3 className="text-xs font-semibold text-black">
            {locale === 'ar' ? 'حسابات التواصل الاجتماعي' : 'Social media accounts'}
          </h3>
          <p className="mt-1 text-[11px] text-neutral-500">
            {locale === 'ar' ? 'ضع الرابط الكامل للحساب؛ ستظهر الروابط للعملاء في صفحة التواصل والفوتر.' : 'Enter each full profile URL. Links appear to customers on Contact and in the footer.'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">Instagram URL</label>
          <input
            type="url"
            dir="ltr"
            placeholder="https://instagram.com/..."
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">TikTok URL</label>
          <input
            type="url"
            dir="ltr"
            placeholder="https://tiktok.com/@..."
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">Facebook URL</label>
          <input
            type="url"
            dir="ltr"
            placeholder="https://facebook.com/..."
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            className={inputCls}
          />
        </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-neutral-200 pt-5">
        <div>
          <h3 className="text-xs font-semibold text-black">
            {locale === 'ar' ? 'عنوان المتجر' : 'Store address'}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">
            {locale === 'ar' ? 'العنوان (عربي)' : 'Store Address (AR)'}
          </label>
          <input
            type="text"
            value={addressAr}
            onChange={(e) => setAddressAr(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-neutral-600 font-medium">Store Address (EN)</label>
          <input
            type="text"
            dir="ltr"
            value={addressEn}
            onChange={(e) => setAddressEn(e.target.value)}
            className={inputCls}
          />
        </div>
        </div>
      </section>

      {savedNotice && (
        <p className="border border-emerald-700/30 bg-emerald-50 text-emerald-900 p-3 text-xs font-semibold">
          {t.account.saved}
        </p>
      )}
      {saveError && (
        <p role="alert" className="border border-red-700/30 bg-red-50 text-red-900 p-3 text-xs font-semibold">
          {saveError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-black text-white px-8 py-3 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
      >
        {saving ? t.admin.actions.saving : t.admin.actions.save}
      </button>
    </form>
  );
}
