import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderTree,
  Globe,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Percent,
  Plus,
  PlusSquare,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  User,
  UserCog,
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import {
  fetchAdminProfileDoc,
  fetchAllCustomersAdmin,
  fetchAllDiscountsAdmin,
  fetchAllOrdersAdmin,
  fetchAllProductsAdmin,
  fetchAllReviewsAdmin,
  fetchAllVariantsAdmin,
  fetchAuditLogsAdmin,
  fetchCollections,
  fetchShippingZones,
  fetchStockMovementsAdmin,
} from '../lib/storeService';
import { summarizeProductStock, type AdminNavigateFn } from '../lib/adminAnalytics';
import { formatMinorUnits } from '../lib/currency';
import type {
  AdminPermission,
  AdminTab,
  AuditLogEntry,
  Collection,
  CustomerSummary,
  Discount,
  Order,
  Product,
  ProductReview,
  ProductVariant,
  ShippingZone,
  StockMovement,
  StaffApplication,
} from '../types/domain';
import { BrandLogo } from '../components/BrandLogo';
import { Bdi } from '../components/Bdi';
import { AdminDashboardOverview } from '../components/admin/AdminDashboardOverview';
import { AdminProductsPanel } from '../components/admin/AdminProductsPanel';
import { AdminCategoriesPanel } from '../components/admin/AdminCategoriesPanel';
import { AdminOrdersPanel } from '../components/admin/AdminOrdersPanel';
import { AdminInventoryPanel } from '../components/admin/AdminInventoryPanel';
import { AdminCustomersPanel } from '../components/admin/AdminCustomersPanel';
import { AdminDiscountsPanel } from '../components/admin/AdminDiscountsPanel';
import { AdminReviewsPanel } from '../components/admin/AdminReviewsPanel';
import { AdminAnalyticsPanel } from '../components/admin/AdminAnalyticsPanel';
import { AdminContactSocialPanel } from '../components/admin/AdminContactSocialPanel';
import { AdminContactMessagesPanel } from '../components/admin/AdminContactMessagesPanel';
import { AdminContentPanel } from '../components/admin/AdminContentPanel';
import { AdminSettingsPanel } from '../components/admin/AdminSettingsPanel';
import { AdminMyAccountPanel } from '../components/admin/AdminMyAccountPanel';
import { AdminStaffApplicationsPanel } from '../components/admin/AdminStaffApplicationsPanel';

