import { useMemo, useState } from 'react';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { adjustVariantStockAdmin, logAdminActionAdmin } from '../../lib/storeService';
import type { Product, ProductVariant, StockMovement } from '../../types/domain';

interface AdminInventoryPanelProps {
  products: Product[];
  variants: ProductVariant[];
  movements: StockMovement[];
  onRefresh: () => Promise<void>;
}

export function AdminInventoryPanel({
  products,
  variants,
  movements,
  onRefresh,
}: AdminInventoryPanelProps) {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterLowOnly, setFilterLowOnly] = useState(false);
  const [editingVar, setEditingVar] = useState<ProductVariant | null>(null);
  const [nextStock, setNextStock] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variants.filter((v) => {
      if (filterLowOnly && v.stock > (v.lowStockThreshold ?? 3)) return false;
      if (q) {
        const p = productMap.get(v.productId);
        const hay = `${v.sku} ${p?.name_ar || ''} ${p?.name_en || ''} ${v.size} ${v.colorName_en}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [variants, filterLowOnly, search, productMap]);

  const handleSaveStock = async () => {
    if (!editingVar || !user) return;
    setSaving(true);
    try {
      await adjustVariantStockAdmin(editingVar, nextStock, reason, user.uid);
      await logAdminActionAdmin(user.uid, 'ADJUST_STOCK', 'variants', editingVar.sku);
      setEditingVar(null);
      setReason('');
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 p-4 flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.admin.actions.searchPlaceholder}
          className="border border-neutral-300 bg-white px-3.5 py-2 text-xs text-black placeholder:text-neutral-400 w-full sm:w-64 focus:border-black focus:outline-none"
        />
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={filterLowOnly}
            onChange={(e) => setFilterLowOnly(e.target.checked)}
            className="accent-black"
          />
          <span>
            {t.badges.lowStock} / {t.badges.soldOut}
          </span>
        </label>
      </div>

      {list.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          {t.admin.metrics.noDataYet}
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <th className="p-4 text-start font-medium">SKU</th>
                <th className="p-4 text-start font-medium">
                  {locale === 'ar' ? 'المنتج' : 'Product'}
                </th>
                <th className="p-4 text-start font-medium">
                  {locale === 'ar' ? 'اللون / المقاس' : 'Variant'}
                </th>
                <th className="p-4 text-start font-medium">
                  {locale === 'ar' ? 'المتوفر' : 'Available'}
                </th>
                <th className="p-4 text-start font-medium">
                  {locale === 'ar' ? 'المحجوز' : 'Reserved'}
                </th>
                <th className="p-4 text-start font-medium">
                  {locale === 'ar' ? 'المباع' : 'Sold'}
                </th>
                <th className="p-4 text-start font-medium">
                  {locale === 'ar' ? 'الحالة' : 'Status'}
                </th>
                <th className="p-4 text-end font-medium">
                  {locale === 'ar' ? 'تعديل' : 'Adjust'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {list.map((v) => {
                const p = productMap.get(v.productId);
                const threshold = v.lowStockThreshold ?? 3;
                const isOut = v.stock <= 0;
                const isLow = v.stock > 0 && v.stock <= threshold;
                return (
                  <tr key={v.id} className="hover:bg-neutral-50">
                    <td className="p-4 font-mono-code text-neutral-700">{v.sku}</td>
                    <td className="p-4 font-semibold text-black">
                      {p ? (locale === 'ar' ? p.name_ar : p.name_en) : v.productId}
                    </td>
                    <td className="p-4 text-neutral-700">
                      {locale === 'ar' ? v.colorName_ar : v.colorName_en} · {v.size}
                    </td>
                    <td className="p-4 tabular-nums font-semibold text-black">{v.stock}</td>
                    <td className="p-4 tabular-nums text-neutral-500">{v.reservedStock ?? 0}</td>
                    <td className="p-4 tabular-nums text-neutral-700">{v.soldCount ?? 0}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block border px-2 py-0.5 text-[11px] font-medium ${
                          isOut
                            ? 'border-red-700/30 bg-red-50 text-red-800'
                            : isLow
                              ? 'border-amber-700/30 bg-amber-50 text-amber-900'
                              : 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {isOut ? t.badges.soldOut : isLow ? t.badges.lowStock : t.badges.available}
                      </span>
                    </td>
                    <td className="p-4 text-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVar(v);
                          setNextStock(v.stock);
                        }}
                        className="border border-neutral-300 px-3 py-1.5 hover:border-black cursor-pointer"
                      >
                        {t.admin.actions.edit}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingVar && (
        <div className="border border-black bg-white p-6 space-y-4 max-w-md">
          <h3 className="text-sm font-semibold font-mono-code text-black">{editingVar.sku}</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-neutral-600 font-medium">
                {locale === 'ar' ? 'الكمية الجديدة' : 'New Stock'}
              </label>
              <input
                type="number"
                min="0"
                dir="ltr"
                value={nextStock}
                onChange={(e) => setNextStock(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-neutral-600 font-medium">
                {locale === 'ar' ? 'السبب' : 'Reason'}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Restock / Correction"
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-black"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveStock}
              className="bg-black text-white px-5 py-2 text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
            >
              {saving ? t.admin.actions.saving : t.admin.actions.save}
            </button>
            <button
              type="button"
              onClick={() => setEditingVar(null)}
              className="border border-neutral-300 px-5 py-2 text-xs hover:border-black cursor-pointer"
            >
              {t.admin.actions.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Stock Movement Log */}
      {movements.length > 0 && (
        <div className="border border-neutral-200 bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold text-black border-b border-neutral-200 pb-3">
            {locale === 'ar' ? 'سجل حركات المخزون' : 'Stock Movements Log'}
          </h3>
          <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
            {movements.slice(0, 20).map((m) => (
              <div
                key={m.id}
                className="flex justify-between border-b border-neutral-100 pb-2 last:border-0"
              >
                <span className="text-neutral-700">
                  <span className="font-mono-code font-semibold text-black">{m.sku}</span> —{' '}
                  {m.reason}
                </span>
                <span className="tabular-nums font-semibold text-black">
                  {m.previousQuantity} → {m.newQuantity} (
                  {m.delta >= 0 ? `+${m.delta}` : m.delta})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
