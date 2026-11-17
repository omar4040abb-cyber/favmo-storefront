import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Upload } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { useCartUi } from '../contexts/CartUiContext';
import { useStoreSettings } from '../contexts/StoreSettingsContext';
import { db } from '../lib/firebase';
import { formatMinorUnits } from '../lib/currency';
import { EGYPT_GOVERNORATES } from '../lib/egyptGovernorates';
import {
  evaluateDiscountCode,
  fetchAllActiveVariants,
  fetchPublishedProducts,
  fetchShippingZones,
  initiatePaymobSession,
  placeOrder,
  uploadReceiptImage,
} from '../lib/storeService';
import type {
  PaymentMethod,
  Product,
  ProductVariant,
  ShippingZone,
  UserAddress,
} from '../types/domain';
import { Bdi } from '../components/Bdi';
import { calculateQuantityPromotion, fetchQuantityPromotion } from '../lib/quantityPromotion';
import type { QuantityPromotion } from '../types/domain';

const EGYPT_OR_INTL_PHONE = /^((\+20|0020|0)?1[0125]\d{8}|\+[1-9]\d{7,14})$/;

const checkoutSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().regex(EGYPT_OR_INTL_PHONE),
  governorateCode: z.string().trim().min(2),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().min(1).max(100),
  street: z.string().trim().min(2).max(200),
  building: z.string().trim().max(50),
  floor: z.string().trim().max(20).optional(),
  apartment: z.string().trim().max(20).optional(),
  landmark: z.string().trim().max(200).optional(),
  deliveryNotes: z.string().trim().max(400).optional(),
  paymentMethod: z.enum(['cod', 'instapay', 'paymob']),
  acceptTerms: z.boolean().refine((v) => v === true),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  const { locale, t, localePath } = useLocale();
  const { user } = useAuth();
  const { items, clearCart } = useCartUi();
  const { payment } = useStoreSettings();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const [couponInput, setCouponInput] = useState(searchParams.get('coupon') || '');
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null);
  const [discountPiasters, setDiscountPiasters] = useState(0);
  const [freeShippingFromCoupon, setFreeShippingFromCoupon] = useState(false);
  const [quantityPromotion, setQuantityPromotion] = useState<QuantityPromotion | null>(null);
  const [couponStatus, setCouponStatus] = useState<string | null>(null);

  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);

  useEffect(() => { void fetchQuantityPromotion().then(setQuantityPromotion); }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: user?.displayName || '',
      email: user?.email || '',
      phone: '',
      governorateCode: 'CAIRO',
      city: '',
      area: '',
      street: '',
      building: '',
      floor: '',
      apartment: '',
      landmark: '',
      deliveryNotes: '',
      paymentMethod: payment.codEnabled ? 'cod' : payment.instapayEnabled ? 'instapay' : 'paymob',
      acceptTerms: false,
    },
  });

  const selectedGov = watch('governorateCode');
  const selectedPaymentMethod = watch('paymentMethod');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingData(true);
      try {
        const [p, v, z] = await Promise.all([
          fetchPublishedProducts(),
          fetchAllActiveVariants(),
          fetchShippingZones(false),
        ]);
        if (active) {
          setProducts(p);
          setVariants(v);
          setShippingZones(z);
        }

        if (user) {
          try {
            const addrSnap = await getDocs(collection(db, 'users', user.uid, 'addresses'));
            if (active) {
              const list = addrSnap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<UserAddress, 'id'>),
              }));
              setSavedAddresses(list);
              const def = list.find((a) => a.isDefault) || list[0];
              if (def) {
                setValue('fullName', def.fullName);
                setValue('phone', def.phone);
                setValue('governorateCode', def.governorateCode);
                setValue('city', def.city);
                setValue('area', def.area);
                setValue('street', def.street);
                setValue('building', def.building);
                setValue('floor', def.floor || '');
                setValue('apartment', def.apartment || '');
                setValue('landmark', def.landmark || '');
              }
            }
          } catch {
            // ignore
          }
        }
      } finally {
        if (active) setLoadingData(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user, setValue]);

  const hydratedItems = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    return items.map((item) => {
      const product = productMap.get(item.productId);
      const variant = variantMap.get(item.variantId);
      const unitPrice = product
        ? variant?.pricePiasters ?? product.salePricePiasters ?? product.pricePiasters
        : 0;
      return {
        ...item,
        name: product ? (locale === 'ar' ? product.name_ar : product.name_en) : item.productId,
        colorLabel: variant
          ? locale === 'ar'
            ? variant.colorName_ar
            : variant.colorName_en
          : item.colorKey,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });
  }, [items, products, variants, locale]);

  const subtotalPiasters = useMemo(
    () => hydratedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [hydratedItems]
  );
  const itemCount = hydratedItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowestUnitPrice = hydratedItems.reduce((min, item) => item.quantity > 0 ? Math.min(min, item.unitPrice) : min, Number.POSITIVE_INFINITY);
  const quantityDeal = calculateQuantityPromotion(quantityPromotion, subtotalPiasters, itemCount, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
  const totalDiscountPiasters = Math.max(discountPiasters, quantityDeal.discountPiasters);

  useEffect(() => {
    const prefillCoupon = searchParams.get('coupon');
    if (prefillCoupon && subtotalPiasters > 0 && !appliedDiscountCode) {
      evaluateDiscountCode(prefillCoupon, subtotalPiasters, itemCount, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0).then((res) => {
        if (res.valid) {
          setAppliedDiscountCode(res.discount?.code || prefillCoupon.toUpperCase());
          setDiscountPiasters(res.discountPiasters);
          setFreeShippingFromCoupon(res.freeShipping);
          setCouponStatus(t.cart.couponApplied);
        }
      });
    }
  }, [searchParams, subtotalPiasters, itemCount, lowestUnitPrice, appliedDiscountCode, t.cart.couponApplied]);

  const matchedZone = useMemo(
    () => shippingZones.find((z) => z.governorateCodes?.includes(selectedGov)),
    [shippingZones, selectedGov]
  );

  const shippingPiasters = useMemo(() => {
    if (freeShippingFromCoupon || quantityDeal.freeShipping) return 0;
    if (!matchedZone?.feePiasters) return 0;
    if (
      matchedZone.freeShippingThresholdPiasters &&
      subtotalPiasters >= matchedZone.freeShippingThresholdPiasters
    ) {
      return 0;
    }
    return Math.trunc(matchedZone.feePiasters);
  }, [matchedZone, subtotalPiasters, freeShippingFromCoupon, quantityDeal.freeShipping]);

  const codFeePiasters = useMemo(() => {
    if (selectedPaymentMethod !== 'cod') return 0;
    return matchedZone?.codFeePiasters ? Math.trunc(matchedZone.codFeePiasters) : 0;
  }, [selectedPaymentMethod, matchedZone]);

  const totalPiasters = Math.max(
    0,
    subtotalPiasters - totalDiscountPiasters + shippingPiasters + codFeePiasters
  );

  const handleApplyCoupon = async () => {
    setCouponStatus(null);
    if (!couponInput.trim()) return;
    const res = await evaluateDiscountCode(couponInput, subtotalPiasters, itemCount, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
    if (!res.valid) {
      setAppliedDiscountCode(null);
      setDiscountPiasters(0);
      setFreeShippingFromCoupon(false);
      setCouponStatus(t.cart.couponInvalid);
    } else {
      setAppliedDiscountCode(res.discount?.code || couponInput.trim().toUpperCase());
      setDiscountPiasters(res.discountPiasters);
      setFreeShippingFromCoupon(res.freeShipping);
      setCouponStatus(t.cart.couponApplied);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    setSubmitError(null);
    try {
      const url = await uploadReceiptImage(file);
      setReceiptUrl(url);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const onSubmit = async (values: CheckoutValues) => {
    setSubmitError(null);
    if (values.paymentMethod === 'paymob' && !payment.paymobEnabled) {
      setSubmitError(t.checkout.paymobDisabled);
      return;
    }
    if (values.paymentMethod === 'instapay' && !receiptUrl) {
      setSubmitError(t.checkout.instapayReceipt);
      return;
    }
    if (items.length === 0) return;

    const gov = EGYPT_GOVERNORATES.find((g) => g.code === values.governorateCode);

    try {
      const res = await placeOrder({
        idempotencyKey,
        locale,
        userId: user?.uid || null,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        discountCode: appliedDiscountCode,
        paymentMethod: values.paymentMethod as PaymentMethod,
        receiptUrl: values.paymentMethod === 'instapay' ? receiptUrl : undefined,
        shippingAddress: {
          fullName: values.fullName,
          phone: values.phone,
          email: values.email,
          country: 'Egypt',
          governorateCode: values.governorateCode,
          governorateName_ar: gov?.name_ar || values.governorateCode,
          governorateName_en: gov?.name_en || values.governorateCode,
          city: values.city,
          area: values.area,
          street: values.street,
          building: values.building,
          floor: values.floor || '',
          apartment: values.apartment || '',
          landmark: values.landmark || '',
          deliveryNotes: values.deliveryNotes || '',
        },
      });

      if (values.paymentMethod === 'paymob') {
        const paymobRes = await initiatePaymobSession({
          orderId: res.orderId,
          orderNumber: res.orderNumber,
          amountPiasters: totalPiasters,
          billing: {
            fullName: values.fullName,
            email: values.email,
            phone: values.phone,
            city: values.city,
            country: 'Egypt',
          },
        });
        if (paymobRes.ok && paymobRes.iframeUrl) {
          await clearCart();
          window.location.href = paymobRes.iframeUrl;
          return;
        }
        setSubmitError(paymobRes.error || t.checkout.paymobDisabled);
        return;
      }

      await clearCart();
      setConfirmedOrderNumber(res.orderNumber);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'CHECKOUT_FAILED');
    }
  };

  if (confirmedOrderNumber) {
    return (
      <div className="bg-white text-black min-h-[75vh] flex items-center justify-center px-5 py-20">
        <div className="max-w-lg w-full border border-black p-8 sm:p-12 text-center space-y-6">
          <div className="w-12 h-12 bg-black text-white mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" strokeWidth={1.6} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold">{t.checkout.orderConfirmed}</h1>
          <div className="border border-neutral-200 bg-neutral-50 p-4 space-y-1">
            <p className="text-xs text-neutral-500">{t.checkout.orderNumberLabel}</p>
            <p className="text-lg font-mono-code font-bold">
              <Bdi>{confirmedOrderNumber}</Bdi>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to={localePath(`/track-order?order=${encodeURIComponent(confirmedOrderNumber)}`)}
              className="flex-1 bg-black text-white py-3.5 text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              {t.checkout.trackNow}
            </Link>
            <Link
              to={localePath('/shop')}
              className="flex-1 border border-neutral-300 py-3.5 text-xs font-semibold hover:border-black transition-colors"
            >
              {t.cart.continueShopping}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-black min-h-[75vh]">
      <section className="bg-black text-white py-14 border-b border-neutral-800">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <h1
            className={`text-3xl sm:text-4xl font-semibold ${
              locale === 'en' ? 'font-display-en tracking-[-0.01em]' : 'font-display-ar'
            }`}
          >
            {t.checkout.title}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-12 lg:py-16">
        {loadingData ? (
          <p className="text-sm text-neutral-500">...</p>
        ) : items.length === 0 ? (
          <div className="border border-neutral-200 p-12 text-center space-y-5">
            <p className="text-base text-neutral-600">{t.cart.empty}</p>
            <Link
              to={localePath('/shop')}
              className="inline-flex bg-black text-white px-8 py-3.5 text-xs font-semibold"
            >
              {t.cart.continueShopping}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7 space-y-10">
              {/* Saved Address Selector */}
              {savedAddresses.length > 0 && (
                <div className="border border-neutral-200 p-5 space-y-3">
                  <p className="text-xs font-semibold text-neutral-500">{t.account.addresses}</p>
                  <div className="flex flex-wrap gap-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setValue('fullName', addr.fullName);
                          setValue('phone', addr.phone);
                          setValue('governorateCode', addr.governorateCode);
                          setValue('city', addr.city);
                          setValue('area', addr.area);
                          setValue('street', addr.street);
                          setValue('building', addr.building);
                          setValue('floor', addr.floor || '');
                          setValue('apartment', addr.apartment || '');
                          setValue('landmark', addr.landmark || '');
                        }}
                        className="border border-neutral-300 px-3.5 py-2 text-xs font-semibold hover:border-black cursor-pointer"
                      >
                        {addr.label} — {addr.city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Details */}
              <div className="space-y-5">
                <h2 className="text-base font-semibold border-b border-neutral-200 pb-3">
                  {t.checkout.contactInfo}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.fullName}
                    </label>
                    <input
                      type="text"
                      {...register('fullName')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                    {errors.fullName && (
                      <p className="text-xs text-black font-medium">{t.checkout.validationError}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.email}
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      {...register('email')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.phone}
                    </label>
                    <input
                      type="tel"
                      dir="ltr"
                      placeholder="01012345678"
                      {...register('phone')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="space-y-5">
                <h2 className="text-base font-semibold border-b border-neutral-200 pb-3">
                  {t.checkout.shippingAddress}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.governorate}
                    </label>
                    <select
                      {...register('governorateCode')}
                      className="w-full border border-neutral-300 bg-white px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    >
                      {EGYPT_GOVERNORATES.map((g) => (
                        <option key={g.code} value={g.code}>
                          {locale === 'ar' ? g.name_ar : g.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.city}
                    </label>
                    <input
                      type="text"
                      {...register('city')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.area}
                    </label>
                    <input
                      type="text"
                      {...register('area')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.building} <span className="font-normal text-neutral-400">({locale === 'ar' ? 'اختياري' : 'optional'})</span>
                    </label>
                    <input
                      type="text"
                      {...register('building')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.street}
                    </label>
                    <input
                      type="text"
                      {...register('street')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.floor}
                    </label>
                    <input
                      type="text"
                      {...register('floor')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.apartment}
                    </label>
                    <input
                      type="text"
                      {...register('apartment')}
                      className="w-full border border-neutral-300 px-3.5 py-3 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {t.checkout.deliveryNotes}
                    </label>
                    <textarea
                      rows={2}
                      {...register('deliveryNotes')}
                      className="w-full border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-4">
                <h2 className="text-base font-semibold border-b border-neutral-200 pb-3">
                  {t.checkout.paymentMethod}
                </h2>

                {payment.codEnabled && (
                  <label className="flex items-start gap-3 border border-neutral-300 p-4 cursor-pointer">
                    <input
                      type="radio"
                      value="cod"
                      {...register('paymentMethod')}
                      className="mt-1 accent-black"
                    />
                    <div>
                      <p className="text-sm font-semibold">{t.checkout.cod}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{t.checkout.codDesc}</p>
                    </div>
                  </label>
                )}

                {payment.instapayEnabled && (
                  <div className="border border-neutral-300 p-4 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value="instapay"
                        {...register('paymentMethod')}
                        className="mt-1 accent-black"
                      />
                      <div>
                        <p className="text-sm font-semibold">{t.checkout.instapay}</p>
                        <p className="text-xs text-neutral-600 mt-0.5">{t.checkout.instapayDesc}</p>
                      </div>
                    </label>

                    {selectedPaymentMethod === 'instapay' && (
                      <div className="ps-6 space-y-3 pt-2 border-t border-neutral-200">
                        {(payment.instapayInstructions_ar || payment.instapayInstructions_en) && (
                          <p className="text-xs text-neutral-700 whitespace-pre-line bg-neutral-50 p-3 border border-neutral-200">
                            {locale === 'ar'
                              ? payment.instapayInstructions_ar
                              : payment.instapayInstructions_en}
                          </p>
                        )}
                        <label className="inline-flex items-center gap-2 border border-black px-4 py-2.5 text-xs font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {uploadingReceipt ? t.admin.actions.uploading : t.checkout.uploadReceipt}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleReceiptUpload}
                            className="sr-only"
                          />
                        </label>
                        {receiptUrl && (
                          <p className="text-xs font-medium text-black">
                            {t.checkout.receiptUploaded}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`border p-4 ${
                    payment.paymobEnabled
                      ? 'border-neutral-300 bg-white'
                      : 'border-neutral-200 bg-neutral-50 opacity-75'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      value="paymob"
                      disabled={!payment.paymobEnabled}
                      {...register('paymentMethod')}
                      className="mt-1 accent-black"
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {t.checkout.paymob}
                        {payment.paymobEnabled && payment.paymobMode === 'test' && (
                          <span className="ms-2 text-[10px] font-mono-code border border-neutral-300 px-1.5 py-0.5 text-neutral-600">
                            TEST
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {payment.paymobEnabled
                          ? locale === 'ar'
                            ? 'الدفع الإلكتروني بالبطاقة أو المحفظة عبر Paymob.'
                            : 'Pay online via Card or Mobile Wallet with Paymob.'
                          : t.checkout.paymobDisabled}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <aside className="lg:col-span-5 border border-neutral-200 bg-neutral-50 p-6 sm:p-8 space-y-6">
              <h2 className="text-sm font-semibold border-b border-neutral-200 pb-4">
                {t.checkout.orderSummary}
              </h2>

              <div className="divide-y divide-neutral-200 max-h-72 overflow-y-auto">
                {hydratedItems.map((item) => (
                  <div key={item.id} className="py-3 flex justify-between gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-black">{item.name}</p>
                      <p className="text-neutral-500">
                        {item.colorLabel} · {item.size} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums shrink-0">
                      {formatMinorUnits(item.lineTotal, locale)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 border-t border-neutral-200 pt-4">
                <input
                  type="text"
                  dir="ltr"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={t.cart.couponPlaceholder}
                  className="flex-1 border border-neutral-300 bg-white px-3 py-2 text-xs uppercase focus:border-black focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="border border-black bg-white px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition-colors cursor-pointer"
                >
                  {t.cart.applyCoupon}
                </button>
              </div>
              {couponStatus && <p className="text-xs font-medium">{couponStatus}</p>}

              <div className="space-y-2.5 text-sm border-t border-neutral-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t.cart.subtotal}</span>
                  <span className="tabular-nums">{formatMinorUnits(subtotalPiasters, locale)}</span>
                </div>
                {totalDiscountPiasters > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">{t.cart.discount}</span>
                    <span className="tabular-nums">-{formatMinorUnits(totalDiscountPiasters, locale)}</span>
                  </div>
                )}
                {quantityDeal.qualifies && <p className="text-xs text-emerald-800">{locale === 'ar' ? 'تم تطبيق عرض عدد القطع تلقائيًا.' : 'Automatic quantity offer applied.'}</p>}
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t.checkout.shippingFee}</span>
                  <span className="tabular-nums">
                    {shippingPiasters > 0
                      ? formatMinorUnits(shippingPiasters, locale)
                      : t.checkout.freeShipping}
                  </span>
                </div>
                {codFeePiasters > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">{t.checkout.codFee}</span>
                    <span className="tabular-nums">{formatMinorUnits(codFeePiasters, locale)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold">
                  <span>{t.cart.total}</span>
                  <span className="tabular-nums">{formatMinorUnits(totalPiasters, locale)}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                <input type="checkbox" {...register('acceptTerms')} className="mt-0.5 accent-black" />
                <span>{t.checkout.acceptTerms}</span>
              </label>
              {errors.acceptTerms && (
                <p className="text-xs text-black font-medium">{t.checkout.validationError}</p>
              )}

              {(Object.keys(errors).length > 0 || submitError) && (
                <p role="alert" className="text-xs text-black font-medium border border-black p-3 bg-white">
                  {submitError || t.checkout.validationError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black text-white py-4 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? t.checkout.placingOrder : t.checkout.placeOrder}
              </button>
            </aside>
          </form>
        )}
      </section>
    </div>
  );
}
