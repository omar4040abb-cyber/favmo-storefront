import { useMemo, useState } from 'react';
import { Check, EyeOff, Star, Trash2 } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { deleteReviewAdmin, moderateReviewAdmin } from '../../lib/storeService';
import type { Product, ProductReview } from '../../types/domain';

interface AdminReviewsPanelProps {
  reviews: ProductReview[];
  products: Product[];
  onRefresh: () => Promise<void>;
}

export function AdminReviewsPanel({ reviews, products, onRefresh }: AdminReviewsPanelProps) {
  const { locale, t } = useLocale();
  const [statusFilter, setStatusFilter] = useState<'all' | ProductReview['status']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return reviews;
    return reviews.filter((r) => r.status === statusFilter);
  }, [reviews, statusFilter]);

  const handleModerate = async (review: ProductReview, status: ProductReview['status']) => {
    setBusyId(review.id);
    try {
      await moderateReviewAdmin(review, status);
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteReviewAdmin(id);
      setConfirmDeleteId(null);
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 p-4 flex flex-wrap items-center justify-between gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ProductReview['status'])}
          className="border border-neutral-300 bg-white px-4 py-2 text-xs text-black"
        >
          <option value="all">{locale === 'ar' ? 'جميع التقييمات' : 'All Reviews'}</option>
          <option value="approved">{locale === 'ar' ? 'معتمد' : 'Approved'}</option>
          <option value="pending">{locale === 'ar' ? 'قيد المراجعة' : 'Pending'}</option>
          <option value="hidden">{locale === 'ar' ? 'مخفي' : 'Hidden'}</option>
        </select>
        <p className="text-xs text-neutral-500 tabular-nums">
          {filtered.length} {t.admin.tabs.reviews}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          {t.admin.metrics.noDataYet}
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white divide-y divide-neutral-200">
          {filtered.map((rev) => {
            const prod = productMap.get(rev.productId);
            const productTitle = prod
              ? locale === 'ar'
                ? prod.name_ar
                : prod.name_en
              : rev.productId;

            return (
              <div key={rev.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-500">{productTitle}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-black">{rev.authorName}</span>
                      <div className="flex items-center gap-0.5 text-black">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className="w-3.5 h-3.5"
                            fill={s <= rev.rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>
                      <span className="border border-neutral-300 px-2 py-0.5 text-[10px] uppercase font-medium">
                        {rev.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {rev.status !== 'approved' && (
                      <button
                        type="button"
                        disabled={busyId === rev.id}
                        onClick={() => handleModerate(rev, 'approved')}
                        className="inline-flex items-center gap-1 border border-neutral-300 px-3 py-1.5 hover:border-black cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{locale === 'ar' ? 'اعتماد' : 'Approve'}</span>
                      </button>
                    )}
                    {rev.status !== 'hidden' && (
                      <button
                        type="button"
                        disabled={busyId === rev.id}
                        onClick={() => handleModerate(rev, 'hidden')}
                        className="inline-flex items-center gap-1 border border-neutral-300 px-3 py-1.5 hover:border-black cursor-pointer"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{locale === 'ar' ? 'إخفاء' : 'Hide'}</span>
                      </button>
                    )}
                    {confirmDeleteId === rev.id ? (
                      <button
                        type="button"
                        disabled={busyId === rev.id}
                        onClick={() => handleDelete(rev.id)}
                        className="bg-black text-white px-3 py-1.5 font-semibold cursor-pointer"
                      >
                        {t.admin.actions.confirmDelete}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(rev.id)}
                        className="inline-flex items-center gap-1 border border-neutral-200 px-3 py-1.5 text-neutral-500 hover:text-black hover:border-black cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.admin.actions.delete}</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-neutral-700 leading-relaxed">{rev.comment}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
