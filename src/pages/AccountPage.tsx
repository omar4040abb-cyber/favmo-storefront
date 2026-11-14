import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Eye, EyeOff, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useWishlist } from '../contexts/WishlistContext';
import { db } from '../lib/firebase';
import { formatMinorUnits } from '../lib/currency';
import { EGYPT_GOVERNORATES } from '../lib/egyptGovernorates';
import { fetchCustomerOrders } from '../lib/storeService';
import type { Locale, Order, UserAddress } from '../types/domain';
import { Bdi } from '../components/Bdi';
import { BrandLogo } from '../components/BrandLogo';
import { SkeletonBox } from '../components/Skeleton';

const DEFAULT_CAMPAIGN_IMG = '/assets/aistudio/favmo-login-showcase.png';

function getAuthErrorMessage(error: unknown, locale: Locale, fallback: string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password'
  ) {
    return locale === 'ar'
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
      : 'The email address or password is incorrect.';
  }

  if (code === 'auth/email-already-in-use') {
    return locale === 'ar'
      ? 'هذا البريد مسجّل بالفعل. انتقل إلى «تسجيل الدخول» أو استخدم «نسيت كلمة المرور؟».'
      : 'This email is already registered. Switch to Sign In or use Forgot Password.';
  }

  if (code === 'auth/weak-password') {
    return locale === 'ar'
      ? 'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل واختر كلمة أقوى.'
      : 'The password is too weak. Use at least 8 characters and choose a stronger password.';
  }

  if (code === 'auth/invalid-email') {
    return locale === 'ar'
      ? 'صيغة البريد الإلكتروني غير صحيحة.'
      : 'The email address format is invalid.';
  }

  if (code === 'auth/operation-not-allowed') {
    return locale === 'ar'
      ? 'تسجيل البريد وكلمة المرور غير مفعّل في إعدادات Firebase.'
      : 'Email and password sign-in is disabled in Firebase settings.';
  }

  if (code === 'auth/too-many-requests') {
    return locale === 'ar'
      ? 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.'
      : 'Too many attempts. Wait a little and try again.';
  }

  if (code === 'auth/network-request-failed') {
    return locale === 'ar'
      ? 'تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.'
      : 'Connection failed. Check your internet and try again.';
  }

  return fallback;
}

type AccountTab = 'overview' | 'orders' | 'addresses' | 'profile';

