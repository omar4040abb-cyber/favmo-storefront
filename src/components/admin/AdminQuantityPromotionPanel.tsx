import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import type { QuantityPromotion } from '../../types/domain';

export function AdminQuantityPromotionPanel() {
  const { locale } = useLocale();
  const { getIdToken } = useAuth();
  const [promotion, setPromotion] = useState<QuantityPromotion | null>(null);
  const [minItems, setMinItems] = useState('3');
  const [rewardType, setRewardType] = useState<QuantityPromotion['rewardType']>('percentage');
  const [value, setValue] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ar = locale === 'ar';

  const load = async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/quantity-promotion', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'PROMOTION_READ_FAILED');
      const current = data.promotion as QuantityPromotion | null;
      setPromotion(current?.active ? current : null);
      if (current) {
        setMinItems(String(current.minItems));
        setRewardType(current.rewardType);
        setValue(String(current.value));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PROMOTION_READ_FAILED');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await fetch('/api/admin/quantity-promotion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ minItems: Number(minItems), rewardType, value: rewardType === 'percentage' ? Number(value) : rewardType === 'fixed' ? Math.round(Number(value) * 100) : 0 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'PROMOTION_SAVE_FAILED');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PROMOTION_SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    setError('');
    try {
      const token = await getIdToken();
      const response = await fetch('/api/admin/quantity-promotion', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('PROMOTION_UPDATE_FAILED');
      setPromotion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PROMOTION_UPDATE_FAILED');
    }
  };

  return <section className="border border-neutral-200 bg-white p-5 sm:p-6 space-y-4">
    <div><h2 className="text-sm font-semibold">{ar ? 'عرض تلقائي حسب عدد القطع' : 'Automatic quantity offer'}</h2><p className="mt-1 text-xs leading-5 text-neutral-500">{ar ? 'يُطبق تلقائيًا في السلة عند وصول العميل للعدد المحدد؛ بدون إدخال كود خصم.' : 'Applied automatically in cart when the customer reaches the quantity. No coupon code needed.'}</p></div>
    {loading ? <p className="text-xs text-neutral-500">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> : <>
      {promotion && <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 p-3 text-xs"><span>{ar ? `العرض الحالي: ${promotion.minItems} قطع` : `Current offer: ${promotion.minItems} items`} · {promotion.rewardType === 'percentage' ? `${promotion.value}%` : promotion.rewardType === 'fixed' ? `${(promotion.value / 100).toFixed(2)} EGP` : promotion.rewardType === 'free_item' ? (ar ? 'قطعة مجانية' : 'One item free') : (ar ? 'شحن مجاني' : 'Free shipping')}</span><button type="button" onClick={() => void disable()} className="underline">{ar ? 'إيقاف العرض' : 'Disable offer'}</button></div>}
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs"><span>{ar ? 'الحد الأدنى للقطع' : 'Minimum item quantity'}</span><input required type="number" min="2" max="100" value={minItems} onChange={(e) => setMinItems(e.target.value)} className="w-full border border-neutral-300 px-3 py-2.5 text-sm" /></label>
        <label className="space-y-1 text-xs"><span>{ar ? 'نوع العرض' : 'Reward'}</span><select value={rewardType} onChange={(e) => setRewardType(e.target.value as QuantityPromotion['rewardType'])} className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm"><option value="percentage">{ar ? 'خصم نسبة مئوية' : 'Percentage discount'}</option><option value="fixed">{ar ? 'خصم مبلغ ثابت' : 'Fixed amount discount'}</option><option value="free_item">{ar ? 'قطعة مجانية (الأقل سعرًا)' : 'One item free (lowest priced)'}</option><option value="free_shipping">{ar ? 'شحن مجاني' : 'Free shipping'}</option></select></label>
        <label className="space-y-1 text-xs"><span>{rewardType === 'percentage' ? (ar ? 'نسبة الخصم %' : 'Discount percent') : ar ? 'قيمة الخصم (ج.م)' : 'Discount amount (EGP)'}</span><input required type="number" min="1" max={rewardType === 'percentage' ? 100 : undefined} disabled={rewardType === 'free_item' || rewardType === 'free_shipping'} value={value} onChange={(e) => setValue(e.target.value)} className="w-full border border-neutral-300 px-3 py-2.5 text-sm disabled:opacity-40" /></label>
        <button type="submit" disabled={saving || loading} className="sm:col-span-3 justify-self-start bg-black px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ وتفعيل العرض' : 'Save and activate')}</button>
      </form>
      {error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    </>}
  </section>;
}
