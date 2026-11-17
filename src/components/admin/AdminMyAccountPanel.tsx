import { useEffect, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { LogOut, ShieldCheck, Upload, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { formatDateTime } from '../../lib/adminAnalytics';
import {
  fetchAdminProfileDoc,
  logAdminActionAdmin,
  saveAdminProfileDoc,
  uploadAdminImage,
} from '../../lib/storeService';
import type { AuditLogEntry, Locale } from '../../types/domain';
import { Bdi } from '../Bdi';

interface AdminMyAccountPanelProps {
  auditLogs: AuditLogEntry[];
  serverVerified: boolean | null;
  onRefresh: () => Promise<void>;
  onProfileUpdated?: (profile: { displayName: string; photoUrl: string }) => void;
}

export function AdminMyAccountPanel({
  auditLogs,
  serverVerified,
  onRefresh,
  onProfileUpdated,
}: AdminMyAccountPanelProps) {
  const { locale, switchLocale, t } = useLocale();
  const { user, getIdToken, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || 'FAVMO Owner');
  const [photoUrl, setPhotoUrl] = useState(user?.photoURL || '');
  const [preferredLocale, setPreferredLocale] = useState<Locale>(locale);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchAdminProfileDoc(user.uid).then((docData) => {
      if (docData?.displayName) setDisplayName(docData.displayName);
      if (docData?.photoUrl) setPhotoUrl(docData.photoUrl);
    });
  }, [user]);

  const handlePhotoUpload = async (file?: File) => {
    if (!file || !user) return;
    setUploadingPhoto(true);
    setProfileError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      const url = await uploadAdminImage(file, token, 'logo');
      setPhotoUrl(url);
      await updateProfile(user, { photoURL: url });
      await saveAdminProfileDoc(user.uid, user.email || '', {
        displayName,
        photoUrl: url,
        preferredLocale,
      });
      onProfileUpdated?.({ displayName, photoUrl: url });
      setProfileFeedback(t.account.saved);
      await onRefresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'PHOTO_UPLOAD_FAILED');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileFeedback(null);
    setProfileError(null);
    try {
      const cleanName = displayName.trim().slice(0, 100) || 'FAVMO Owner';
      await updateProfile(user, { displayName: cleanName, photoURL: photoUrl || undefined });
      await saveAdminProfileDoc(user.uid, user.email || '', {
        displayName: cleanName,
        photoUrl,
        preferredLocale,
      });
      onProfileUpdated?.({ displayName: cleanName, photoUrl });
      if (preferredLocale !== locale) {
        switchLocale(preferredLocale);
      }
      setProfileFeedback(t.account.saved);
      await onRefresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'SAVE_FAILED');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setPasswordFeedback(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError(t.auth.passwordMin);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t.auth.passwordsMismatch);
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      await logAdminActionAdmin(user.uid, 'CHANGE_ADMIN_PASSWORD', 'adminProfiles', user.uid);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordFeedback(t.admin.myAccount.passwordUpdated);
      await onRefresh();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t.auth.authError);
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile Information Card */}
        <section className="lg:col-span-7 bg-white border border-neutral-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
            <h2 className="text-sm font-semibold text-black">{t.admin.myAccount.profileTitle}</h2>
            <span className="border border-emerald-700/30 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-[11px] font-medium">
              {t.admin.myAccount.ownerRoleLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div className="w-20 h-20 border border-neutral-200 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-neutral-400" strokeWidth={1.5} />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-500">{t.admin.myAccount.profilePhoto}</p>
              <label className="inline-flex items-center gap-2 border border-black px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingPhoto ? t.admin.actions.uploading : t.admin.myAccount.changePhoto}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-medium text-neutral-600">{t.auth.displayName}</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-black focus:border-black focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block font-medium text-neutral-600">{t.auth.email}</label>
                <input
                  type="email"
                  disabled
                  dir="ltr"
                  value={user.email || ''}
                  className="w-full border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-600"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block font-medium text-neutral-600">
                  {t.account.preferredLanguage}
                </label>
                <select
                  value={preferredLocale}
                  onChange={(e) => setPreferredLocale(e.target.value as Locale)}
                  className="w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-black focus:border-black focus:outline-none"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            {profileFeedback && (
              <p className="border border-emerald-700/30 bg-emerald-50 text-emerald-900 p-3 font-medium">
                {profileFeedback}
              </p>
            )}
            {profileError && (
              <p className="border border-red-700/30 bg-red-50 text-red-900 p-3 font-medium">
                {profileError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-black text-white px-6 py-2.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                {savingProfile ? t.admin.actions.saving : t.account.saveProfile}
              </button>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.admin.tabs.logout}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Security & Change Password */}
        <section className="lg:col-span-5 bg-white border border-neutral-200 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
            <h2 className="text-sm font-semibold text-black">{t.admin.myAccount.securityTitle}</h2>
            <ShieldCheck className="w-4 h-4 text-emerald-700" strokeWidth={1.7} />
          </div>

          <div className="border border-neutral-200 bg-neutral-50 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">{t.auth.email}</span>
              <span className="font-mono-code font-semibold text-black">
                <Bdi>{user.email}</Bdi>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">{t.admin.myAccount.emailVerified}</span>
              <span className="font-semibold text-emerald-700">
                {user.emailVerified
                  ? locale === 'ar'
                    ? 'موثّق'
                    : 'Verified'
                  : locale === 'ar'
                    ? 'غير موثّق'
                    : 'Unverified'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">
                {locale === 'ar' ? 'التحقق على الخادم' : 'Server Session Guard'}
              </span>
              <span className="font-semibold text-neutral-800">
                {serverVerified === true
                  ? locale === 'ar'
                    ? 'مُفعّل'
                    : 'Verified'
                  : serverVerified === false
                    ? locale === 'ar'
                      ? 'قواعد Firestore فعالة'
                      : 'Firestore Rules Enforced'
                    : '...'}
              </span>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <h3 className="font-semibold text-black">{t.admin.myAccount.changePassword}</h3>
            <div className="space-y-1">
              <label className="text-neutral-600">{t.admin.myAccount.currentPassword}</label>
              <input
                type="password"
                required
                dir="ltr"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-neutral-600">{t.admin.myAccount.newPassword}</label>
              <input
                type="password"
                required
                minLength={8}
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-neutral-600">{t.admin.myAccount.confirmNewPassword}</label>
              <input
                type="password"
                required
                minLength={8}
                dir="ltr"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-black focus:border-black focus:outline-none"
              />
            </div>

            {passwordFeedback && (
              <p className="border border-emerald-700/30 bg-emerald-50 text-emerald-900 p-2.5 font-medium">
                {passwordFeedback}
              </p>
            )}
            {passwordError && (
              <p className="border border-red-700/30 bg-red-50 text-red-900 p-2.5 font-medium">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full bg-black text-white py-2.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
            >
              {savingPassword ? t.admin.actions.saving : t.admin.myAccount.updatePassword}
            </button>
          </form>
        </section>
      </div>

      {/* Recent Account Activity */}
      <section className="bg-white border border-neutral-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-black border-b border-neutral-200 pb-3">
          {t.admin.myAccount.recentActivity}
        </h2>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">{t.admin.myAccount.noActivityYet}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-2.5 text-start font-medium">
                    {locale === 'ar' ? 'بواسطة' : 'Actor'}
                  </th>
                  <th className="py-2.5 text-start font-medium">
                    {locale === 'ar' ? 'الإجراء' : 'Action'}
                  </th>
                  <th className="py-2.5 text-start font-medium">
                    {locale === 'ar' ? 'القسم / المعرف' : 'Target'}
                  </th>
                  <th className="py-2.5 text-end font-medium">
                    {locale === 'ar' ? 'التاريخ والوقت' : 'Timestamp'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {auditLogs.slice(0, 15).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 text-neutral-700">
                      <span className="block">{log.actorEmail || log.actorUid}</span>
                      <span className="text-neutral-400">{log.actorRole}</span>
                    </td>
                    <td className="py-2.5 font-mono-code font-semibold text-black">{log.action}</td>
                    <td className="py-2.5 text-neutral-600 font-mono-code">
                      {log.targetCollection}/{log.targetId}
                    </td>
                    <td className="py-2.5 text-end text-neutral-500 tabular-nums">
                      {formatDateTime(log.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
