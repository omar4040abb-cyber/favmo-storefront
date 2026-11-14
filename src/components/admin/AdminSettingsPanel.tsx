import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreSettings } from '../../contexts/StoreSettingsContext';
import { EGYPT_GOVERNORATES } from '../../lib/egyptGovernorates';
import {
  deleteShippingZoneAdmin,
  savePaymentSettingsAdmin,
  saveShippingZoneAdmin,
  saveStorefrontSettingsAdmin,
  uploadAdminImage,
} from '../../lib/storeService';
import type { ShippingZone } from '../../types/domain';

interface AdminSettingsPanelProps {
  shippingZones: ShippingZone[];
  onRefresh: () => Promise<void>;
}

export function AdminSettingsPanel({ shippingZones, onRefresh }: AdminSettingsPanelProps) {
  const { locale, t } = useLocale();
  const { user, getIdToken } = useAuth();
  const { storefront, payment, refreshStorefront } = useStoreSettings();

  const [formStore, setFormStore] = useState(storefront);
  const [formPay, setFormPay] = useState(payment);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [paymobServerStatus, setPaymobServerStatus] = useState<boolean>(false);

  // Shipping zone creator
  const [zoneNameAr, setZoneNameAr] = useState('');
  const [zoneNameEn, setZoneNameEn] = useState('');
  const [zoneFeeEgp, setZoneFeeEgp] = useState('75');
  const [zoneCodFeeEgp, setZoneCodFeeEgp] = useState('0');
  const [zoneFreeThresholdEgp, setZoneFreeThresholdEgp] = useState('');
  const [zoneGovs, setZoneGovs] = useState<string[]>(['CAIRO', 'GIZA']);

  useEffect(() => {
    setFormStore(storefront);
  }, [storefront]);

  useEffect(() => {
    setFormPay(payment);
  }, [payment]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setPaymobServerStatus(Boolean(d.paymobConfigured)))
      .catch(() => {});
  }, []);

  const handleUploadAsset = async (
    field:
      | 'whiteLogoUrl'
      | 'blackLogoUrl'
      | 'heroImageUrl'
      | 'campaignImageUrl'
      | 'editorialImageUrl',
    purpose: 'logo' | 'banner',
    file?: File
  ) => {
    if (!file) return;
    setUploadingField(field);
    try {
      const token = await getIdToken();
      if (!token) return;
      const url = await uploadAdminImage(file, token, purpose);
      setFormStore((prev) => ({ ...prev, [field]: url }));
    } finally {
      setUploadingField(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedNotice(false);
    try {
      await Promise.all([
        saveStorefrontSettingsAdmin(formStore, user.uid),
        savePaymentSettingsAdmin(formPay, user.uid),
      ]);
      await refreshStorefront();
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneNameAr.trim() || !zoneNameEn.trim() || zoneGovs.length === 0) return;
    await saveShippingZoneAdmin(null, {
      name_ar: zoneNameAr.trim(),
      name_en: zoneNameEn.trim(),
      governorateCodes: zoneGovs,
      feePiasters: Math.round((Number(zoneFeeEgp) || 0) * 100),
      codFeePiasters: Math.round((Number(zoneCodFeeEgp) || 0) * 100),
      freeShippingThresholdPiasters:
        zoneFreeThresholdEgp.trim() && Number(zoneFreeThresholdEgp) > 0
          ? Math.round(Number(zoneFreeThresholdEgp) * 100)
          : null,
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
      active: true,
    });
    setZoneNameAr('');
    setZoneNameEn('');
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Store Name, Description & Currency */}
        <div className="border border-neutral-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
            {locale === 'ar' ? 'اسم المتجر والوصف والعملة' : 'Store Name, Description & Currency'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-neutral-600 font-medium">Store Name (AR)</label>
              <input
                type="text"
                value={formStore.storeName_ar || ''}
                onChange={(e) => setFormStore((s) => ({ ...s, storeName_ar: e.target.value }))}
                className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-neutral-600 font-medium">Store Name (EN)</label>
              <input
                type="text"
                dir="ltr"
                value={formStore.storeName_en || ''}
                onChange={(e) => setFormStore((s) => ({ ...s, storeName_en: e.target.value }))}
                className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-neutral-600 font-medium">
                {locale === 'ar' ? 'العملة الأساسية' : 'Store Currency'}
              </label>
              <input
                type="text"
                disabled
                dir="ltr"
                value={formStore.currency || 'EGP'}
                className="w-full border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-mono-code text-neutral-600"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-neutral-600 font-medium">
                {locale === 'ar' ? 'وصف المتجر (عربي)' : 'Store Description (AR)'}
              </label>
              <textarea
                rows={2}
                value={formStore.storeDescription_ar || ''}
                onChange={(e) =>
                  setFormStore((s) => ({ ...s, storeDescription_ar: e.target.value }))
                }
                placeholder="FAVMO — علامة ملابس شارع أحادية اللون..."
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-black"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-neutral-600 font-medium">Store Description (EN)</label>
              <textarea
                rows={2}
                dir="ltr"
                value={formStore.storeDescription_en || ''}
                onChange={(e) =>
                  setFormStore((s) => ({ ...s, storeDescription_en: e.target.value }))
                }
                placeholder="FAVMO — Minimalist luxury monochrome streetwear house."
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-black"
              />
            </div>
          </div>
        </div>

        {/* Store Appearance & Brand Assets */}
        <div className="border border-neutral-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
            {locale === 'ar' ? 'المظهر والشعارات والبنرات' : 'Store Appearance, Logos & Banners'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {(
              [
                { key: 'whiteLogoUrl', label: 'White Logo (Dark Header)', purpose: 'logo' },
                { key: 'blackLogoUrl', label: 'Black Logo (Light Surfaces)', purpose: 'logo' },
                { key: 'heroImageUrl', label: 'Hero Banner Image', purpose: 'banner' },
                { key: 'editorialImageUrl', label: 'Editorial Image', purpose: 'banner' },
                { key: 'campaignImageUrl', label: 'Campaign Banner Image', purpose: 'banner' },
              ] as const
            ).map((slot) => (
              <div key={slot.key} className="border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                <p className="font-semibold text-black">{slot.label}</p>
                {formStore[slot.key] && (
                  <img
                    src={formStore[slot.key]}
                    alt={slot.label}
                    className={`h-24 w-full object-contain border border-neutral-200 ${
                      slot.key === 'whiteLogoUrl' ? 'bg-black' : 'bg-white'
                    }`}
                  />
                )}
                <label className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-2 hover:border-black cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {uploadingField === slot.key
                      ? t.admin.actions.uploading
                      : t.admin.actions.uploadImage}
                  </span>
                  <input
                    type="file"
                    accept={
                      slot.purpose === 'logo'
                        ? 'image/jpeg,image/png,image/webp,image/svg+xml'
                        : 'image/jpeg,image/png,image/webp'
                    }
                    onChange={(e) =>
                      handleUploadAsset(slot.key, slot.purpose, e.target.files?.[0])
                    }
                    className="sr-only"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="border border-neutral-200 bg-white p-6 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
            {t.checkout.paymentMethod}
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formPay.codEnabled}
                onChange={(e) => setFormPay((p) => ({ ...p, codEnabled: e.target.checked }))}
                className="accent-black"
              />
              <span>{t.checkout.cod}</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formPay.instapayEnabled}
                onChange={(e) => setFormPay((p) => ({ ...p, instapayEnabled: e.target.checked }))}
                className="accent-black"
              />
              <span>{t.checkout.instapay}</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formPay.paymobEnabled}
                onChange={(e) => setFormPay((p) => ({ ...p, paymobEnabled: e.target.checked }))}
                className="accent-black"
              />
              <span>{t.checkout.paymob}</span>
            </label>
            <select
              value={formPay.paymobMode || 'test'}
              onChange={(e) =>
                setFormPay((p) => ({ ...p, paymobMode: e.target.value as 'test' | 'live' }))
              }
              className="border border-neutral-300 bg-white px-3 py-1.5 text-xs text-black"
            >
              <option value="test">Paymob Mode: Test / Sandbox</option>
              <option value="live">Paymob Mode: Live / Production</option>
            </select>
            <span className="text-neutral-500">
              Paymob Server Credentials:{' '}
              {paymobServerStatus ? 'Configured' : 'Disabled (Credentials Missing)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <textarea
              rows={2}
              placeholder="تعليمات InstaPay (عربي)"
              value={formPay.instapayInstructions_ar || ''}
              onChange={(e) =>
                setFormPay((p) => ({ ...p, instapayInstructions_ar: e.target.value }))
              }
              className="border border-neutral-300 bg-white px-3 py-2 text-black"
            />
            <textarea
              rows={2}
              dir="ltr"
              placeholder="InstaPay Instructions (EN)"
              value={formPay.instapayInstructions_en || ''}
              onChange={(e) =>
                setFormPay((p) => ({ ...p, instapayInstructions_en: e.target.value }))
              }
              className="border border-neutral-300 bg-white px-3 py-2 text-black"
            />
          </div>
        </div>

        {savedNotice && (
          <p className="border border-emerald-700/30 bg-emerald-50 text-emerald-900 p-3 text-xs font-semibold">
            {t.account.saved}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-8 py-3 text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
        >
          {saving ? t.admin.actions.saving : t.admin.actions.save}
        </button>
      </form>

      {/* Shipping Zones */}
      <div className="border border-neutral-200 bg-white p-6 space-y-6">
        <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
          {locale === 'ar'
            ? 'مناطق وأسعار الشحن (27 محافظة)'
            : 'Shipping Zones & Fees (27 Governorates)'}
        </h2>

        <form onSubmit={handleAddZone} className="space-y-4 text-xs border-b border-neutral-200 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="اسم المنطقة (عربي)"
              value={zoneNameAr}
              onChange={(e) => setZoneNameAr(e.target.value)}
              className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
            />
            <input
              type="text"
              required
              dir="ltr"
              placeholder="Zone Name (EN)"
              value={zoneNameEn}
              onChange={(e) => setZoneNameEn(e.target.value)}
              className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
            />
            <input
              type="number"
              min="0"
              dir="ltr"
              placeholder="Shipping Fee (EGP)"
              value={zoneFeeEgp}
              onChange={(e) => setZoneFeeEgp(e.target.value)}
              className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
            />
            <input
              type="number"
              min="0"
              dir="ltr"
              placeholder="COD Fee (EGP)"
              value={zoneCodFeeEgp}
              onChange={(e) => setZoneCodFeeEgp(e.target.value)}
              className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
            />
            <input
              type="number"
              min="0"
              dir="ltr"
              placeholder="Free Shipping Min (EGP)"
              value={zoneFreeThresholdEgp}
              onChange={(e) => setZoneFreeThresholdEgp(e.target.value)}
              className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
            />
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-neutral-200 bg-neutral-50 p-3">
            {EGYPT_GOVERNORATES.map((g) => {
              const checked = zoneGovs.includes(g.code);
              return (
                <label
                  key={g.code}
                  className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setZoneGovs((prev) =>
                        e.target.checked ? [...prev, g.code] : prev.filter((x) => x !== g.code)
                      )
                    }
                    className="accent-black"
                  />
                  <span>{locale === 'ar' ? g.name_ar : g.name_en}</span>
                </label>
              );
            })}
          </div>
          <button
            type="submit"
            className="bg-black text-white px-5 py-2 font-semibold hover:bg-neutral-800 cursor-pointer"
          >
            {t.admin.actions.add}
          </button>
        </form>

        <div className="space-y-2 text-xs">
          {shippingZones.map((z) => (
            <div
              key={z.id}
              className="flex items-center justify-between border border-neutral-200 bg-neutral-50 p-3"
            >
              <div>
                <p className="font-semibold text-black">
                  {locale === 'ar' ? z.name_ar : z.name_en}
                </p>
                <p className="text-neutral-500 tabular-nums">
                  {z.governorateCodes.length} governorates · Fee: {(z.feePiasters || 0) / 100} EGP
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await deleteShippingZoneAdmin(z.id);
                  await onRefresh();
                }}
                className="text-neutral-500 hover:text-black underline cursor-pointer"
              >
                {t.admin.actions.delete}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