export function AdminPage() {
  const { locale, switchLocale, t, localePath } = useLocale();
  const {
    user,
    loading: authLoading,
    isAdmin,
    adminRole,
    adminPermissions,
    getIdToken,
    signInEmail,
    setupOwnerAdmin,
    resendOwnerVerification,
    verifyAdminSession,
    signOut,
  } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dedicated Admin Login state
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [ownerSetupNotice, setOwnerSetupNotice] = useState<string | null>(null);
  const [canResendOwnerVerification, setCanResendOwnerVerification] = useState(false);

  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);
  const [adminProfileMeta, setAdminProfileMeta] = useState<{
    displayName: string;
    photoUrl: string;
  }>({
    displayName: '',
    photoUrl: '',
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [staffApplications, setStaffApplications] = useState<StaffApplication[]>([]);

  const headerControlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab('dashboard');
    setProducts([]);
    setVariants([]);
    setCollections([]);
    setOrders([]);
    setDiscounts([]);
    setReviews([]);
    setShippingZones([]);
    setMovements([]);
    setCustomers([]);
    setAuditLogs([]);
    setStaffApplications([]);
    setAdminProfileMeta({ displayName: '', photoUrl: '' });
  }, [user?.uid]);

  const loadAll = useCallback(async () => {
    if (!isAdmin || !user) return;
    setRefreshing(true);
    try {
      const staffApplicationsPromise: Promise<StaffApplication[]> = adminRole === 'owner'
        ? getIdToken().then(async (token) => {
            if (!token) return [];
            const response = await fetch('/api/admin/staff-applications', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return [];
            const payload = await response.json() as { applications?: StaffApplication[] };
            return payload.applications || [];
          }).catch(() => [])
        : Promise.resolve([]);
      const [p, v, c, o, d, rv, sz, mv, cu, logs, adminDoc, applications] = await Promise.all([
        fetchAllProductsAdmin().catch(() => []),
        fetchAllVariantsAdmin().catch(() => []),
        fetchCollections(true).catch(() => []),
        fetchAllOrdersAdmin().catch(() => []),
        fetchAllDiscountsAdmin().catch(() => []),
        fetchAllReviewsAdmin().catch(() => []),
        fetchShippingZones(true).catch(() => []),
        fetchStockMovementsAdmin().catch(() => []),
        fetchAllCustomersAdmin().catch(() => []),
        fetchAuditLogsAdmin().catch(() => []),
        fetchAdminProfileDoc(user.uid).catch(() => null),
        staffApplicationsPromise,
      ]);
      setProducts(p);
      setVariants(v);
      setCollections(c);
      setOrders(o);
      setDiscounts(d);
      setReviews(rv);
      setShippingZones(sz);
      setMovements(mv);
      setCustomers(cu);
      setAuditLogs(logs);
      setStaffApplications(applications);
      if (adminDoc) {
        setAdminProfileMeta({
          displayName: adminDoc.displayName || user.displayName || (adminRole === 'staff' ? 'FAVMO Staff' : 'FAVMO Owner'),
          photoUrl: adminDoc.photoUrl || user.photoURL || '',
        });
      } else {
        setAdminProfileMeta({
          displayName: user.displayName || (adminRole === 'staff' ? 'FAVMO Staff' : 'FAVMO Owner'),
          photoUrl: user.photoURL || '',
        });
      }
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, [isAdmin, user, adminRole, getIdToken]);

  useEffect(() => {
    if (!authLoading && isAdmin && user) {
      loadAll();
      getIdToken()
        .then((token) => {
          if (!token) {
            setServerVerified(false);
            return;
          }
          if (adminRole === 'staff') {
            setServerVerified(true);
            return;
          }
          return fetch('/api/admin/verify', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => setServerVerified(res.ok))
            .catch(() => setServerVerified(false));
        })
        .catch(() => setServerVerified(false));
    } else if (!authLoading) {
      setLoadingData(false);
    }
  }, [authLoading, isAdmin, adminRole, user, loadAll, getIdToken]);

  useEffect(() => {
    if (authLoading || adminRole !== 'owner') return;
    let cancelled = false;
    const refreshApplications = async () => {
      const token = await getIdToken();
      if (!token) return;
      try {
        const response = await fetch('/api/admin/staff-applications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const payload = await response.json() as { applications?: StaffApplication[] };
        if (!cancelled) setStaffApplications(payload.applications || []);
      } catch {
        // Keep the last known request list if the connection is temporarily unavailable.
      }
    };
    void refreshApplications();
    const timer = window.setInterval(refreshApplications, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authLoading, adminRole, getIdToken]);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginLoading(true);
    setAdminLoginError(null);
    setOwnerSetupNotice(null);
    setCanResendOwnerVerification(false);
    try {
      await signInEmail(adminEmailInput, adminPasswordInput);
      await verifyAdminSession();
    } catch (err) {
      const code =
        err instanceof Error && err.message.startsWith('ADMIN_')
          ? err.message
          : typeof err === 'object' && err !== null && 'code' in err
            ? String(err.code)
            : '';
      setCanResendOwnerVerification(code === 'ADMIN_EMAIL_UNVERIFIED');
      if (code.startsWith('ADMIN_')) await signOut().catch(() => {});
      setAdminLoginError(code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password'
        ? locale === 'ar'
          ? 'البريد أو كلمة المرور غير صحيحين. تأكد من البيانات أو استخدم استعادة كلمة المرور من Firebase.'
          : 'Email or password is incorrect. Check the credentials or reset the password in Firebase.'
        : code === 'ADMIN_EMAIL_UNVERIFIED'
          ? locale === 'ar'
            ? 'الحساب صحيح، لكن البريد غير مؤكّد. أعد إرسال رسالة التأكيد من الزر أدناه.'
            : 'The account is valid, but its email is not verified. Resend the verification email below.'
          : code === 'ADMIN_STAFF_PASSWORD_SETUP_REQUIRED'
            ? locale === 'ar'
              ? 'وافق المدير على الطلب. افتح رسالة إعادة تعيين كلمة المرور، اختر كلمة جديدة، ثم سجّل الدخول مرة أخرى.'
              : 'The owner approved this request. Open the password setup email, choose a new password, then sign in again.'
          : code === 'ADMIN_STAFF_NOT_APPROVED'
            ? locale === 'ar'
              ? 'هذا الحساب لم يحصل على صلاحية الموظف بعد. انتظر موافقة المدير على طلب الانضمام.'
              : 'This account is not approved for staff access yet. Wait for the owner to review the application.'
          : code === 'ADMIN_NOT_AUTHORIZED'
            ? locale === 'ar'
              ? 'هذا الحساب غير معتمد كبوابة المالك في إعدادات الخادم.'
              : 'This account is not authorized as the owner in the server configuration.'
            : locale === 'ar'
              ? 'تعذّر الاتصال بخادم الإدارة. تأكد أن الخادم المحلي يعمل وحاول مجددًا.'
              : 'Could not reach the admin server. Make sure the local server is running and try again.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleResendOwnerVerification = async () => {
    setAdminLoginLoading(true);
    setAdminLoginError(null);
    setOwnerSetupNotice(null);
    try {
      await resendOwnerVerification(adminEmailInput, adminPasswordInput);
      setAdminPasswordInput('');
      setCanResendOwnerVerification(false);
      setOwnerSetupNotice(locale === 'ar'
        ? 'أُرسلت رسالة تأكيد جديدة. افتحها ثم ارجع لتسجيل الدخول.'
        : 'A new verification email was sent. Open it, then return to sign in.');
    } catch (err) {
      const code = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'code' in err
          ? String(err.code)
          : '';
      setAdminLoginError(code === 'EMAIL_ALREADY_VERIFIED'
        ? locale === 'ar'
          ? 'البريد مؤكّد بالفعل. سجّل الدخول مرة أخرى.'
          : 'The email is already verified. Sign in again.'
        : code === 'UNAUTHORIZED_OWNER_ONLY'
          ? locale === 'ar'
            ? 'هذا الحساب غير معتمد كبوابة المالك.'
            : 'This account is not authorized as the owner.'
          : code === 'auth/invalid-credential'
            ? locale === 'ar'
              ? 'كلمة المرور غير صحيحة؛ لا يمكن إرسال رسالة التأكيد.'
              : 'The password is incorrect, so the verification email could not be sent.'
            : code === 'RATE_LIMIT_EXCEEDED'
              ? locale === 'ar'
                ? 'تم طلب رسائل كثيرة. انتظر قليلًا قبل المحاولة مجددًا.'
                : 'Too many requests. Wait before trying again.'
              : locale === 'ar'
                ? 'تعذّر إرسال رسالة التأكيد. حاول مرة أخرى.'
                : 'Could not send the verification email. Try again.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleOwnerAccountSetup = async () => {
    setAdminLoginError(null);
    setOwnerSetupNotice(null);
    setCanResendOwnerVerification(false);
    if (!adminEmailInput.trim() || !adminEmailInput.includes('@')) {
      setAdminLoginError(
        locale === 'ar' ? 'اكتب بريد الحساب أولًا.' : 'Enter the account email first.'
      );
      return;
    }
    if (adminPasswordInput.length < 8) {
      setAdminLoginError(
        locale === 'ar'
          ? 'اكتب كلمة مرور من 8 أحرف على الأقل لإنشاء حساب المالك.'
          : 'Enter a password with at least 8 characters to create the owner account.'
      );
      return;
    }

    setAdminLoginLoading(true);
    try {
      await setupOwnerAdmin(adminEmailInput, adminPasswordInput);
      setAdminPasswordInput('');
      setOwnerSetupNotice(
        locale === 'ar'
          ? 'أُنشئ الحساب وأُرسلت رسالة تأكيد إلى البريد. أكّده ثم سجّل الدخول؛ صلاحية الإدارة تُمنح للحساب المعتمد فقط.'
          : 'The account was created and a verification email was sent. Verify it, then sign in; only the approved owner can access admin.'
      );
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String(err.code)
          : '';
      setAdminLoginError(
        code === 'auth/email-already-in-use'
          ? locale === 'ar'
            ? 'الحساب موجود بالفعل. استخدم تسجيل الدخول أو استعادة كلمة المرور.'
            : 'This account already exists. Sign in or reset its password.'
          : code === 'auth/weak-password'
            ? locale === 'ar'
              ? 'كلمة المرور ضعيفة. اختر كلمة مرور أقوى.'
              : 'The password is too weak. Choose a stronger password.'
            : locale === 'ar'
              ? 'تعذّر إعداد الحساب. تحقق من إعداد Firebase وحاول مرة أخرى.'
              : 'Could not set up the account. Check Firebase setup and try again.'
      );
    } finally {
      setAdminLoginLoading(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        headerControlsRef.current &&
        !headerControlsRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileMenuOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleNavigate: AdminNavigateFn = useCallback((tab, options) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setNotifOpen(false);
    setProfileMenuOpen(false);
    setSearchOpen(false);
    if (options?.orderId) {
      setSelectedOrderId(options.orderId);
    }
    if (options?.search !== undefined) {
      setGlobalSearch(options.search);
    }
  }, []);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    await signOut();
    setProducts([]);
    setVariants([]);
    setCollections([]);
    setOrders([]);
    setDiscounts([]);
    setReviews([]);
    setShippingZones([]);
    setMovements([]);
    setCustomers([]);
    setAuditLogs([]);
    setStaffApplications([]);
    navigate(localePath('/favmo-studio-7k4m9q2x'));
  };

  // Real notifications derived directly from Firestore records
  const notifications = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'order' | 'stock' | 'staff';
      title: string;
      subtitle: string;
      severity: 'high' | 'warn';
      onClick: () => void;
    }> = [];

    if (adminRole === 'owner') {
      for (const application of staffApplications.filter((item) => item.status === 'pending').slice(0, 6)) {
        items.push({
          id: `staff-${application.id}`,
          kind: 'staff',
          severity: 'warn',
          title: locale === 'ar' ? `طلب انضمام جديد — ${application.displayName}` : `New team application — ${application.displayName}`,
          subtitle: locale === 'ar' ? 'مراجعة الطلب وتحديد الصلاحيات' : 'Review application and choose permissions',
          onClick: () => handleNavigate('staff-applications'),
        });
      }
    }

    const awaitingOrders = orders.filter(
      (o) =>
        o.status === 'pending' ||
        o.paymentStatus === 'awaiting_verification'
    );
    for (const o of awaitingOrders.slice(0, 6)) {
      items.push({
        id: `ord-${o.id}`,
        kind: 'order',
        severity: o.paymentStatus === 'awaiting_verification' ? 'high' : 'warn',
        title:
          o.paymentStatus === 'awaiting_verification'
            ? locale === 'ar'
              ? `مراجعة إيصال دفع — ${o.orderNumber}`
              : `Verify receipt — ${o.orderNumber}`
            : locale === 'ar'
              ? `طلب قيد الانتظار — ${o.orderNumber}`
              : `Pending order — ${o.orderNumber}`,
        subtitle: `${o.shippingAddress?.fullName || '—'} · ${formatMinorUnits(o.totalPiasters, locale)}`,
        onClick: () => handleNavigate('orders', { orderId: o.id }),
      });
    }

    const stockSummary = summarizeProductStock(products, variants);
    for (const item of stockSummary.outOfStockProducts.slice(0, 4)) {
      items.push({
        id: `out-${item.product.id}`,
        kind: 'stock',
        severity: 'high',
        title: locale === 'ar' ? item.product.name_ar : item.product.name_en,
        subtitle: t.badges.soldOut,
        onClick: () => handleNavigate('inventory'),
      });
    }
    for (const item of stockSummary.lowStockProducts.slice(0, 4)) {
      items.push({
        id: `low-${item.product.id}`,
        kind: 'stock',
        severity: 'warn',
        title: locale === 'ar' ? item.product.name_ar : item.product.name_en,
        subtitle: `${t.badges.lowStock} (${item.totalStock})`,
        onClick: () => handleNavigate('inventory'),
      });
    }

    return items;
  }, [orders, products, variants, locale, t, handleNavigate, adminRole, staffApplications]);

  // Global quick search matches across products, orders, and customers
  const quickSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return { products: [], orders: [], customers: [] };

    return {
      products: products
        .filter(
          (p) =>
            p.name_en.toLowerCase().includes(q) ||
            p.name_ar.toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q)
        )
        .slice(0, 4),
      orders: orders
        .filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(q) ||
            (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
            (o.shippingAddress?.phone || '').toLowerCase().includes(q)
        )
        .slice(0, 4),
      customers: customers
        .filter(
          (c) =>
            c.displayName.toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q)
        )
        .slice(0, 4),
    };
  }, [globalSearch, products, orders, customers]);

  const hasQuickMatches =
    quickSearchResults.products.length > 0 ||
    quickSearchResults.orders.length > 0 ||
    quickSearchResults.customers.length > 0;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center text-xs tracking-[0.2em] uppercase">
        FAVMO
      </div>
    );
  }

  // Dedicated Admin Login Form in the exact Admin position when not authenticated as the owner
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12">
          <section className="relative min-h-[36vh] overflow-hidden bg-neutral-950 lg:col-span-7 lg:min-h-screen">
            <img
              src="/assets/aistudio/favmo-login-showcase.png"
              alt="FAVMO Luxury Streetwear"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/10 lg:bg-gradient-to-l lg:from-black/70 lg:via-transparent lg:to-black/10" />
            <div className="absolute inset-x-6 bottom-6 z-10 space-y-3 sm:inset-x-10 sm:bottom-10 lg:inset-x-14 lg:bottom-14">
              <BrandLogo variant="white" className="[&_img]:h-10 sm:[&_img]:h-12" />
              <p className="text-xl font-semibold sm:text-2xl">
                {locale === 'ar' ? 'بوابة إدارة FAVMO' : 'FAVMO ADMIN PORTAL'}
              </p>
            </div>
          </section>

          <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:col-span-5 lg:px-12">
            <div className="w-full max-w-md space-y-6">
              <div className="space-y-3 text-center lg:text-start">
                <div className="mx-auto flex h-12 w-12 items-center justify-center border border-neutral-700 bg-white/5 lg:mx-0">
                  <ShieldCheck className="h-6 w-6 text-white" strokeWidth={1.6} />
                </div>
                <h1 className="text-xl font-semibold tracking-wide uppercase">
                  {locale === 'ar' ? 'تسجيل دخول المالك' : 'OWNER SIGN IN'}
                </h1>
                <p className="text-xs text-neutral-400">
                  {locale === 'ar'
                    ? 'دخول الإدارة مخصص لحساب المالك الموثق.'
                    : 'Admin access is limited to the verified owner account.'}
                </p>
              </div>

              {user && !isAdmin && (
                <div className="space-y-2 border border-amber-700/40 bg-amber-950/30 p-3 text-xs text-amber-300">
                  <p>
                    {!user.emailVerified
                      ? locale === 'ar'
                        ? 'أكّد البريد من رسالة Firebase، ثم سجّل الخروج وادخل مرة أخرى.'
                        : 'Verify your email using the Firebase message, then sign out and sign in again.'
                      : locale === 'ar'
                        ? 'هذا الحساب غير مخوّل لدخول الإدارة.'
                        : 'This account is not authorized for admin access.'}
                  </p>
                  <button
                    type="button"
                    onClick={signOut}
                    className="bg-white px-3 py-1.5 font-semibold text-black hover:bg-neutral-200"
                  >
                    {t.auth.signOut}
                  </button>
                </div>
              )}

              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    {locale === 'ar' ? 'البريد الإلكتروني' : 'Email address'}
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    autoComplete="username"
                    value={adminEmailInput}
                    onChange={(e) => setAdminEmailInput(e.target.value)}
                    className="w-full border border-neutral-800 bg-neutral-950 px-3.5 py-3 text-sm text-white font-mono-code focus:border-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    {locale === 'ar' ? 'كلمة المرور' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="current-password"
                    dir="ltr"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="w-full border border-neutral-700 bg-black px-3.5 py-3 text-sm text-white font-mono-code focus:border-white focus:outline-none"
                  />
                </div>

                {adminLoginError && (
                  <p role="alert" className="border border-red-800 bg-red-950/40 p-3 text-xs font-medium text-red-300">
                    {adminLoginError}
                  </p>
                )}
                {canResendOwnerVerification && (
                  <button
                    type="button"
                    onClick={handleResendOwnerVerification}
                    disabled={adminLoginLoading}
                    className="w-full border border-neutral-600 py-2.5 text-xs text-neutral-200 transition-colors hover:border-white disabled:opacity-50"
                  >
                    {locale === 'ar' ? 'إعادة إرسال تأكيد البريد' : 'Resend email verification'}
                  </button>
                )}
                {ownerSetupNotice && (
                  <p role="status" className="border border-emerald-800 bg-emerald-950/40 p-3 text-xs font-medium text-emerald-300">
                    {ownerSetupNotice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={adminLoginLoading}
                  className="w-full bg-white py-3.5 text-xs font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
                >
                  {adminLoginLoading
                    ? locale === 'ar'
                      ? 'جارٍ التحقق...'
                      : 'AUTHENTICATING...'
                    : locale === 'ar'
                      ? 'تسجيل دخول الإدارة'
                      : 'SIGN IN TO ADMIN'}
                </button>
              </form>

              <button
                type="button"
                disabled={adminLoginLoading}
                onClick={handleOwnerAccountSetup}
                className="w-full border border-neutral-700 py-3 text-xs text-neutral-300 transition-colors hover:border-white hover:text-white disabled:opacity-50"
              >
                {locale === 'ar' ? 'إنشاء الحساب وإرسال تأكيد البريد' : 'Create account and send email verification'}
              </button>
              <p className="text-center text-[11px] leading-5 text-neutral-500">
                {locale === 'ar'
                  ? 'صفحة الإدارة منفصلة عن حسابات العملاء. الخادم وحده يحدد الحساب المصرح له.'
                  : 'This portal is separate from customer accounts. The server alone decides which account is authorized.'}
              </p>

              <div className="border-t border-neutral-900 pt-4 text-center">
                <Link
                  to={localePath('/')}
                  className="text-xs text-neutral-400 underline hover:text-white"
                >
                  {t.admin.backToStore}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const pendingBadgeCount = orders.filter(
    (o) => o.status === 'pending' || o.paymentStatus === 'awaiting_verification'
  ).length;

  const sidebarItems: Array<{
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }> = [
    { id: 'dashboard', label: t.admin.tabs.dashboard, icon: LayoutDashboard },
    { id: 'products', label: t.admin.tabs.products, icon: Tag },
    { id: 'add-product', label: t.admin.tabs['add-product'], icon: PlusSquare },
    { id: 'categories', label: t.admin.tabs.categories, icon: FolderTree },
    { id: 'inventory', label: t.admin.tabs.inventory, icon: Boxes },
    {
      id: 'orders',
      label: t.admin.tabs.orders,
      icon: ShoppingBag,
      badge: pendingBadgeCount > 0 ? pendingBadgeCount : undefined,
    },
    { id: 'customers', label: t.admin.tabs.customers, icon: Users },
    { id: 'discounts', label: t.admin.tabs.discounts, icon: Percent },
    { id: 'reviews', label: t.admin.tabs.reviews, icon: MessageSquare },
    { id: 'analytics', label: t.admin.tabs.analytics, icon: BarChart3 },
    { id: 'settings', label: t.admin.tabs.settings, icon: Settings },
    { id: 'content', label: locale === 'ar' ? 'محتوى الموقع' : 'Website content', icon: FileText },
    { id: 'social', label: t.admin.tabs.social, icon: Share2 },
    ...(adminRole === 'owner' ? [{ id: 'contact-messages' as const, label: locale === 'ar' ? 'رسائل العملاء' : 'Customer messages', icon: Mail }] : []),
    { id: 'my-account', label: t.admin.tabs['my-account'], icon: UserCog },
    ...(adminRole === 'owner' ? [{
      id: 'staff-applications' as const,
      label: locale === 'ar' ? 'طلبات الموظفين' : 'Staff applications',
      icon: UserRoundPlus,
      badge: staffApplications.filter((application) => application.status === 'pending').length || undefined,
    }] : []),
  ];

  const permissionForTab: Partial<Record<AdminTab, AdminPermission>> = {
    products: 'catalog',
    'add-product': 'catalog',
    categories: 'catalog',
    inventory: 'inventory',
    orders: 'orders',
    customers: 'customers',
    discounts: 'discounts',
    reviews: 'reviews',
    analytics: 'analytics',
    settings: 'settings',
    content: 'content',
    social: 'content',
  };
  const visibleSidebarItems = sidebarItems.filter((item) =>
    adminRole === 'owner' || item.id === 'dashboard' ||
    Boolean(permissionForTab[item.id] && adminPermissions.includes(permissionForTab[item.id]!))
  );

  const displayOwnerName = adminProfileMeta.displayName || user.displayName || (adminRole === 'staff' ? 'FAVMO Staff' : 'FAVMO Owner');
  const displayOwnerPhoto = adminProfileMeta.photoUrl || user.photoURL || '';

  const renderSidebarNav = () => (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Sidebar Brand Header */}
      <div className="h-16 px-5 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo variant="white" className="[&_img]:h-8 [&_img]:w-8" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white">FAVMO</p>
            <p className="text-[10px] text-neutral-400 truncate">
              {adminRole === 'staff' ? (locale === 'ar' ? 'حساب موظف' : 'STAFF ACCOUNT') : (locale === 'ar' ? 'الإدارة التنفيذية' : 'ADMIN STUDIO')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden text-neutral-400 hover:text-white p-1"
          aria-label={t.nav.close}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar 13 Primary Sections */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {visibleSidebarItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-white text-black font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.6} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    active ? 'bg-black text-white' : 'bg-neutral-800 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar #14: Logout */}
      <div className="p-3 border-t border-neutral-800 shrink-0 space-y-2">
        <div className="px-3 py-2 bg-neutral-950 border border-neutral-800">
          <p className="text-[11px] font-medium text-white truncate">{displayOwnerName}</p>
          <p className="text-[10px] text-neutral-500 truncate" dir="ltr">
            {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.6} />
          <span>{t.admin.tabs.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-black">
      {/* Desktop Fixed Black Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 start-0 w-64 border-e border-neutral-800 z-40 print:hidden">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Slide-Over Black Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 start-0 w-72 max-w-[85vw] z-50 border-e border-neutral-800">
            {renderSidebarNav()}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="lg:ps-64 min-h-screen flex flex-col">
        {/* Crisp White Admin Top Header */}
        <header
          ref={headerControlsRef}
          className="sticky top-0 z-30 h-16 bg-white border-b border-neutral-200 px-4 sm:px-8 flex items-center justify-between gap-3 print:hidden"
        >
          {/* Left: Mobile drawer toggle + Logo + Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden border border-neutral-300 p-2 text-black hover:border-black cursor-pointer"
              aria-label={t.nav.menu}
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="lg:hidden shrink-0">
              <BrandLogo variant="black" className="[&_img]:h-7" />
            </div>
            <div className="min-w-0">
              <h1
                className={`text-base sm:text-lg font-semibold text-black truncate ${
                  locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
                }`}
              >
                {activeTab === 'staff-applications'
                  ? locale === 'ar' ? 'طلبات الموظفين' : 'Staff applications'
                  : activeTab === 'contact-messages'
                    ? locale === 'ar' ? 'رسائل العملاء' : 'Customer messages'
                  : t.admin.tabs[activeTab]}
              </h1>
            </div>
          </div>

          {/* Center: Global Quick Search */}
          <div className="hidden md:block relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="search"
              value={globalSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setSearchOpen(true);
              }}
              placeholder={
                locale === 'ar'
                  ? 'بحث سريع: منتج، طلب، عميل...'
                  : 'Quick search: products, orders, customers...'
              }
              className="w-full border border-neutral-300 bg-neutral-50 ps-9 pe-8 py-2 text-xs text-black placeholder:text-neutral-400 focus:bg-white focus:border-black focus:outline-none"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 text-neutral-400 hover:text-black cursor-pointer"
                aria-label={t.nav.close}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {searchOpen && globalSearch.trim() !== '' && (
              <div className="absolute top-full mt-1 inset-x-0 bg-white border border-neutral-200 shadow-lg z-40 max-h-80 overflow-y-auto divide-y divide-neutral-100">
                {!hasQuickMatches ? (
                  <p className="p-4 text-xs text-neutral-500 text-center">
                    {locale === 'ar' ? 'لا توجد نتائج مطابقة.' : 'No matching records found.'}
                  </p>
                ) : (
                  <>
                    {quickSearchResults.orders.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          {t.admin.tabs.orders}
                        </p>
                        {quickSearchResults.orders.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => handleNavigate('orders', { orderId: o.id })}
                            className="w-full text-start px-2 py-1.5 text-xs hover:bg-neutral-100 flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="font-mono-code font-semibold text-black">
                              <Bdi>{o.orderNumber}</Bdi>
                            </span>
                            <span className="text-neutral-500 truncate">
                              {o.shippingAddress?.fullName}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {quickSearchResults.products.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          {t.admin.tabs.products}
                        </p>
                        {quickSearchResults.products.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleNavigate('products', { search: globalSearch })}
                            className="w-full text-start px-2 py-1.5 text-xs hover:bg-neutral-100 flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="font-medium text-black truncate">
                              {locale === 'ar' ? p.name_ar : p.name_en}
                            </span>
                            <span className="text-neutral-500 font-mono-code text-[11px]">
                              {p.sku}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {quickSearchResults.customers.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          {t.admin.tabs.customers}
                        </p>
                        {quickSearchResults.customers.map((c) => (
                          <button
                            key={c.uid}
                            type="button"
                            onClick={() => handleNavigate('customers', { search: globalSearch })}
                            className="w-full text-start px-2 py-1.5 text-xs hover:bg-neutral-100 flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="font-medium text-black truncate">{c.displayName}</span>
                            <span className="text-neutral-500 text-[11px] truncate" dir="ltr">
                              {c.email || c.phone}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick Actions + Refresh + Language + Notifications + Admin Profile */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('add-product')}
              className="hidden sm:inline-flex items-center gap-1.5 bg-black text-white px-3.5 py-2 text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.admin.quickAddProduct}</span>
            </button>

            <Link
              to={localePath('/')}
              className="hidden xl:inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:border-black hover:text-black transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.admin.viewStorefront}</span>
            </Link>

            <button
              type="button"
              onClick={loadAll}
              disabled={refreshing}
              className="border border-neutral-300 bg-white p-2 text-neutral-700 hover:border-black hover:text-black transition-colors cursor-pointer"
              title={locale === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}
              className="border border-neutral-300 bg-white px-2.5 py-2 text-xs font-semibold text-neutral-800 hover:border-black inline-flex items-center gap-1.5 cursor-pointer"
              title={t.nav.switchLanguage}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{locale === 'ar' ? 'EN' : 'AR'}</span>
            </button>

            {/* Real Notifications Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setProfileMenuOpen(false);
                }}
                className="relative border border-neutral-300 bg-white p-2 text-neutral-800 hover:border-black transition-colors cursor-pointer"
                aria-label={t.admin.notifications}
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 bg-black text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute end-0 top-full mt-2 w-80 bg-white border border-neutral-200 shadow-lg z-40">
                  <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-black">
                      {t.admin.notifications}
                    </span>
                    <span className="text-[11px] text-neutral-500 tabular-nums">
                      {notifications.length}
                    </span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-5 text-xs text-neutral-500 text-center">
                      {t.admin.noNotifications}
                    </p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={n.onClick}
                          className="w-full text-start px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer space-y-0.5"
                        >
                          <p className="text-xs font-semibold text-black">{n.title}</p>
                          <p
                            className={`text-[11px] ${
                              n.severity === 'high' ? 'text-red-700 font-medium' : 'text-neutral-500'
                            }`}
                          >
                            {n.subtitle}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 border border-neutral-300 bg-white ps-1.5 pe-2.5 py-1 hover:border-black transition-colors cursor-pointer"
              >
                <span className="w-7 h-7 bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                  {displayOwnerPhoto ? (
                    <img
                      src={displayOwnerPhoto}
                      alt={displayOwnerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5 text-neutral-600" />
                  )}
                </span>
                <span className="hidden lg:inline text-xs font-medium text-black max-w-[110px] truncate">
                  {displayOwnerName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
              </button>

              {profileMenuOpen && (
                <div className="absolute end-0 top-full mt-2 w-60 bg-white border border-neutral-200 shadow-lg z-40 divide-y divide-neutral-100">
                  <div className="p-4">
                    <p className="text-xs font-semibold text-black truncate">{displayOwnerName}</p>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5" dir="ltr">
                      {user.email}
                    </p>
                  </div>
                  <div className="p-1.5 space-y-0.5 text-xs">
                    {adminRole === 'staff' && (
                      <Link
                        to={localePath('/account')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-800 hover:bg-neutral-100"
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>{locale === 'ar' ? 'حسابي وحذف الحساب' : 'My account & deletion'}</span>
                      </Link>
                    )}
                    {adminRole === 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleNavigate('my-account')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-start text-neutral-800 hover:bg-neutral-100 cursor-pointer"
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>{t.admin.tabs['my-account']}</span>
                      </button>
                    )}
                    <Link
                      to={localePath('/')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-neutral-800 hover:bg-neutral-100"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t.admin.viewStorefront}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-start text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t.admin.tabs.logout}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1600px] w-full mx-auto">
          {loadingData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-28 bg-white border border-neutral-200 animate-pulse"
                  />
                ))}
              </div>
              <div className="h-72 bg-white border border-neutral-200 animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <AdminDashboardOverview
                  products={products}
                  variants={variants}
                  orders={orders}
                  customersCount={customers.length}
                  onNavigate={handleNavigate}
                />
              )}
              {activeTab === 'products' && (
                <AdminProductsPanel
                  products={products}
                  variants={variants}
                  collections={collections}
                  initialSearch={globalSearch}
                  onRefresh={loadAll}
                />
              )}
              {activeTab === 'add-product' && (
                <AdminProductsPanel
                  key="create-mode"
                  products={products}
                  variants={variants}
                  collections={collections}
                  createMode
                  onCreated={() => setActiveTab('products')}
                  onRefresh={loadAll}
                />
              )}
              {activeTab === 'categories' && (
                <AdminCategoriesPanel collections={collections} onRefresh={loadAll} />
              )}
              {activeTab === 'inventory' && (
                <AdminInventoryPanel
                  products={products}
                  variants={variants}
                  movements={movements}
                  onRefresh={loadAll}
                />
              )}
              {activeTab === 'orders' && (
                <AdminOrdersPanel
                  orders={orders}
                  initialOrderId={selectedOrderId}
                  initialSearch={globalSearch}
                  onClearInitialOrder={() => setSelectedOrderId(null)}
                  onRefresh={loadAll}
                />
              )}
              {activeTab === 'customers' && (
                <AdminCustomersPanel
                  customers={customers}
                  orders={orders}
                  initialSearch={globalSearch}
                />
              )}
              {activeTab === 'discounts' && (
                <AdminDiscountsPanel discounts={discounts} onRefresh={loadAll} />
              )}
              {activeTab === 'reviews' && (
                <AdminReviewsPanel reviews={reviews} products={products} onRefresh={loadAll} />
              )}
              {activeTab === 'analytics' && (
                <AdminAnalyticsPanel orders={orders} products={products} />
              )}
              {activeTab === 'settings' && (
                <AdminSettingsPanel shippingZones={shippingZones} onRefresh={loadAll} />
              )}
              {activeTab === 'content' && <AdminContentPanel />}
              {activeTab === 'social' && <AdminContactSocialPanel />}
              {activeTab === 'contact-messages' && adminRole === 'owner' && <AdminContactMessagesPanel />}
              {activeTab === 'my-account' && (
                <AdminMyAccountPanel
                  auditLogs={auditLogs}
                  serverVerified={serverVerified}
                  onRefresh={loadAll}
                  onProfileUpdated={(profile) => setAdminProfileMeta(profile)}
                />
              )}
              {activeTab === 'staff-applications' && adminRole === 'owner' && (
                <AdminStaffApplicationsPanel applications={staffApplications} onRefresh={loadAll} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
