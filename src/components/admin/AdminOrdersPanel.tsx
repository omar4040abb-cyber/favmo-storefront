import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatMinorUnits } from '../../lib/currency';
import { formatShortDate } from '../../lib/adminAnalytics';
import { logAdminActionAdmin, updateOrderAdmin } from '../../lib/storeService';
import type { Order, OrderStatus, PaymentStatus } from '../../types/domain';
import { Bdi } from '../Bdi';

interface AdminOrdersPanelProps {
  orders: Order[];
  onRefresh: () => Promise<void>;
  initialOrderId?: string | null;
  initialSearch?: string;
  onClearInitialOrder?: () => void;
}

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
];

const QUICK_TABS: Array<{ id: string; labelAr: string; labelEn: string }> = [
  { id: '', labelAr: 'الكل', labelEn: 'All' },
  { id: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending' },
  { id: 'confirmed', labelAr: 'تم التأكيد', labelEn: 'Confirmed' },
  { id: 'processing', labelAr: 'قيد التجهيز', labelEn: 'Processing' },
  { id: 'shipped', labelAr: 'تم الشحن', labelEn: 'Shipped' },
  { id: 'delivered', labelAr: 'تم التوصيل', labelEn: 'Delivered' },
  { id: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' },
];

const PAGE_SIZE = 12;

export function AdminOrdersPanel({
  orders,
  onRefresh,
  initialOrderId,
  initialSearch = '',
  onClearInitialOrder,
}: AdminOrdersPanelProps) {
  const { locale, t } = useLocale();
  const { user, getIdToken } = useAuth();

  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus>('pending');
  const [nextPaymentStatus, setNextPaymentStatus] = useState<PaymentStatus>('pending');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const openOrder = (ord: Order) => {
    setSelectedOrder(ord);
    setNextStatus(ord.status);
    setNextPaymentStatus(ord.paymentStatus);
    setTrackingNumber(ord.trackingNumber || '');
    setInternalNotes(ord.internalNotes || '');
  };

  useEffect(() => {
    if (initialOrderId) {
      const found = orders.find((o) => o.id === initialOrderId);
      if (found) {
        openOrder(found);
        onClearInitialOrder?.();
      }
    }
  }, [initialOrderId, orders, onClearInitialOrder]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (q) {
        const hay =
          `${o.orderNumber} ${o.shippingAddress?.fullName || ''} ${o.shippingAddress?.phone || ''} ${o.shippingAddress?.email || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const handleSaveUpdate = async () => {
    if (!selectedOrder || !user) return;
    setSaving(true);
    try {
      const token = await getIdToken();
      await updateOrderAdmin(
        selectedOrder,
        {
          status: nextStatus,
          paymentStatus: nextPaymentStatus,
          trackingNumber: trackingNumber.trim(),
          internalNotes: internalNotes.trim(),
        },
        user.uid,
        token
      );
      await logAdminActionAdmin(
        user.uid,
        `ORDER_${nextStatus.toUpperCase()}`,
        'orders',
        selectedOrder.orderNumber
      );
      setSelectedOrder(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Tabs + Search */}
      <div className="bg-white border border-neutral-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
          {QUICK_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black'
              }`}
            >
              {locale === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.actions.searchPlaceholder}
            className="border border-neutral-300 bg-white px-3.5 py-2 text-xs text-black placeholder:text-neutral-400 w-full sm:w-72 focus:border-black focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
          >
            <option value="">{locale === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t.orderStatuses[st] || st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          {t.admin.metrics.noDataYet}
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <th className="p-4 text-start font-medium">#</th>
                <th className="p-4 text-start font-medium">{t.checkout.fullName}</th>
                <th className="p-4 text-start font-medium">{t.checkout.phone}</th>
                <th className="p-4 text-start font-medium">
                  {locale === 'ar' ? 'التاريخ' : 'Date'}
                </th>
                <th className="p-4 text-start font-medium">{t.checkout.paymentMethod}</th>
                <th className="p-4 text-start font-medium">{t.tracking.statusLabel}</th>
                <th className="p-4 text-end font-medium">{t.cart.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginated.map((ord) => (
                <tr
                  key={ord.id}
                  onClick={() => openOrder(ord)}
                  className="hover:bg-neutral-50 cursor-pointer"
                >
                  <td className="p-4 font-mono-code font-semibold text-black">
                    <Bdi>{ord.orderNumber}</Bdi>
                  </td>
                  <td className="p-4 text-black">{ord.shippingAddress?.fullName}</td>
                  <td className="p-4 text-neutral-700" dir="ltr">
                    {ord.shippingAddress?.phone}
                  </td>
                  <td className="p-4 text-neutral-500 tabular-nums whitespace-nowrap">
                    {formatShortDate(ord.createdAt, locale)}
                  </td>
                  <td className="p-4 text-neutral-700">
                    {t.paymentMethods[ord.paymentMethod]} ({t.paymentStatuses[ord.paymentStatus]})
                  </td>
                  <td className="p-4">
                    <span className="border border-neutral-300 px-2.5 py-0.5 text-[11px] font-medium text-neutral-800">
                      {t.orderStatuses[ord.status] || ord.status}
                    </span>
                  </td>
                  <td className="p-4 text-end tabular-nums font-semibold text-black">
                    {formatMinorUnits(ord.totalPiasters, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="border-t border-neutral-200 px-4 py-3 flex items-center justify-between text-xs text-neutral-600">
              <span className="tabular-nums">
                {page} / {totalPages} ({filtered.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 border border-neutral-300 px-3 py-1.5 disabled:opacity-40 hover:border-black cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{t.admin.actions.prevPage}</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 border border-neutral-300 px-3 py-1.5 disabled:opacity-40 hover:border-black cursor-pointer"
                >
                  <span>{t.admin.actions.nextPage}</span>
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setSelectedOrder(null)} />
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-black border border-neutral-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-mono-code text-base font-bold">
                  <Bdi>{selectedOrder.orderNumber}</Bdi>
                </h2>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 border border-neutral-300 px-3 py-1 text-xs font-medium hover:border-black cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{locale === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-neutral-500 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="border border-neutral-200 bg-neutral-50 p-4 space-y-1.5">
                <p className="text-neutral-500 font-semibold">{t.checkout.contactInfo}</p>
                <p className="text-sm font-semibold text-black">
                  {selectedOrder.shippingAddress?.fullName}
                </p>
                <p dir="ltr">{selectedOrder.shippingAddress?.phone}</p>
                <p dir="ltr" className="text-neutral-600">
                  {selectedOrder.shippingAddress?.email}
                </p>
              </div>
              <div className="border border-neutral-200 bg-neutral-50 p-4 space-y-1.5">
                <p className="text-neutral-500 font-semibold">{t.checkout.shippingAddress}</p>
                <p className="text-black">
                  {locale === 'ar'
                    ? selectedOrder.shippingAddress?.governorateName_ar
                    : selectedOrder.shippingAddress?.governorateName_en}{' '}
                  — {selectedOrder.shippingAddress?.city}
                </p>
                <p className="text-neutral-600">
                  {selectedOrder.shippingAddress?.area}, {selectedOrder.shippingAddress?.street},{' '}
                  {selectedOrder.shippingAddress?.building}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="border border-neutral-200 bg-neutral-50 p-4 space-y-3 text-xs">
              {(selectedOrder.itemsSnapshot || []).map((it, idx) => (
                <div
                  key={idx}
                  className="flex justify-between border-b border-neutral-200 pb-2 last:border-0 last:pb-0"
                >
                  <span>
                    {locale === 'ar' ? it.name_ar : it.name_en} ({it.size} ·{' '}
                    {locale === 'ar' ? it.colorName_ar : it.colorName_en}) × {it.quantity}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {formatMinorUnits(it.lineTotalPiasters, locale)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-neutral-300 text-sm font-semibold text-black">
                <span>{t.cart.total}</span>
                <span className="tabular-nums">
                  {formatMinorUnits(selectedOrder.totalPiasters, locale)}
                </span>
              </div>
            </div>

            {/* InstaPay Receipt Preview & Approval */}
            {selectedOrder.receiptUrl && (
              <div className="border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-neutral-600">
                  {t.checkout.instapayReceipt}
                </p>
                <a href={selectedOrder.receiptUrl} target="_blank" rel="noreferrer">
                  <img
                    src={selectedOrder.receiptUrl}
                    alt="Receipt"
                    className="max-h-56 border border-neutral-200 object-contain bg-white"
                  />
                </a>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNextPaymentStatus('paid')}
                    className="bg-black text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    {locale === 'ar' ? 'اعتماد الدفع' : 'Approve Payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextPaymentStatus('rejected')}
                    className="border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:border-black cursor-pointer"
                  >
                    {locale === 'ar' ? 'رفض الدفع' : 'Reject Payment'}
                  </button>
                </div>
              </div>
            )}

            {/* Status Update Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-neutral-600 font-medium">{t.tracking.statusLabel}</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                  className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-xs text-black"
                >
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {t.orderStatuses[st] || st}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-neutral-600 font-medium">{t.tracking.paymentLabel}</label>
                <select
                  value={nextPaymentStatus}
                  onChange={(e) => setNextPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-xs text-black"
                >
                  {(
                    [
                      'pending',
                      'awaiting_verification',
                      'paid',
                      'failed',
                      'rejected',
                      'refunded',
                    ] as PaymentStatus[]
                  ).map((ps) => (
                    <option key={ps} value={ps}>
                      {t.paymentStatuses[ps] || ps}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-neutral-600 font-medium">{t.tracking.trackingCode}</label>
                <input
                  type="text"
                  dir="ltr"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-xs font-mono-code text-black"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-neutral-600 font-medium">
                  {locale === 'ar' ? 'ملاحظات داخلية' : 'Internal Notes'}
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full border border-neutral-300 bg-white px-3 py-2 text-xs text-black"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="border border-neutral-300 px-5 py-2 text-xs font-semibold hover:border-black cursor-pointer"
              >
                {t.admin.actions.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveUpdate}
                className="bg-black text-white px-6 py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? t.admin.actions.saving : t.admin.actions.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