export function AccountPage() {
  const { locale, t, localePath, switchLocale } = useLocale();
  const {
    user,
    loading,
    isAdmin,
    adminRole,
    isGoogleConfigured,
    signInEmail,
    registerEmail,
    signInGoogle,
    sendResetEmail,
    resendVerification,
    signOut,
    deleteOwnAccount,
  } = useAuth();
  const { productIds: wishlistIds } = useWishlist();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gateMode = searchParams.get('gate') === '1';
  const redirectParam = searchParams.get('redirect') || '';

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>('overview');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [preferredLocale, setPreferredLocale] = useState<Locale>(locale);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const [newAddress, setNewAddress] = useState({
    label: '',
    fullName: '',
    phone: '',
    governorateCode: 'CAIRO',
    city: '',
    area: '',
    street: '',
    building: '',
    floor: '',
    apartment: '',
  });
  const [savingAddress, setSavingAddress] = useState(false);

  const authSchema = z.object({
    displayName: z.string().trim().optional(),
    email: z.string().trim().email(t.auth.emailRequired),
    phone: z.string().trim().optional(),
    password: z.string().min(8, t.auth.passwordMin),
    confirmPassword: z.string().optional(),
  });

  type AuthValues = z.infer<typeof authSchema>;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { displayName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!user) return;
    setProfileName(user.displayName || '');
    fetchCustomerOrders(user.uid)
      .then(setOrders)
      .catch(() => {});

    getDocs(collection(db, 'users', user.uid, 'addresses'))
      .then((snap) => {
        setAddresses(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserAddress, 'id'>) }))
        );
      })
      .catch(() => {});

    getDoc(doc(db, 'users', user.uid, 'private', 'info'))
      .then((snap) => {
        if (snap.exists() && snap.data().phone) {
          setProfilePhone(String(snap.data().phone));
        }
      })
      .catch(() => {});
  }, [user]);

  const navigateIfSafeRedirect = () => {
    if (redirectParam && (redirectParam.startsWith('/ar/') || redirectParam.startsWith('/en/'))) {
      navigate(redirectParam, { replace: true });
    }
  };

  const onSubmit = async (values: AuthValues) => {
    setFeedback(null);
    setErrorMsg(null);
    try {
      if (mode === 'register') {
        if (!values.displayName || values.displayName.trim().length < 2) {
          setErrorMsg(t.auth.nameRequired);
          return;
        }
        const cleanedPhone = (values.phone || '').trim();
        if (cleanedPhone.length < 7 || cleanedPhone.length > 32) {
          setErrorMsg(t.auth.phoneRequired);
          return;
        }
        if (values.password !== values.confirmPassword) {
          setErrorMsg(t.auth.passwordsMismatch);
          return;
        }
        await registerEmail(
          values.displayName,
          values.email,
          cleanedPhone,
          values.password,
          locale
        );
        setFeedback(t.auth.verificationSent);
        navigateIfSafeRedirect();
      } else {
        await signInEmail(values.email, values.password);
        navigateIfSafeRedirect();
      }
    } catch (err) {
      setErrorMsg(getAuthErrorMessage(err, locale, t.auth.authError));
    }
  };

  const handleGoogle = async () => {
    setFeedback(null);
    setErrorMsg(null);
    try {
      await signInGoogle(locale);
      navigateIfSafeRedirect();
    } catch (err) {
      setErrorMsg(getAuthErrorMessage(err, locale, t.auth.authError));
    }
  };

  const handleReset = async () => {
    setFeedback(null);
    setErrorMsg(null);
    const email = getValues('email');
    if (!email || !email.includes('@')) {
      setErrorMsg(t.auth.emailRequired);
      return;
    }
    try {
      await sendResetEmail(email);
      setFeedback(t.auth.resetSent);
    } catch (err) {
      setErrorMsg(getAuthErrorMessage(err, locale, t.auth.authError));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setFeedback(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        await updateDoc(userRef, {
          displayName: profileName.trim().slice(0, 100) || 'Member',
          preferredLocale,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: profileName.trim().slice(0, 100) || 'Member',
          preferredLocale,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (user.email) {
        const privRef = doc(db, 'users', user.uid, 'private', 'info');
        await setDoc(
          privRef,
          {
            uid: user.uid,
            email: user.email,
            phone: profilePhone.trim(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      if (preferredLocale !== locale) {
        switchLocale(preferredLocale);
      }
      setFeedback(t.account.saved);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteOwnAccount = async () => {
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      const hasPasswordProvider = user?.providerData.some((provider) => provider.providerId === 'password');
      await deleteOwnAccount(hasPasswordProvider ? deletePassword : undefined);
      setDeleteDialogOpen(false);
      setDeletePassword('');
      navigate(localePath('/'), { replace: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setDeleteAccountError(code === 'auth/invalid-credential' || code === 'auth/wrong-password'
        ? locale === 'ar' ? 'كلمة المرور غير صحيحة.' : 'The password is incorrect.'
        : code === 'auth/too-many-requests'
          ? locale === 'ar' ? 'محاولات كثيرة. انتظر قليلًا ثم حاول.' : 'Too many attempts. Wait and try again.'
          : code === 'OWNER_ACCOUNT_PROTECTED'
            ? locale === 'ar' ? 'لا يمكن حذف حساب المالك من هذه الصفحة.' : 'The owner account cannot be deleted here.'
            : code === 'RECENT_LOGIN_REQUIRED'
              ? locale === 'ar' ? 'أعد تسجيل الدخول ثم حاول حذف الحساب مرة أخرى.' : 'Sign in again, then retry account deletion.'
              : locale === 'ar' ? 'تعذّر حذف الحساب. حاول مرة أخرى.' : 'Could not delete the account. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAddress(true);
    setErrorMsg(null);
    try {
      const id = `addr_${Date.now()}`;
      const payload = {
        uid: user.uid,
        label: newAddress.label.trim() || 'Home',
        fullName: newAddress.fullName.trim() || profileName || 'Customer',
        phone: newAddress.phone.trim(),
        country: 'Egypt',
        governorateCode: newAddress.governorateCode,
        city: newAddress.city.trim(),
        area: newAddress.area.trim(),
        street: newAddress.street.trim(),
        building: newAddress.building.trim(),
        floor: newAddress.floor.trim(),
        apartment: newAddress.apartment.trim(),
        isDefault: addresses.length === 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', user.uid, 'addresses', id), payload);
      setAddresses((prev) => [...prev, { id, ...payload } as unknown as UserAddress]);
      setNewAddress({
        label: '',
        fullName: '',
        phone: '',
        governorateCode: 'CAIRO',
        city: '',
        area: '',
        street: '',
        building: '',
        floor: '',
        apartment: '',
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'addresses', id));
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-20 bg-black text-white">
        <div className="max-w-md space-y-4">
          <SkeletonBox className="h-8 w-40 bg-neutral-800" />
          <SkeletonBox className="h-12 w-full bg-neutral-800" />
          <SkeletonBox className="h-12 w-full bg-neutral-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-black min-h-[75vh]">
      {!user ? (
        // Luxury Split-Screen Customer Login / Register View Matching Reference
        <div className="min-h-screen bg-black text-white grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Column: Luxury Streetwear Campaign Showcase */}
          <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden bg-neutral-950 items-center justify-center p-12">
            <div className="absolute inset-0 z-0">
              <img
                src={DEFAULT_CAMPAIGN_IMG}
                alt="FAVMO Luxury Streetwear"
                className="w-full h-full object-cover opacity-85 select-none"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black" />
            </div>
            <div className="relative z-10 max-w-lg space-y-6">
              <BrandLogo variant="white" className="[&_img]:h-14" />
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                {locale === 'ar' ? 'ابدع بلا حدود.' : 'CREATE BEYOND LIMITS.'}
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed max-w-md">
                {locale === 'ar'
                  ? 'سجّل دخولك لمتابعة طلباتك، إدارة عناوين التوصيل، وحفظ قطعك المفضلة في متجر FAVMO.'
                  : 'Sign in to inspect your orders, manage delivery addresses, and keep track of your saved streetwear pieces.'}
              </p>
            </div>
          </div>

          {/* Right Column: Sleek Dark Login / Register Form */}
          <div className="lg:col-span-5 flex flex-col justify-center px-6 sm:px-12 py-16 bg-black">
            <div className="max-w-md w-full mx-auto space-y-8">
              <div className="text-center lg:text-start space-y-2">
                <div className="lg:hidden flex justify-center pb-4">
                  <BrandLogo variant="white" className="[&_img]:h-12" />
                </div>
                <h1 className="text-2xl font-semibold tracking-wide">
                  {mode === 'signin' ? t.auth.signIn : t.auth.createAccount}
                </h1>
                <p className="text-xs text-neutral-400">
                  {locale === 'ar' ? 'بوابتك الحصرية لملابس الشارع الفاخرة' : 'Your gateway to premium monochrome streetwear'}
                </p>
              </div>

              {gateMode && (
                <div className="border border-neutral-800 bg-neutral-900 p-4 space-y-1 text-xs">
                  <p className="font-semibold text-white">{t.auth.accountGateTitle}</p>
                  <p className="text-neutral-400">{t.auth.accountGateBody}</p>
                </div>
              )}

              {/* Mode Toggle Tabs */}
              <div className="flex border-b border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setFeedback(null);
                  }}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    mode === 'signin'
                      ? 'border-white text-white'
                      : 'border-transparent text-neutral-500 hover:text-white'
                  }`}
                >
                  {t.auth.signIn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                    setFeedback(null);
                  }}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'border-white text-white'
                      : 'border-transparent text-neutral-500 hover:text-white'
                  }`}
                >
                  {t.auth.createAccount}
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-neutral-400">
                        {t.auth.displayName}
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-neutral-500 absolute top-1/2 -translate-y-1/2 start-3.5" />
                        <input
                          type="text"
                          required
                          placeholder={locale === 'ar' ? 'اسمك الكامل' : 'Full Name'}
                          {...register('displayName')}
                          className="w-full border border-neutral-800 bg-neutral-950 ps-10 pe-4 py-3 text-sm text-white focus:border-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-neutral-400">
                        {t.auth.phone}
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        required
                        placeholder="01012345678"
                        {...register('phone')}
                        className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    {t.auth.email}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-500 absolute top-1/2 -translate-y-1/2 start-3.5" />
                    <input
                      type="email"
                      required
                      dir="ltr"
                      placeholder="name@example.com"
                      {...register('email')}
                      className="w-full border border-neutral-800 bg-neutral-950 ps-10 pe-4 py-3 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>
                  {errors.email && (
                    <p role="alert" className="text-xs text-red-400 font-medium">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    {t.auth.password}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-500 absolute top-1/2 -translate-y-1/2 start-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      dir="ltr"
                      placeholder="••••••••"
                      {...register('password')}
                      className="w-full border border-neutral-800 bg-neutral-950 ps-10 pe-10 py-3 text-sm text-white focus:border-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute top-1/2 -translate-y-1/2 end-3 text-neutral-500 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p role="alert" className="text-xs text-red-400 font-medium">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-400">
                      {t.auth.confirmPassword}
                    </label>
                    <input
                      type="password"
                      required
                      dir="ltr"
                      placeholder="••••••••"
                      {...register('confirmPassword')}
                      className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>
                )}

                {mode === 'signin' && (
                  <div className="text-start">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
                    >
                      {t.auth.forgotPassword}
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <p role="alert" className="text-xs text-red-400 bg-red-950/40 border border-red-800 p-3 font-medium">
                    {errorMsg}
                  </p>
                )}
                {feedback && (
                  <p role="status" className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800 p-3 font-medium">
                    {feedback}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-white text-black py-3.5 text-xs font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{mode === 'signin' ? t.auth.signIn : t.auth.createAccount}</span>
                  <span className="rtl:rotate-180">→</span>
                </button>
              </form>

              {isGoogleConfigured && (
                <div className="pt-2 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    className="w-full border border-neutral-700 bg-neutral-950 py-3 text-xs font-semibold hover:bg-neutral-900 text-white transition-colors cursor-pointer"
                  >
                    {t.auth.googleSignIn}
                  </button>
                </div>
              )}

              <div className="pt-2 text-center">
                <Link to={localePath('/')} className="text-xs text-neutral-500 hover:text-neutral-300">
                  {t.admin.backToStore}
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Authenticated Customer Dashboard View
        <>
          <section className="bg-black text-white py-14 border-b border-neutral-800">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 flex flex-wrap items-center justify-between gap-4">
              <h1
                className={`text-3xl sm:text-4xl font-semibold ${
                  locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
                }`}
              >
                {t.pages.accountTitle}
              </h1>
              {user && isAdmin && (
                <Link
                  to={localePath('/favmo-studio-7k4m9q2x')}
                  className="bg-white text-black px-6 py-3 text-xs font-semibold hover:bg-neutral-200 transition-colors"
                >
                  {t.nav.admin}
                </Link>
              )}
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Sidebar Navigation */}
              <aside className="lg:col-span-3 border border-neutral-200 divide-y divide-neutral-200">
                {(['overview', 'orders', 'addresses', 'profile'] as AccountTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab);
                      setFeedback(null);
                      setErrorMsg(null);
                    }}
                    className={`w-full text-start px-5 py-3.5 text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === tab ? 'bg-black text-white' : 'hover:bg-neutral-50'
                    }`}
                  >
                    {t.account[tab]}
                  </button>
                ))}
                <Link
                  to={localePath('/wishlist')}
                  className="block w-full text-start px-5 py-3.5 text-xs font-semibold hover:bg-neutral-50"
                >
                  {t.account.wishlist} ({wishlistIds.length})
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full text-start px-5 py-3.5 text-xs font-semibold text-neutral-600 hover:text-black hover:bg-neutral-50 cursor-pointer"
                >
                  {t.auth.signOut}
                </button>
              </aside>

              {/* Main Panel */}
              <div className="lg:col-span-9 space-y-6">
                {!user.emailVerified && (
                  <div className="border border-black bg-neutral-50 p-4 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-xs text-black">{t.auth.verifyEmailNotice}</p>
                    <button
                      type="button"
                      onClick={async () => {
                        await resendVerification();
                        setFeedback(t.auth.verificationSent);
                      }}
                      className="border border-black px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer"
                    >
                      {t.auth.resendVerification}
                    </button>
                  </div>
                )}

                {feedback && (
                  <p role="status" className="border border-black p-3 text-xs font-medium">
                    {feedback}
                  </p>
                )}
                {errorMsg && (
                  <p role="alert" className="border border-black p-3 text-xs font-medium">
                    {errorMsg}
                  </p>
                )}

                {activeTab === 'overview' && (
                  <div className="border border-neutral-200 p-6 sm:p-8 space-y-6">
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-500">{t.auth.signedInAs}</p>
                      <p className="text-xl font-semibold">{profileName || user.displayName || user.email}</p>
                      {user.email && (
                        <p className="text-sm text-neutral-600">
                          <Bdi>{user.email}</Bdi>
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-neutral-200 pt-6">
                      <div className="border border-neutral-200 p-4">
                        <p className="text-xs text-neutral-500">{t.account.orders}</p>
                        <p className="text-2xl font-semibold tabular-nums mt-1">{orders.length}</p>
                      </div>
                      <div className="border border-neutral-200 p-4">
                        <p className="text-xs text-neutral-500">{t.account.addresses}</p>
                        <p className="text-2xl font-semibold tabular-nums mt-1">{addresses.length}</p>
                      </div>
                      <div className="border border-neutral-200 p-4">
                        <p className="text-xs text-neutral-500">{t.account.wishlist}</p>
                        <p className="text-2xl font-semibold tabular-nums mt-1">{wishlistIds.length}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    <h2 className="text-base font-semibold">{t.account.orders}</h2>
                    {orders.length === 0 ? (
                      <div className="border border-neutral-200 p-8 text-sm text-neutral-600">
                        {t.account.noOrders}
                      </div>
                    ) : (
                      orders.map((ord) => (
                        <div key={ord.id} className="border border-neutral-200 p-6 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                            <span className="font-mono-code font-bold text-sm">
                              <Bdi>{ord.orderNumber}</Bdi>
                            </span>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="border border-black px-2.5 py-1 font-semibold">
                                {t.orderStatuses[ord.status] || ord.status}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {formatMinorUnits(ord.totalPiasters, locale)}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 text-xs">
                            {(ord.itemsSnapshot || []).map((it, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>
                                  {locale === 'ar' ? it.name_ar : it.name_en} ({it.size} ·{' '}
                                  {locale === 'ar' ? it.colorName_ar : it.colorName_en}) × {it.quantity}
                                </span>
                                <span className="tabular-nums">
                                  {formatMinorUnits(it.lineTotalPiasters, locale)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'addresses' && (
                  <div className="space-y-6">
                    <h2 className="text-base font-semibold">{t.account.addresses}</h2>
                    {addresses.length === 0 ? (
                      <p className="text-sm text-neutral-600">{t.account.noAddresses}</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {addresses.map((addr) => (
                          <div key={addr.id} className="border border-neutral-200 p-5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{addr.label}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAddress(addr.id)}
                                className="text-xs text-neutral-500 hover:text-black underline cursor-pointer"
                              >
                                {t.account.delete}
                              </button>
                            </div>
                            <p className="text-sm font-medium">{addr.fullName}</p>
                            <p className="text-xs text-neutral-600">
                              {addr.street}, {addr.building}, {addr.area}, {addr.city}
                            </p>
                            <p className="text-xs text-neutral-500" dir="ltr">
                              {addr.phone}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleAddAddress} className="border border-neutral-200 p-6 space-y-4">
                      <h3 className="text-xs font-semibold">{t.account.addAddress}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder={t.account.addressLabel}
                          value={newAddress.label}
                          onChange={(e) => setNewAddress((a) => ({ ...a, label: e.target.value }))}
                          className="border border-neutral-300 px-3 py-2.5 text-sm"
                        />
                        <input
                          type="text"
                          required
                          placeholder={t.checkout.fullName}
                          value={newAddress.fullName}
                          onChange={(e) => setNewAddress((a) => ({ ...a, fullName: e.target.value }))}
                          className="border border-neutral-300 px-3 py-2.5 text-sm"
                        />
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          placeholder={t.checkout.phone}
                          value={newAddress.phone}
                          onChange={(e) => setNewAddress((a) => ({ ...a, phone: e.target.value }))}
                          className="border border-neutral-300 px-3 py-2.5 text-sm"
                        />
                        <select
                          value={newAddress.governorateCode}
                          onChange={(e) =>
                            setNewAddress((a) => ({ ...a, governorateCode: e.target.value }))
                          }
                          className="border border-neutral-300 bg-white px-3 py-2.5 text-sm"
                        >
                          {EGYPT_GOVERNORATES.map((g) => (
                            <option key={g.code} value={g.code}>
                              {locale === 'ar' ? g.name_ar : g.name_en}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          placeholder={t.checkout.city}
                          value={newAddress.city}
                          onChange={(e) => setNewAddress((a) => ({ ...a, city: e.target.value }))}
                          className="border border-neutral-300 px-3 py-2.5 text-sm"
                        />
                        <input
                          type="text"
                          required
                          placeholder={t.checkout.area}
                          value={newAddress.area}
                          onChange={(e) => setNewAddress((a) => ({ ...a, area: e.target.value }))}
                          className="border border-neutral-300 px-3 py-2.5 text-sm"
                        />
                        <input
                          type="text"
                          required
                          placeholder={t.checkout.street}
                          value={newAddress.street}
                          onChange={(e) => setNewAddress((a) => ({ ...a, street: e.target.value }))}
                          className="border border-neutral-300 px-3 py-2.5 text-sm"
                        />
                        <input
                          type="text"
                          required
                          placeholder={t.checkout.building}
                          value={newAddress.building}
                          onChange={(e) => setNewAddress((a) => ({ ...a, building: e.target.value }))}
                          className="border border-neutral-300 px-3 py-2.5 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingAddress}
                        className="bg-black text-white px-6 py-3 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
                      >
                        {t.account.addAddress}
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === 'profile' && (
                  <>
                  <form onSubmit={handleSaveProfile} className="border border-neutral-200 p-6 sm:p-8 space-y-5 max-w-lg">
                    <h2 className="text-base font-semibold">{t.account.profile}</h2>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-neutral-700">
                        {t.auth.displayName}
                      </label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full border border-neutral-300 px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-neutral-700">
                        {t.checkout.phone}
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full border border-neutral-300 px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-neutral-700">
                        {t.account.preferredLanguage}
                      </label>
                      <select
                        value={preferredLocale}
                        onChange={(e) => setPreferredLocale(e.target.value as Locale)}
                        className="w-full border border-neutral-300 bg-white px-3.5 py-2.5 text-sm"
                      >
                        <option value="ar">العربية</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="bg-black text-white px-6 py-3 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
                    >
                      {t.account.saveProfile}
                    </button>
                  </form>
                  {adminRole !== 'owner' && (
                    <section className="mt-6 max-w-lg border border-red-200 bg-white p-6 sm:p-8">
                      <h2 className="text-base font-semibold text-red-800">{locale === 'ar' ? 'حذف الحساب' : 'Delete account'}</h2>
                      <p className="mt-2 text-xs leading-6 text-neutral-600">
                        {adminRole === 'staff'
                          ? locale === 'ar' ? 'سيُحذف حساب الموظف وصلاحياته وبيانات الملف الشخصي. ستظل سجلات الطلبات محفوظة.' : 'Your staff account, permissions, and profile data will be removed. Order records will remain.'
                          : locale === 'ar' ? 'سيُحذف حسابك وبيانات الملف الشخصي والعناوين والتقييمات. ستظل سجلات الطلبات محفوظة.' : 'Your account, profile, addresses, and reviews will be removed. Order records will remain.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => { setDeleteAccountError(null); setDeleteDialogOpen(true); }}
                        className="mt-5 border border-red-700 px-4 py-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-700 hover:text-white"
                      >
                        {locale === 'ar' ? 'طلب حذف الحساب' : 'Delete my account'}
                      </button>
                    </section>
                  )}
                  {deleteDialogOpen && adminRole !== 'owner' && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6" role="presentation">
                      <div role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-md space-y-5 bg-white p-6 text-black shadow-2xl sm:p-8">
                        <div>
                          <h2 id="delete-account-title" className="text-lg font-semibold text-red-800">{locale === 'ar' ? 'تأكيد حذف الحساب' : 'Confirm account deletion'}</h2>
                          <p className="mt-2 text-xs leading-6 text-neutral-600">
                            {locale === 'ar' ? 'هذا الإجراء لا يمكن التراجع عنه. سجلات الطلبات ستبقى محفوظة، وسيتم حذف بيانات الحساب وصلاحيات الموظف إن وُجدت.' : 'This cannot be undone. Order records will remain; account data and staff permissions, if any, will be removed.'}
                          </p>
                        </div>
                        {user.providerData.some((provider) => provider.providerId === 'password') && (
                          <label className="block space-y-2 text-xs font-medium">
                            <span>{locale === 'ar' ? 'أدخل كلمة المرور للتأكيد' : 'Enter your password to confirm'}</span>
                            <input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className="w-full border border-neutral-300 px-3 py-2.5 text-sm" />
                          </label>
                        )}
                        {deleteAccountError && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{deleteAccountError}</p>}
                        <div className="flex flex-wrap justify-end gap-3">
                          <button type="button" disabled={deletingAccount} onClick={() => { setDeleteDialogOpen(false); setDeletePassword(''); }} className="border border-neutral-300 px-4 py-2.5 text-xs text-neutral-700 disabled:opacity-50">{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                          <button type="button" disabled={deletingAccount || (user.providerData.some((provider) => provider.providerId === 'password') && !deletePassword)} onClick={handleDeleteOwnAccount} className="bg-red-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{deletingAccount ? (locale === 'ar' ? 'جارٍ الحذف...' : 'Deleting...') : (locale === 'ar' ? 'تأكيد الحذف' : 'Confirm deletion')}</button>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
