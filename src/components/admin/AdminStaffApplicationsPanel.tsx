import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import type { AdminPermission, StaffApplication } from '../../types/domain';

const permissionKeys: AdminPermission[] = [
  'catalog', 'inventory', 'orders', 'customers', 'discounts', 'reviews', 'analytics', 'settings', 'content',
];

const permissionLabels: Record<AdminPermission, [string, string]> = {
  catalog: ['المنتجات والتصنيفات', 'Products & categories'],
  inventory: ['المخزون', 'Inventory'],
  orders: ['الطلبات والمدفوعات', 'Orders & payments'],
  customers: ['العملاء ورسائل التواصل', 'Customers & messages'],
  discounts: ['الخصومات', 'Discounts'],
  reviews: ['التقييمات', 'Reviews'],
  analytics: ['التحليلات', 'Analytics'],
  settings: ['إعدادات المتجر والشحن', 'Store & shipping settings'],
  content: ['محتوى المتجر والشبكات', 'Store content & social'],
};

interface AdminStaffApplicationsPanelProps {
  applications: StaffApplication[];
  onRefresh: () => Promise<void>;
}

export function AdminStaffApplicationsPanel({ applications, onRefresh }: AdminStaffApplicationsPanelProps) {
  const { locale } = useLocale();
  const { getIdToken, sendResetEmail } = useAuth();
  const isAr = locale === 'ar';
  const [selected, setSelected] = useState<Record<string, AdminPermission[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendPasswordSetup = async (application: StaffApplication) => {
    if (!application.passwordSetupRequired && !window.confirm(isAr
      ? 'سيصل للموظف رابط إعادة تعيين. إذا استخدمه، ستتغير كلمة مرور حساب Firebase نفسه المستخدم للمتجر والإدارة. هل تريد الإرسال؟'
      : 'The employee will receive a reset link. If used, it changes the same Firebase password used for both store and staff access. Send it?')) return;
    setBusyId(application.id);
    setError(null);
    setNotice(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('SESSION_MISSING');
      const response = await fetch(`/api/admin/staff-applications/${application.id}/password-setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({})) as { email?: string; passwordSetupRequired?: boolean; error?: string };
      if (!response.ok || !result.email) throw new Error(result.error || 'PASSWORD_SETUP_PREPARATION_FAILED');
      await sendResetEmail(result.email, locale);
      setNotice(isAr
        ? `أُرسل رابط آمن إلى ${result.email}. يختار الموظف كلمة المرور بنفسه، ولا تظهر للإدارة.`
        : `A secure link was sent to ${result.email}. The employee chooses a private password; it is never shown to the owner.`);
      await onRefresh();
    } catch {
      setError(isAr
        ? 'تعذّر إرسال رابط كلمة المرور من Firebase. تأكد من تفعيل البريد وكلمة المرور في Firebase ثم أعد المحاولة.'
        : 'Firebase could not send the password link. Check that Email/Password sign-in is enabled, then try again.');
    } finally {
      setBusyId(null);
    }
  };

  const review = async (application: StaffApplication, decision: 'approved' | 'rejected') => {
    const permissions = selected[application.id] || [];
    if (decision === 'approved' && permissions.length === 0) {
      setError(isAr ? 'اختر صلاحية واحدة على الأقل قبل القبول.' : 'Select at least one permission before approving.');
      return;
    }
    setBusyId(application.id);
    setError(null);
    setNotice(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('SESSION_MISSING');
      const response = await fetch(`/api/admin/staff-applications/${application.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, permissions }),
      });
      const result = await response.json().catch(() => ({})) as { passwordSetupRequired?: boolean; passwordResetEmailRequired?: boolean; error?: string };
      if (!response.ok) throw new Error('REVIEW_FAILED');
      if (decision === 'approved' && result.passwordResetEmailRequired) {
        try {
          await sendResetEmail(application.email, locale);
          setNotice(isAr
            ? result.passwordSetupRequired
              ? `تم قبول الطلب وإرسال رابط إعداد كلمة المرور إلى ${application.email}. لا تظهر كلمة المرور للإدارة.`
              : `تم قبول الطلب وإرسال رابط آمن إلى ${application.email}. يمكن للموظف اختيار كلمة مرور جديدة؛ وكلمة المرور لا تظهر للإدارة.`
            : result.passwordSetupRequired
              ? `Application approved. A password setup link was sent to ${application.email}; the password is not visible to the owner.`
              : `Application approved. A secure password link was sent to ${application.email}. The owner cannot see the employee's password.`);
        } catch {
          setError(isAr
            ? 'تم قبول الطلب، لكن تعذّر إرسال رابط كلمة المرور. أعد إرساله من «الطلبات السابقة» بعد تفعيل البريد وكلمة المرور في Firebase.'
            : 'The application was approved, but Firebase could not send the password link. Resend it from Reviewed applications after enabling Email/Password sign-in.');
        }
      } else if (decision === 'approved') {
        setNotice(isAr
          ? 'تم قبول الطلب. سيستخدم الموظف كلمة مرور حسابه الحالي.'
          : 'Application approved. The employee will use the password on their existing account.');
      }
      await onRefresh();
    } catch {
      setError(isAr ? 'تعذّرت مراجعة الطلب. حدّث الصفحة وحاول مرة أخرى.' : 'Could not review the application. Refresh and try again.');
    } finally {
      setBusyId(null);
    }
  };

  const togglePermission = (id: string, permission: AdminPermission) => {
    setSelected((current) => {
      const values = current[id] || [];
      return {
        ...current,
        [id]: values.includes(permission)
          ? values.filter((item) => item !== permission)
          : [...values, permission],
      };
    });
  };

  const pending = applications.filter((application) => application.status === 'pending');
  const reviewed = applications.filter((application) => application.status !== 'pending');

  return (
    <section className="space-y-6">
      <header className="border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold">{isAr ? 'طلبات الانضمام للفريق' : 'Team applications'}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {isAr ? 'راجع بيانات المتقدم وحدد الصلاحيات قبل القبول. الطلب المرفوض لا يحصل على أي وصول.' : 'Review each application and choose permissions before approval. Rejected applicants receive no access.'}
        </p>
      </header>

      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
      {pending.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">{isAr ? 'لا توجد طلبات جديدة.' : 'No new applications.'}</div>
      ) : pending.map((application) => (
        <article key={application.id} className="space-y-5 border border-neutral-200 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">{application.displayName}</h3>
              <p className="mt-1 text-sm text-neutral-600" dir="ltr">{application.email}</p>
              <p className="mt-1 text-xs text-neutral-500" dir="ltr">{application.phone}</p>
            </div>
            <span className="border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] text-amber-800">{application.desiredRole === 'manager' ? (isAr ? 'مسؤول' : 'Manager') : (isAr ? 'موظف' : 'Employee')}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">{application.experience}</p>
          <fieldset>
            <legend className="mb-3 text-xs font-semibold">{isAr ? 'الصلاحيات الممنوحة عند القبول' : 'Permissions granted on approval'}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {permissionKeys.map((permission) => (
                <label key={permission} className="flex cursor-pointer items-center gap-2 border border-neutral-200 p-3 text-xs hover:bg-neutral-50">
                  <input type="checkbox" checked={(selected[application.id] || []).includes(permission)} onChange={() => togglePermission(application.id, permission)} />
                  {permissionLabels[permission][isAr ? 0 : 1]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busyId === application.id} onClick={() => review(application, 'approved')} className="inline-flex min-h-10 items-center gap-2 bg-black px-4 text-xs text-white disabled:opacity-50"><Check className="h-4 w-4" />{isAr ? 'قبول ومنح الصلاحيات المحددة' : 'Approve selected permissions'}</button>
            <button type="button" disabled={busyId === application.id} onClick={() => review(application, 'rejected')} className="inline-flex min-h-10 items-center gap-2 border border-neutral-300 px-4 text-xs text-neutral-700 disabled:opacity-50"><X className="h-4 w-4" />{isAr ? 'رفض الطلب' : 'Reject application'}</button>
          </div>
        </article>
      ))}

      {reviewed.length > 0 && (
        <details className="border border-neutral-200 bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium">{isAr ? `الطلبات السابقة (${reviewed.length})` : `Reviewed applications (${reviewed.length})`}</summary>
          <div className="divide-y divide-neutral-200">
            {reviewed.map((application) => (
              <div key={application.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs">
                <div>
                  <span>{application.displayName} <span className="text-neutral-500" dir="ltr">· {application.email}</span></span>
                  <p className={application.status === 'approved' ? 'mt-1 text-emerald-700' : 'mt-1 text-neutral-500'}>
                    {application.status === 'approved'
                      ? application.passwordSetupRequired
                        ? (isAr ? 'مقبول — بانتظار إعداد كلمة المرور' : 'Approved — waiting for password setup')
                        : (isAr ? 'مقبول' : 'Approved')
                      : (isAr ? 'مرفوض' : 'Rejected')}
                  </p>
                </div>
                {application.status === 'approved' && (
                  <button
                    type="button"
                    disabled={busyId === application.id}
                    onClick={() => void sendPasswordSetup(application)}
                    className="min-h-10 border border-neutral-300 px-3 text-xs text-neutral-800 disabled:opacity-50"
                  >
                    {busyId === application.id
                      ? (isAr ? 'جارٍ الإرسال...' : 'Sending...')
                      : application.passwordSetupRequired
                        ? (isAr ? 'إعادة إرسال رابط كلمة المرور' : 'Resend password link')
                        : (isAr ? 'إرسال رابط تغيير كلمة المرور' : 'Send password reset link')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
