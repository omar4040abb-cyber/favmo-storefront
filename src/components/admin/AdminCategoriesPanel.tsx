import { useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteCollectionAdmin,
  logAdminActionAdmin,
  saveCollectionAdmin,
  uploadAdminImage,
} from '../../lib/storeService';
import type { Collection } from '../../types/domain';

interface AdminCategoriesPanelProps {
  collections: Collection[];
  onRefresh: () => Promise<void>;
}

function slugify(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function AdminCategoriesPanel({ collections, onRefresh }: AdminCategoriesPanelProps) {
  const { locale, t } = useLocale();
  const { user, getIdToken } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string>('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [slug, setSlug] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState(1);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const parentMap = new Map(collections.map((c) => [c.id, c]));
  const topLevelOptions = collections.filter((c) => !c.parentId && c.id !== editingId);

  const openCreate = () => {
    setEditingId(null);
    setParentId('');
    setNameAr('');
    setNameEn('');
    setSlug('');
    setDescAr('');
    setDescEn('');
    setHeroImageUrl('');
    setSortOrder(collections.length + 1);
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (c: Collection) => {
    setEditingId(c.id);
    setParentId(c.parentId || '');
    setNameAr(c.name_ar);
    setNameEn(c.name_en);
    setSlug(c.slug);
    setDescAr(c.description_ar || '');
    setDescEn(c.description_en || '');
    setHeroImageUrl(c.heroImageUrl || '');
    setSortOrder(c.sortOrder ?? 1);
    setActive(c.active);
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = await getIdToken();
      if (token) {
        const url = await uploadAdminImage(file, token, 'banner');
        setHeroImageUrl(url);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const savedId = await saveCollectionAdmin(editingId, {
        slug: slugify(slug || nameEn) || `cat-${Date.now().toString(36)}`,
        parentId: parentId || null,
        name_ar: nameAr.trim(),
        name_en: nameEn.trim(),
        description_ar: descAr.trim(),
        description_en: descEn.trim(),
        heroImageUrl,
        active,
        sortOrder: Math.max(0, Math.trunc(sortOrder)),
      });
      if (user) {
        await logAdminActionAdmin(
          user.uid,
          editingId ? 'UPDATE_CATEGORY' : 'CREATE_CATEGORY',
          'collections',
          savedId
        );
      }
      setModalOpen(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.admin.actions.add}</span>
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          {t.admin.metrics.noDataYet}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((c) => {
            const parent = c.parentId ? parentMap.get(c.parentId) : null;
            return (
              <div
                key={c.id}
                className="border border-neutral-200 bg-white p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {parent && (
                        <p className="text-[11px] text-neutral-500">
                          ↳ {locale === 'ar' ? parent.name_ar : parent.name_en}
                        </p>
                      )}
                      <h3 className="text-sm font-semibold text-black">
                        {locale === 'ar' ? c.name_ar : c.name_en}
                      </h3>
                      <p className="text-xs text-neutral-500 font-mono-code">{c.slug}</p>
                    </div>
                    <span
                      className={`border px-2 py-0.5 text-[11px] font-medium ${
                        c.active
                          ? 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                          : 'border-neutral-300 bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      {c.active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {c.heroImageUrl && (
                    <img
                      src={c.heroImageUrl}
                      alt=""
                      className="w-full h-36 object-cover border border-neutral-200"
                    />
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 text-xs">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="border border-neutral-300 px-3 py-1.5 hover:border-black cursor-pointer"
                  >
                    {t.admin.actions.edit}
                  </button>
                  {confirmDeleteId === c.id ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteCollectionAdmin(c.id);
                        if (user) {
                          await logAdminActionAdmin(user.uid, 'DELETE_CATEGORY', 'collections', c.id);
                        }
                        setConfirmDeleteId(null);
                        await onRefresh();
                      }}
                      className="bg-black text-white px-3 py-1.5 font-semibold cursor-pointer"
                    >
                      {t.admin.actions.confirmDelete}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(c.id)}
                      className="border border-neutral-200 px-3 py-1.5 text-neutral-500 hover:text-black hover:border-black cursor-pointer"
                    >
                      {t.admin.actions.delete}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-white text-black border border-neutral-200 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h2 className="text-sm font-semibold">
                {editingId ? t.admin.actions.edit : t.admin.actions.add}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-neutral-600 font-medium">
                  {locale === 'ar'
                    ? 'التصنيف الأب (اختياري للتصنيفات الفرعية)'
                    : 'Parent Category (Optional for Subcategory)'}
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-xs text-black"
                >
                  <option value="">
                    {locale === 'ar' ? 'تصنيف رئيسي' : 'Top-Level Category'}
                  </option>
                  {topLevelOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {locale === 'ar' ? opt.name_ar : opt.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                required
                placeholder="اسم التصنيف (عربي)"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                className="w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-black"
              />
              <input
                type="text"
                required
                dir="ltr"
                placeholder="Category Name (EN) e.g. Hoodies"
                value={nameEn}
                onChange={(e) => {
                  setNameEn(e.target.value);
                  if (!editingId) setSlug(slugify(e.target.value));
                }}
                className="w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-black"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  dir="ltr"
                  placeholder="slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  className="border border-neutral-300 bg-white px-3.5 py-2.5 text-sm font-mono-code text-black"
                />
                <input
                  type="number"
                  min="0"
                  dir="ltr"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                  className="border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-black"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-xs hover:border-black cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? t.admin.actions.uploading : t.admin.actions.uploadImage}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="sr-only"
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="accent-black"
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="border border-neutral-300 px-5 py-2 text-xs font-semibold hover:border-black cursor-pointer"
                >
                  {t.admin.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-black text-white px-6 py-2 text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
                >
                  {saving ? t.admin.actions.saving : t.admin.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
