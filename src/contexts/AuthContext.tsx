import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isGoogleAuthConfigured,
  OperationType,
} from '../lib/firebase';
import type { AdminPermission, AdminRole, Locale } from '../types/domain';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  adminRole: AdminRole | null;
  adminPermissions: AdminPermission[];
  isGoogleConfigured: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  setupOwnerAdmin: (email: string, password: string) => Promise<void>;
  resendOwnerVerification: (email: string, password: string) => Promise<void>;
  verifyAdminSession: () => Promise<boolean>;
  registerEmail: (
    name: string,
    email: string,
    phone: string,
    password: string,
    locale: Locale
  ) => Promise<void>;
  signInGoogle: (locale: Locale) => Promise<void>;
  sendResetEmail: (email: string, locale?: Locale) => Promise<void>;
  resendVerification: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteOwnAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncProfileDocument(user: User, preferredLocale: Locale, phone?: string) {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: (user.displayName || user.email?.split('@')[0] || 'FAVMO Member').slice(0, 100),
        preferredLocale,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          displayName: snap.data().displayName || user.displayName || 'FAVMO Member',
          preferredLocale,
          status: snap.data().status || 'active',
          createdAt: snap.data().createdAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (user.email) {
      const privateRef = doc(db, 'users', user.uid, 'private', 'info');
      const privateSnap = await getDoc(privateRef);
      if (!privateSnap.exists()) {
        await setDoc(privateRef, {
          uid: user.uid,
          email: user.email,
          ...(phone ? { phone: phone.trim().slice(0, 32) } : {}),
          updatedAt: serverTimestamp(),
        });
      } else if (phone && !privateSnap.data().phone) {
        await setDoc(
          privateRef,
          {
            uid: user.uid,
            email: user.email,
            phone: phone.trim().slice(0, 32),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[]>([]);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setAdminRole(null);
        setAdminPermissions([]);
        setLoading(false);
        return;
      }

      try {
        let token = await nextUser.getIdTokenResult();
        if (token.claims.favmoOwner !== true) {
          try {
            const idToken = await nextUser.getIdToken();
            const response = await fetch('/api/staff/access-sync', {
              method: 'POST',
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (response.ok) {
              await nextUser.getIdToken(true);
              token = await nextUser.getIdTokenResult();
            }
          } catch {
            // A regular customer remains a customer when staff sync is unavailable.
          }
        }
        if (token.claims.favmoOwner === true) {
          setAdminRole('owner');
          setAdminPermissions([
            'catalog', 'inventory', 'orders', 'customers', 'discounts', 'reviews', 'analytics', 'settings', 'content',
          ]);
        } else if (token.claims.favmoStaff === true && Array.isArray(token.claims.favmoPermissions)) {
          setAdminRole('staff');
          setAdminPermissions(token.claims.favmoPermissions.filter((permission): permission is AdminPermission =>
            ['catalog', 'inventory', 'orders', 'customers', 'discounts', 'reviews', 'analytics', 'settings', 'content'].includes(String(permission))
          ));
        } else {
          setAdminRole(null);
          setAdminPermissions([]);
        }
      } catch {
        setAdminRole(null);
        setAdminPermissions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const setupOwnerAdmin = useCallback(async (email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    await sendEmailVerification(credential.user);
  }, []);

  const resendOwnerVerification = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    try {
      const idToken = await credential.user.getIdToken();
      const response = await fetch('/api/admin/verification-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || 'ADMIN_VERIFICATION_REQUEST_FAILED');
      }
      await sendEmailVerification(credential.user);
    } finally {
      await firebaseSignOut(auth);
    }
  }, []);

  const verifyAdminSession = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('ADMIN_SESSION_MISSING');

    try {
      const idToken = await currentUser.getIdToken();
      const initialClaims = await currentUser.getIdTokenResult();
      if (initialClaims.claims.favmoOwner !== true) {
        const staffResponse = await fetch('/api/staff/access-sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (staffResponse.ok) {
          await currentUser.reload();
          await currentUser.getIdToken(true);
          const refreshed = await currentUser.getIdTokenResult();
          const isStaff = refreshed.claims.favmoStaff === true;
          setAdminRole(isStaff ? 'staff' : null);
          setAdminPermissions(Array.isArray(refreshed.claims.favmoPermissions)
            ? refreshed.claims.favmoPermissions.filter((permission): permission is AdminPermission =>
                ['catalog', 'inventory', 'orders', 'customers', 'discounts', 'reviews', 'analytics', 'settings', 'content'].includes(String(permission))
              )
            : []);
          if (isStaff) return true;
        } else {
          const staffResult = await staffResponse.json().catch(() => ({})) as { error?: string };
          if (staffResult.error === 'STAFF_PASSWORD_SETUP_REQUIRED') {
            throw new Error('ADMIN_STAFF_PASSWORD_SETUP_REQUIRED');
          }
          if (staffResult.error === 'STAFF_ACCESS_NOT_APPROVED') {
            throw new Error('ADMIN_STAFF_NOT_APPROVED');
          }
        }
      }
      if (!currentUser.emailVerified) throw new Error('ADMIN_EMAIL_UNVERIFIED');
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (response.status === 403) throw new Error('ADMIN_NOT_AUTHORIZED');
      if (!response.ok) throw new Error('ADMIN_SERVER_UNAVAILABLE');

      await currentUser.getIdToken(true);
      const token = await currentUser.getIdTokenResult();
      const isOwner = token.claims.favmoOwner === true;
      setAdminRole(isOwner ? 'owner' : null);
      if (!isOwner) throw new Error('ADMIN_NOT_AUTHORIZED');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('ADMIN_')) throw error;
      throw new Error('ADMIN_SERVER_UNAVAILABLE');
    }
  }, []);

  const registerEmail = useCallback(
    async (name: string, email: string, phone: string, password: string, locale: Locale) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim().slice(0, 100) });
      await syncProfileDocument(cred.user, locale, phone);
      sendEmailVerification(cred.user).catch(() => {});
      try {
        const token = await cred.user.getIdToken();
        await fetch('/api/notify/welcome', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: name.trim(), locale }),
        });
      } catch {
        // Non-blocking when email provider is unconfigured
      }
    },
    []
  );

  const signInGoogle = useCallback(async (locale: Locale) => {
    if (!isGoogleAuthConfigured) {
      throw new Error('Google sign-in is not configured.');
    }
    const cred = await signInWithPopup(auth, googleProvider);
    await syncProfileDocument(cred.user, locale);
  }, []);

  const sendResetEmail = useCallback(async (email: string, locale?: Locale) => {
    if (locale) auth.languageCode = locale;
    const target = email.trim();
    const returnToAdmin = `${window.location.origin}/${locale || 'ar'}/favmo-studio-7k4m9q2x`;
    try {
      await sendPasswordResetEmail(auth, target, { url: returnToAdmin });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code !== 'auth/unauthorized-continue-uri') throw error;
      await sendPasswordResetEmail(auth, target);
    }
  }, []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const deleteOwnAccount = useCallback(async (password?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('AUTHENTICATION_REQUIRED');

    const providerIds = currentUser.providerData.map((provider) => provider.providerId);
    if (providerIds.includes('password')) {
      if (!currentUser.email || !password) throw new Error('REAUTH_PASSWORD_REQUIRED');
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    } else if (providerIds.includes('google.com')) {
      await reauthenticateWithPopup(currentUser, googleProvider);
    } else {
      throw new Error('REAUTH_PROVIDER_UNSUPPORTED');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(result.error || 'ACCOUNT_DELETE_FAILED');
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: adminRole !== null,
      adminRole,
      adminPermissions,
      isGoogleConfigured: isGoogleAuthConfigured,
      signInEmail,
      setupOwnerAdmin,
      resendOwnerVerification,
      verifyAdminSession,
      registerEmail,
      signInGoogle,
      sendResetEmail,
      resendVerification,
      getIdToken,
      signOut,
      deleteOwnAccount,
    }),
    [
      user,
      loading,
      adminRole,
      adminPermissions,
      signInEmail,
      setupOwnerAdmin,
      resendOwnerVerification,
      verifyAdminSession,
      registerEmail,
      signInGoogle,
      sendResetEmail,
      resendVerification,
      getIdToken,
      signOut,
      deleteOwnAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
