import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatMinorUnits } from '../../lib/currency';
import {
  deleteDiscountAdmin,
  logAdminActionAdmin,
  saveDiscountAdmin,
} from '../../lib/storeService';
import type { Discount } from '../../types/domain';
import { AdminQuantityPromotionPanel } from './AdminQuantityPromotionPanel';

interface AdminDiscountsPanelProps {
  discounts: Discount[];
  onRefresh: () => Promise<void>;
}

export function AdminDiscountsPanel({ discounts, onRefresh }: AdminDiscountsPanelProps) {
  const { locale, t } = useLocale();
  const { user, getIdToken } = useAuth();
  const [code, setCode] = useState('');
  const [type, setType] = useState<Discount['type']>('percentage');
  const [valueInput, setValueInput] = useState('');
  const [minOrderEgp, setMinOrderEgp] = useState('');
  const [minItems, setMinItems] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    setError('');
    try {
      const numericValue =
        type === 'fixed'
          ? Math.round(Number(valueInput) * 100)
          : type === 'percentage'
            ? Math.min(100, Math.max(1, Math.trunc(Number(valueInput) || 0)))
            : 0;

      const normalizedCode = code.trim().toUpperCase();
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Please sign in again.');
      await saveDiscountAdmin(idToken, {
        code: normalizedCode,
        type,
        value: numericValue,
        minItems: minItems.trim() ? Math.max(1, Math.trunc(Number(minItems))) : null,
        minOrderPiasters:
          minOrderEgp.trim() && Number(minOrderEgp) > 0
            ? Math.round(Number(minOrderEgp) * 100)
            : null,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        usageLimit: usageLimit.trim() ? Math.max(1, Math.trunc(Number(usageLimit))) : null,
        active: true,
      });
      if (user) {
        await logAdminActionAdmin(user.uid, 'CREATE_DISCOUNT', 'discounts', normalizedCode);
      }
      setCode('');
      setValueInput('');
      setMinOrderEgp('');
      setMinItems('');
      setUsageLimit('');
      setStartsAt('');
      setEndsAt('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DISCOUNT_SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminQuantityPromotionPanel />
      <form onSubmit={handleCreate} className="border border-neutral-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-black">{t.admin.actions.add}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <input
            type="text"
            required
            dir="ltr"
            placeholder="CODE (e.g. FAVMO10)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="border border-neutral-300 bg-white px-3 py-2.5 uppercase font-mono-code text-black"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Discount['type'])}
            className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
          >
            <option value="percentage">% Percentage</option>
            <option value="fixed">Fixed (EGP)</option>
            <option value="free_item">Buy X, get one item free</option>
            <option value="free_shipping">Free Shipping</option>
          </select>
          <input
            type="number"
            min="0"
            dir="ltr"
            disabled={type === 'free_shipping' || type === 'free_item'}
            placeholder={type === 'percentage' ? 'Percent (1-100)' : 'Amount (EGP)'}
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2.5 text-black disabled:opacity-40"
          />
          <input
            type="number"
            min="0"
            dir="ltr"
            placeholder={locale === 'ar' ? 'الحد الأدنى للطلب (ج.م)' : 'Min Order (EGP)'}
            value={minOrderEgp}
            onChange={(e) => setMinOrderEgp(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
          />
          <input type="number" min="1" max="100" dir="ltr" required={type === 'free_item'} placeholder={locale === 'ar' ? 'الحد الأدنى لعدد القطع' : 'Minimum number of items'} value={minItems} onChange={(e) => setMinItems(e.target.value)} className="border border-neutral-300 bg-white px-3 py-2.5 text-black" />
          <input
            type="date"
            dir="ltr"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
          />
          <input
            type="date"
            dir="ltr"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2.5 text-black"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? t.admin.actions.saving : t.admin.actions.save}</span>
        </button>
      </form>

      {error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs text-red-800">{error}</p>}

      {discounts.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          {t.admin.metrics.noDataYet}
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <th className="p-4 text-start font-medium">Code</th>
                <th className="p-4 text-start font-medium">Type / Value</th>
                <th className="p-4 text-start font-medium">Used</th>
                <th className="p-4 text-start font-medium">Status</th>
                <th className="p-4 text-end font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {discounts.map((d) => (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <td className="p-4 font-mono-code font-bold text-black">{d.code}</td>
                  <td className="p-4 text-neutral-800">
                    {d.type === 'percentage'
                      ? `${d.value}%`
                      : d.type === 'fixed'
                        ? formatMinorUnits(d.value, locale)
                        : d.type === 'free_item' ? (locale === 'ar' ? 'قطعة مجانية' : 'One free item') : 'Free Shipping'}
                    {d.minItems ? <span className="block text-[10px] text-neutral-500">{locale === 'ar' ? `عند شراء ${d.minItems} قطع` : `When buying ${d.minItems} items`}</span> : null}
                  </td>
                  <td className="p-4 tabular-nums text-neutral-700">
                    {d.usedCount}
                    {d.usageLimit ? ` / ${d.usageLimit}` : ''}
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const idToken = await getIdToken();
                          if (!idToken) throw new Error('Please sign in again.');
                          await saveDiscountAdmin(idToken, { ...d, active: !d.active });
                          await onRefresh();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'DISCOUNT_SAVE_FAILED');
                        }
                      }}
                      className={`border px-2.5 py-1 font-medium cursor-pointer ${
                        d.active
                          ? 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                          : 'border-neutral-300 bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      {d.active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="p-4 text-end">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const idToken = await getIdToken();
                          if (!idToken) throw new Error('Please sign in again.');
                          await deleteDiscountAdmin(d.code, idToken);
                          if (user) {
                            await logAdminActionAdmin(user.uid, 'DELETE_DISCOUNT', 'discounts', d.code);
                          }
                          await onRefresh();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'DISCOUNT_DELETE_FAILED');
                        }
                      }}
                      className="border border-neutral-200 px-3 py-1 text-neutral-500 hover:text-black hover:border-black cursor-pointer"
                    >
                      {t.admin.actions.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
