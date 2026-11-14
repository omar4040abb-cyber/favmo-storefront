import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

const GUEST_WISHLIST_KEY = 'favmo_guest_wishlist_v1';

interface WishlistContextValue {
  productIds: string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function readGuestWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeGuestWishlist(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [guestIds, setGuestIds] = useState<string[]>(() => readGuestWishlist());
  const [authIds, setAuthIds] = useState<string[]>([]);

  useEffect(() => {
    if (loading || !user) return;
    const localIds = readGuestWishlist();
    if (localIds.length > 0) {
      const ref = doc(db, 'wishlists', user.uid);
      getDoc(ref)
        .then(async (snap) => {
          const existing =
            snap.exists() && Array.isArray(snap.data().productIds)
              ? (snap.data().productIds as string[])
              : [];
          const merged = Array.from(new Set([...existing, ...localIds])).slice(0, 100);
          await setDoc(
            ref,
            { userId: user.uid, productIds: merged, updatedAt: serverTimestamp() },
            { merge: true }
          );
          writeGuestWishlist([]);
          setGuestIds([]);
        })
        .catch(() => {});
    }
  }, [user, loading]);

  useEffect(() => {
    if (loading || !user) {
      setAuthIds([]);
      return;
    }

    const path = `wishlists/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'wishlists', user.uid),
      (snap) => {
        if (!snap.exists()) {
          setAuthIds([]);
          return;
        }
        const ids = snap.data().productIds;
        setAuthIds(Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
    return () => unsub();
  }, [user, loading]);

  const isAuthActive = Boolean(user);
  const productIds = isAuthActive ? authIds : guestIds;

  const isWishlisted = useCallback(
    (productId: string) => productIds.includes(productId),
    [productIds]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const exists = productIds.includes(productId);
      const next = exists
        ? productIds.filter((id) => id !== productId)
        : Array.from(new Set([...productIds, productId])).slice(0, 100);

      if (isAuthActive && user) {
        try {
          await setDoc(
            doc(db, 'wishlists', user.uid),
            {
              userId: user.uid,
              productIds: next,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `wishlists/${user.uid}`);
        }
      } else {
        writeGuestWishlist(next);
        setGuestIds(next);
      }
    },
    [productIds, isAuthActive, user]
  );

  const value = useMemo(
    () => ({ productIds, isWishlisted, toggleWishlist }),
    [productIds, isWishlisted, toggleWishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
