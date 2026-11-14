import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PaymentSettings, StorefrontSettings } from '../types/domain';

const DEFAULT_STOREFRONT: StorefrontSettings = {
  storeName_ar: 'FAVMO',
  storeName_en: 'FAVMO',
  whiteLogoUrl: '/assets/aistudio/WhatsApp_Image_2026-11-13_at_6.34.24_PM_cbfdfecc.jpeg',
  blackLogoUrl: '',
  heroImageUrl: '',
  campaignImageUrl: '',
  editorialImageUrl: '/assets/aistudio/WhatsApp_Image_2026-11-11_at_4.51.17_PM_fd963892.jpeg',
  contactEmail: '',
  contactPhone: '',
  whatsappNumber: '',
  address_ar: '',
  address_en: '',
  instagramUrl: '',
  tiktokUrl: '',
  facebookUrl: '',
};

const DEFAULT_PAYMENT: PaymentSettings = {
  codEnabled: true,
  instapayEnabled: true,
  instapayInstructions_ar: '',
  instapayInstructions_en: '',
  paymobEnabled: false,
  paymobMode: 'test',
};

interface StoreSettingsContextValue {
  storefront: StorefrontSettings;
  payment: PaymentSettings;
  loading: boolean;
  refreshStorefront: () => Promise<void>;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue>({
  storefront: DEFAULT_STOREFRONT,
  payment: DEFAULT_PAYMENT,
  loading: true,
  refreshStorefront: async () => {},
});

export function StoreSettingsProvider({ children }: { children: React.ReactNode }) {
  const [storefront, setStorefront] = useState<StorefrontSettings>(DEFAULT_STOREFRONT);
  const [payment, setPayment] = useState<PaymentSettings>(DEFAULT_PAYMENT);
  const [loading, setLoading] = useState(true);

  const refreshStorefront = useCallback(async () => {
    try {
      const response = await fetch('/api/storefront', { cache: 'no-store' });
      if (!response.ok) throw new Error('Storefront settings unavailable');
      const result = await response.json() as { ok?: boolean; storefront?: Partial<StorefrontSettings> };
      if (result.ok && result.storefront) {
        setStorefront({
          ...DEFAULT_STOREFRONT,
          ...result.storefront,
          whiteLogoUrl: result.storefront.whiteLogoUrl || DEFAULT_STOREFRONT.whiteLogoUrl,
          editorialImageUrl: result.storefront.editorialImageUrl || DEFAULT_STOREFRONT.editorialImageUrl,
        });
      } else {
        setStorefront(DEFAULT_STOREFRONT);
      }
    } catch {
      setStorefront(DEFAULT_STOREFRONT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStorefront();

    const unsubPayment = onSnapshot(
      doc(db, 'settings', 'payment'),
      (snap) => {
        if (snap.exists()) {
          setPayment({ ...DEFAULT_PAYMENT, ...(snap.data() as Partial<PaymentSettings>) });
        }
      },
      () => {}
    );

    return () => {
      unsubPayment();
    };
  }, [refreshStorefront]);

  const value = useMemo(
    () => ({ storefront, payment, loading, refreshStorefront }),
    [storefront, payment, loading, refreshStorefront]
  );

  return (
    <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>
  );
}

export function useStoreSettings(): StoreSettingsContextValue {
  return useContext(StoreSettingsContext);
}
