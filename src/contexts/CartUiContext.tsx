import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { CartItemLocal, ClothingSize } from '../types/domain';

const GUEST_CART_KEY = 'favmo_guest_cart_v1';

interface AddToCartInput {
  productId: string;
  variantId: string;
  colorKey: string;
  size: ClothingSize;
  quantity: number;
}

interface CartUiContextValue {
  items: CartItemLocal[];
  itemCount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: AddToCartInput) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshGuestCart: () => void;
}

const CartUiContext = createContext<CartUiContextValue | null>(null);

function readGuestCart(): CartItemLocal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items: CartItemLocal[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

function mergeCartItems(base: CartItemLocal[], incoming: CartItemLocal[]): CartItemLocal[] {
  const map = new Map<string, CartItemLocal>();
  for (const item of base) {
    map.set(item.variantId, { ...item });
  }
  for (const item of incoming) {
    const existing = map.get(item.variantId);
    if (existing) {
      map.set(item.variantId, {
        ...existing,
        quantity: Math.min(20, existing.quantity + item.quantity),
      });
    } else {
      map.set(item.variantId, { ...item });
    }
  }
  return Array.from(map.values()).slice(0, 50);
}

export function CartUiProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [guestItems, setGuestItems] = useState<CartItemLocal[]>(() => readGuestCart());
  const [authItems, setAuthItems] = useState<CartItemLocal[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const refreshGuestCart = useCallback(() => {
    setGuestItems(readGuestCart());
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === GUEST_CART_KEY) {
        refreshGuestCart();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshGuestCart]);

  // Merge guest cart into authenticated Firestore cart on login
  useEffect(() => {
    if (loading || !user) return;

    const uid = user.uid;
    const localGuest = readGuestCart();
    if (localGuest.length > 0) {
      const cartRef = doc(db, 'carts', uid);
      getDoc(cartRef)
        .then(async (snap) => {
          const existingRaw = snap.exists() && Array.isArray(snap.data().items)
            ? snap.data().items
            : [];
          const existingItems: CartItemLocal[] = existingRaw.map(
            (entry: Record<string, unknown>, idx: number) => ({
              id: String(entry.itemId || entry.variantId || idx),
              productId: String(entry.productId || ''),
              variantId: String(entry.variantId || ''),
              colorKey: String(entry.colorKey || ''),
              size: (entry.size as ClothingSize) || 'M',
              quantity: Number(entry.quantity || 1),
            })
          );
          const merged = mergeCartItems(existingItems, localGuest);
          await setDoc(
            cartRef,
            {
              userId: uid,
              items: merged.map((m) => ({
                itemId: m.id,
                productId: m.productId,
                variantId: m.variantId,
                colorKey: m.colorKey,
                size: m.size,
                quantity: m.quantity,
              })),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          writeGuestCart([]);
          setGuestItems([]);
        })
        .catch(() => {});
    }
  }, [user, loading]);

  useEffect(() => {
    if (loading || !user) {
      setAuthItems([]);
      return;
    }

    const cartPath = `carts/${user.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'carts', user.uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          setAuthItems([]);
          return;
        }
        const data = snapshot.data();
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const next: CartItemLocal[] = rawItems.map(
          (entry: Record<string, unknown>, idx: number) => ({
            id: String(entry.itemId || entry.variantId || idx),
            productId: String(entry.productId || ''),
            variantId: String(entry.variantId || ''),
            colorKey: String(entry.colorKey || ''),
            size: (entry.size as ClothingSize) || 'M',
            quantity: Number(entry.quantity || 1),
          })
        );
        setAuthItems(next);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, cartPath);
      }
    );

    return () => unsubscribe();
  }, [user, loading]);

  const isAuthCartActive = Boolean(user);
  const items = isAuthCartActive ? authItems : guestItems;

  const persistNextItems = useCallback(
    async (next: CartItemLocal[]) => {
      if (isAuthCartActive && user) {
        const cartRef = doc(db, 'carts', user.uid);
        try {
          await setDoc(
            cartRef,
            {
              userId: user.uid,
              items: next.map((m) => ({
                itemId: m.id,
                productId: m.productId,
                variantId: m.variantId,
                colorKey: m.colorKey,
                size: m.size,
                quantity: m.quantity,
              })),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `carts/${user.uid}`);
        }
      } else {
        writeGuestCart(next);
        setGuestItems(next);
      }
    },
    [isAuthCartActive, user]
  );

  const addItem = useCallback(
    async (input: AddToCartInput) => {
      const clampedQty = Math.max(1, Math.min(20, Math.trunc(input.quantity)));
      const nextItem: CartItemLocal = {
        id: input.variantId,
        productId: input.productId,
        variantId: input.variantId,
        colorKey: input.colorKey,
        size: input.size,
        quantity: clampedQty,
      };
      const next = mergeCartItems(items, [nextItem]);
      await persistNextItems(next);
    },
    [items, persistNextItems]
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      const clamped = Math.trunc(quantity);
      const next =
        clamped <= 0
          ? items.filter((i) => i.id !== itemId && i.variantId !== itemId)
          : items.map((i) =>
              i.id === itemId || i.variantId === itemId
                ? { ...i, quantity: Math.min(20, clamped) }
                : i
            );
      await persistNextItems(next);
    },
    [items, persistNextItems]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const next = items.filter((i) => i.id !== itemId && i.variantId !== itemId);
      await persistNextItems(next);
    },
    [items, persistNextItems]
  );

  const clearCart = useCallback(async () => {
    await persistNextItems([]);
  }, [persistNextItems]);

  const itemCount = useMemo(
    () => items.reduce((acc, item) => acc + Math.max(0, Math.trunc(item.quantity)), 0),
    [items]
  );

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const value = useMemo<CartUiContextValue>(
    () => ({
      items,
      itemCount,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshGuestCart,
    }),
    [
      items,
      itemCount,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshGuestCart,
    ]
  );

  return <CartUiContext.Provider value={value}>{children}</CartUiContext.Provider>;
}

export function useCartUi(): CartUiContextValue {
  const ctx = useContext(CartUiContext);
  if (!ctx) {
    throw new Error('useCartUi must be used inside CartUiProvider');
  }
  return ctx;
}
