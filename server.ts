import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  initializeApp as initializeAdminApp,
  cert,
  getApps,
  applicationDefault,
} from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth } from 'firebase-admin/auth';
import { getStorage as getFirebaseStorage } from 'firebase-admin/storage';
import {
  getFirestore as getAdminFirestore,
  FieldValue,
  type Firestore,
} from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const OWNER_ADMIN_EMAIL = (process.env.OWNER_ADMIN_EMAIL || '').trim().toLowerCase();

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

const firebaseConfig: FirebaseAppletConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')
);

let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;
let adminInitError: string | null = null;

try {
  if (getApps().length === 0) {
    const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath?.trim()) {
      const resolvedServiceAccountPath = path.resolve(serviceAccountPath.trim());
      initializeAdminApp({
        credential: cert(JSON.parse(fs.readFileSync(resolvedServiceAccountPath, 'utf8'))),
        projectId: firebaseConfig.projectId,
      });
    } else if (rawSa && rawSa.trim().startsWith('{')) {
      initializeAdminApp({
        credential: cert(JSON.parse(rawSa)),
        projectId: firebaseConfig.projectId,
      });
    } else {
      initializeAdminApp({
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
    }
  }
  adminAuth = getAdminAuth();
  adminDb = getAdminFirestore(firebaseConfig.firestoreDatabaseId);
} catch (err) {
  adminInitError =
    err instanceof Error ? err.message : 'Failed to initialize Firebase Admin SDK';
}

const UPLOADS_ROOT = path.join(__dirname, 'public', 'uploads');
const ADMIN_UPLOADS_DIR = path.join(UPLOADS_ROOT, 'admin');
const RECEIPT_UPLOADS_DIR = path.join(UPLOADS_ROOT, 'receipts');
fs.mkdirSync(ADMIN_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(RECEIPT_UPLOADS_DIR, { recursive: true });

async function persistUploadedFile(
  folder: 'admin' | 'receipts',
  filename: string,
  buffer: Buffer,
  mime: string
): Promise<string> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (bucketName) {
    const token = crypto.randomUUID();
    const objectPath = `${folder}/${filename}`;
    const file = getFirebaseStorage().bucket(bucketName).file(objectPath);
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: mime,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
  }

  if (IS_PROD) throw new Error('PERSISTENT_STORAGE_NOT_CONFIGURED');
  fs.writeFileSync(path.join(folder === 'admin' ? ADMIN_UPLOADS_DIR : RECEIPT_UPLOADS_DIR, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

// -----------------------------------------------------------------------------
// In-Memory Sliding Window Rate Limiter
// -----------------------------------------------------------------------------
const rateBuckets = new Map<string, number[]>();

function createRateLimiter(options: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${clientIp}`;
    const timestamps = (rateBuckets.get(key) || []).filter(
      (ts) => now - ts < options.windowMs
    );

    if (timestamps.length >= options.max) {
      res.status(429).json({
        ok: false,
        error: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    timestamps.push(now);
    rateBuckets.set(key, timestamps);
    next();
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isConfiguredSecret(val?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== '""' &&
    trimmed !== "''" &&
    !trimmed.startsWith('MY_')
  );
}

function detectImageSignature(
  buffer: Buffer,
  allowSvg: boolean
): { ext: string; mime: string } | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  // Sanitized SVG (logo uploads only)
  if (allowSvg) {
    const text = buffer.toString('utf8').trim();
    const lower = text.toLowerCase();
    if (
      (lower.startsWith('<svg') || lower.startsWith('<?xml')) &&
      lower.includes('<svg') &&
      !lower.includes('<script') &&
      !/\son\w+\s*=/.test(lower) &&
      !lower.includes('javascript:')
    ) {
      return { ext: 'svg', mime: 'image/svg+xml' };
    }
  }
  return null;
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([a-zA-Z0-9+/.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return null;
  return { mime: match[1].toLowerCase(), buffer };
}

function detectLocaleFromRequest(req: Request): 'ar' | 'en' {
  const cookieLocale = req.cookies?.favmo_locale;
  if (cookieLocale === 'ar' || cookieLocale === 'en') return cookieLocale;
  const acceptLang = (req.headers['accept-language'] || '').toLowerCase();
  if (acceptLang.includes('ar')) return 'ar';
  return 'en';
}

function buildSsrMeta(locale: 'ar' | 'en', pathname: string, origin: string) {
  const isAr = locale === 'ar';
  const baseTitle = isAr
    ? 'FAVMO — ابدع بلا حدود.'
    : 'FAVMO — CREATE BEYOND LIMITS.';
  const baseDescription = isAr
    ? 'FAVMO علامة ملابس شارع فاخرة ثنائية اللغة. صُمّم لمن يرفضون السير داخل الحدود المعتادة.'
    : 'FAVMO official bilingual Arabic and English streetwear platform. Designed for those who refuse to follow ordinary limits.';

  let pageTitle = baseTitle;
  if (pathname.includes('/shop')) {
    pageTitle = isAr ? 'المتجر | FAVMO' : 'Shop | FAVMO';
  } else if (pathname.includes('/about')) {
    pageTitle = isAr ? 'من نحن | FAVMO' : 'About | FAVMO';
  } else if (pathname.includes('/contact')) {
    pageTitle = isAr ? 'تواصل معنا | FAVMO' : 'Contact | FAVMO';
  } else if (pathname.includes('/shipping-returns')) {
    pageTitle = isAr ? 'الشحن والاسترجاع | FAVMO' : 'Shipping & Returns | FAVMO';
  } else if (pathname.includes('/privacy')) {
    pageTitle = isAr ? 'سياسة الخصوصية | FAVMO' : 'Privacy Policy | FAVMO';
  } else if (pathname.includes('/terms')) {
    pageTitle = isAr ? 'الشروط والأحكام | FAVMO' : 'Terms & Conditions | FAVMO';
  } else if (pathname.includes('/track-order')) {
    pageTitle = isAr ? 'تتبع الطلب | FAVMO' : 'Track Order | FAVMO';
  } else if (pathname.includes('/admin') || pathname.includes('/favmo-studio-7k4m9q2x')) {
    pageTitle = isAr ? 'لوحة الإدارة | FAVMO' : 'Admin | FAVMO';
  }

  const strippedPath = pathname.replace(/^\/(ar|en)(?=\/|$)/, '') || '';
  const canonicalUrl = `${origin}/${locale}${strippedPath}`;
  const arUrl = `${origin}/ar${strippedPath}`;
  const enUrl = `${origin}/en${strippedPath}`;

  const metaHtml = `
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="alternate" hreflang="ar" href="${escapeHtml(arUrl)}" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}" />
    <meta property="og:locale" content="${isAr ? 'ar_EG' : 'en_US'}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  `;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'FAVMO',
        url: origin,
        slogan: isAr ? 'ابدع بلا حدود.' : 'CREATE BEYOND LIMITS.',
      },
      {
        '@type': 'WebSite',
        name: 'FAVMO',
        url: origin,
        inLanguage: ['ar', 'en'],
      },
    ],
  };

  const jsonLdHtml = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

  return { pageTitle, baseDescription, metaHtml, jsonLdHtml };
}

async function verifySignedInToken(
  req: Request
): Promise<{ uid: string; email?: string; emailVerified: boolean; authTime: number; isOwner: boolean; isStaff: boolean; permissions: string[] } | null> {
  if (!adminAuth) return null;
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: Boolean(decoded.email_verified),
      authTime: Number(decoded.auth_time || 0) * 1000,
      isOwner: decoded.favmoOwner === true,
      isStaff: decoded.favmoStaff === true,
      permissions: Array.isArray(decoded.favmoPermissions) ? decoded.favmoPermissions.filter((item): item is string => typeof item === 'string') : [],
    };
  } catch {
    return null;
  }
}

async function verifyOwnerToken(req: Request): Promise<{ uid: string; email: string } | null> {
  const verified = await verifySignedInToken(req);
  if (
    OWNER_ADMIN_EMAIL &&
    verified &&
    verified.emailVerified &&
    verified.email?.toLowerCase() === OWNER_ADMIN_EMAIL
  ) {
    return { uid: verified.uid, email: verified.email };
  }
  return null;
}

async function verifyAdminPermission(req: Request, permission: string): Promise<{ uid: string; email: string; role: 'owner' | 'staff' } | null> {
  const verified = await verifySignedInToken(req);
  if (!verified?.emailVerified || !verified.email) return null;
  if (OWNER_ADMIN_EMAIL && verified.email.toLowerCase() === OWNER_ADMIN_EMAIL) {
    return { uid: verified.uid, email: verified.email, role: 'owner' };
  }
  if (verified.isStaff && verified.permissions.includes(permission)) {
    return { uid: verified.uid, email: verified.email, role: 'staff' };
  }
  return null;
}

function isEmailProviderConfigured(): boolean {
  return (
    process.env.EMAIL_ENABLED === 'true' &&
    isConfiguredSecret(process.env.EMAIL_PROVIDER_API_KEY) &&
    isConfiguredSecret(process.env.EMAIL_FROM_ADDRESS)
  );
}

function isPaymobProviderConfigured(): boolean {
  return (
    process.env.PAYMOB_ENABLED === 'true' &&
    isConfiguredSecret(process.env.PAYMOB_API_KEY) &&
    isConfiguredSecret(process.env.PAYMOB_HMAC_SECRET) &&
    isConfiguredSecret(process.env.PAYMOB_INTEGRATION_ID)
  );
}

async function sendTransactionalEmail(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!isEmailProviderConfigured()) {
    return { sent: false, skipped: true };
  }

  const apiKey = process.env.EMAIL_PROVIDER_API_KEY!.trim();
  const from = process.env.EMAIL_FROM_ADDRESS!.trim();
  const endpoint =
    isConfiguredSecret(process.env.EMAIL_PROVIDER_ENDPOINT)
      ? process.env.EMAIL_PROVIDER_ENDPOINT!.trim()
      : 'https://api.resend.com/emails';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
    if (!response.ok) {
      return { sent: false, error: `HTTP_${response.status}` };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : 'EMAIL_SEND_FAILED',
    };
  }
}

async function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));
  app.use(cookieParser());

  // Security Headers Middleware
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss:",
        "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
        "frame-ancestors 'self' https://aistudio.google.com https://*.googleusercontent.com",
      ].join('; ')
    );
    if (IS_PROD) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }
    next();
  });

  // Serve uploaded assets statically
  app.use('/uploads', express.static(UPLOADS_ROOT));

  // ---------------------------------------------------------------------------
  // SEO: robots.txt & sitemap.xml
  // ---------------------------------------------------------------------------
  app.get('/robots.txt', (req: Request, res: Response) => {
    const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /ar/admin\nDisallow: /en/admin\nDisallow: /ar/favmo-studio-7k4m9q2x\nDisallow: /en/favmo-studio-7k4m9q2x\nSitemap: ${origin}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const staticPaths = [
      '',
      '/shop',
      '/about',
      '/contact',
      '/shipping-returns',
      '/privacy',
      '/terms',
    ];
    const urls: string[] = [];

    for (const p of staticPaths) {
      urls.push(`${origin}/ar${p}`);
      urls.push(`${origin}/en${p}`);
    }

    if (adminDb) {
      try {
        const productsSnap = await adminDb
          .collection('products')
          .where('status', '==', 'published')
          .limit(200)
          .get();
        for (const docSnap of productsSnap.docs) {
          const slug = docSnap.data().slug;
          if (typeof slug === 'string' && slug) {
            urls.push(`${origin}/ar/product/${encodeURIComponent(slug)}`);
            urls.push(`${origin}/en/product/${encodeURIComponent(slug)}`);
          }
        }
      } catch {
        // Skip dynamic product entries if Admin credentials are unavailable
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`)
      .join('\n')}\n</urlset>`;

    res.type('application/xml').send(xml);
  });

  // ---------------------------------------------------------------------------
  // API Routes
  // ---------------------------------------------------------------------------
  app.get('/api/health', async (_req: Request, res: Response) => {
    let firestoreReachable = false;
    let firestoreError: string | null = adminInitError;
    if (adminDb) {
      try {
        await adminDb.collection('test').doc('connection').get();
        firestoreReachable = true;
      } catch (err) {
        firestoreError =
          err instanceof Error ? err.message : 'Admin Firestore connection failed';
      }
    }

    res.json({
      ok: true,
      service: 'favmo-storefront',
      firestoreAdminReady: firestoreReachable,
      firestoreError,
      paymobMode: process.env.PAYMOB_MODE === 'live' ? 'live' : 'test',
      paymobConfigured: isPaymobProviderConfigured(),
      emailConfigured: isEmailProviderConfigured(),
    });
  });

  const notifyLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyPrefix: 'notify',
  });

  const staffApplicationLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 4,
    keyPrefix: 'staff-application',
  });

  app.post('/api/staff/applications', staffApplicationLimiter, async (req: Request, res: Response) => {
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    const schema = z.object({
      displayName: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(254),
      phone: z.string().trim().min(7).max(32),
      desiredRole: z.enum(['employee', 'manager']),
      experience: z.string().trim().min(10).max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_APPLICATION' });
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    if (normalizedEmail === OWNER_ADMIN_EMAIL) {
      res.status(400).json({ ok: false, error: 'OWNER_CANNOT_APPLY' });
      return;
    }
    const applicationId = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    const applicationRef = adminDb.collection('staffApplications').doc(applicationId);
    try {
      const existing = await applicationRef.get();
      if (existing.exists && existing.data()?.status !== 'rejected') {
        res.status(409).json({ ok: false, error: 'APPLICATION_ALREADY_EXISTS' });
        return;
      }
      await applicationRef.set({
        ...parsed.data,
        email: normalizedEmail,
        status: 'pending',
        permissions: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (OWNER_ADMIN_EMAIL) {
        await sendTransactionalEmail({
          to: OWNER_ADMIN_EMAIL,
          subject: 'New FAVMO team application',
          text: `A new team application was submitted by ${parsed.data.displayName}. Open the FAVMO admin portal to review it.`,
          html: `<p>A new team application was submitted by <strong>${escapeHtml(parsed.data.displayName)}</strong>.</p><p>Open the FAVMO admin portal to review the application and choose permissions.</p>`,
        });
      }
      res.status(201).json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'APPLICATION_SAVE_FAILED' });
    }
  });

  app.delete(
    '/api/account',
    createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'account-delete' }),
    async (req: Request, res: Response) => {
      const signedIn = await verifySignedInToken(req);
      if (!signedIn) {
        res.status(401).json({ ok: false, error: 'AUTHENTICATION_REQUIRED' });
        return;
      }
      if (!adminDb || !adminAuth) {
        res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
        return;
      }
      const email = signedIn.email?.trim().toLowerCase() || '';
      if (signedIn.isOwner || (OWNER_ADMIN_EMAIL && email === OWNER_ADMIN_EMAIL)) {
        res.status(403).json({ ok: false, error: 'OWNER_ACCOUNT_PROTECTED' });
        return;
      }
      const now = Date.now();
      if (!signedIn.authTime || now - signedIn.authTime > 5 * 60 * 1000 || signedIn.authTime > now + 30_000) {
        res.status(401).json({ ok: false, error: 'RECENT_LOGIN_REQUIRED' });
        return;
      }

      try {
        const userRecord = await adminAuth.getUser(signedIn.uid);
        if (userRecord.customClaims?.favmoOwner === true) {
          res.status(403).json({ ok: false, error: 'OWNER_ACCOUNT_PROTECTED' });
          return;
        }
        const userRef = adminDb.collection('users').doc(signedIn.uid);
        const [privateDocs, addressDocs, reviews, subscriberDocs] = await Promise.all([
          userRef.collection('private').get(),
          userRef.collection('addresses').get(),
          adminDb.collection('reviews').where('userId', '==', signedIn.uid).get(),
          email ? adminDb.collection('subscribers').where('email', '==', email).get() : Promise.resolve(null),
        ]);
        const accountId = email ? crypto.createHash('sha256').update(email).digest('hex') : '';
        const refs = [
          userRef,
          ...privateDocs.docs.map((doc) => doc.ref),
          ...addressDocs.docs.map((doc) => doc.ref),
          ...reviews.docs.map((doc) => doc.ref),
          ...((subscriberDocs?.docs || []).map((doc) => doc.ref)),
          adminDb.collection('carts').doc(signedIn.uid),
          adminDb.collection('wishlists').doc(signedIn.uid),
          ...(accountId ? [
            adminDb.collection('staffApplications').doc(accountId),
            adminDb.collection('staffAccess').doc(accountId),
          ] : []),
        ];
        for (let index = 0; index < refs.length; index += 450) {
          const batch = adminDb.batch();
          for (const ref of refs.slice(index, index + 450)) batch.delete(ref);
          await batch.commit();
        }
        await adminAuth.deleteUser(signedIn.uid);
        res.json({ ok: true, ordersRetained: true });
      } catch {
        res.status(503).json({ ok: false, error: 'ACCOUNT_DELETE_FAILED' });
      }
    }
  );

  app.get('/api/admin/staff-applications', async (req: Request, res: Response) => {
    const owner = await verifyOwnerToken(req);
    if (!owner) {
      res.status(403).json({ ok: false, error: 'UNAUTHORIZED_OWNER_ONLY' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    try {
      const snapshot = await adminDb.collection('staffApplications').orderBy('createdAt', 'desc').get();
      res.json({
        ok: true,
        applications: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      });
    } catch {
      res.status(503).json({ ok: false, error: 'APPLICATION_LIST_FAILED' });
    }
  });

  app.patch('/api/admin/staff-applications/:applicationId', async (req: Request, res: Response) => {
    const owner = await verifyOwnerToken(req);
    if (!owner) {
      res.status(403).json({ ok: false, error: 'UNAUTHORIZED_OWNER_ONLY' });
      return;
    }
    if (!adminDb || !adminAuth) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    const applicationId = req.params.applicationId;
    if (!/^[a-f0-9]{64}$/.test(applicationId)) {
      res.status(400).json({ ok: false, error: 'INVALID_APPLICATION_ID' });
      return;
    }
    const permissionSchema = z.enum([
      'catalog', 'inventory', 'orders', 'customers', 'discounts', 'reviews', 'analytics', 'settings', 'content',
    ]);
    const schema = z.object({
      decision: z.enum(['approved', 'rejected']),
      permissions: z.array(permissionSchema).max(9),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || (parsed.data.decision === 'approved' && parsed.data.permissions.length === 0)) {
      res.status(400).json({ ok: false, error: 'INVALID_REVIEW_DECISION' });
      return;
    }

    const applicationRef = adminDb.collection('staffApplications').doc(applicationId);
    try {
      const applicationSnap = await applicationRef.get();
      if (!applicationSnap.exists) {
        res.status(404).json({ ok: false, error: 'APPLICATION_NOT_FOUND' });
        return;
      }
      const application = applicationSnap.data()!;
      if (application.status !== 'pending') {
        res.status(409).json({ ok: false, error: 'APPLICATION_ALREADY_REVIEWED' });
        return;
      }
      const permissions = parsed.data.decision === 'approved'
        ? [...new Set(parsed.data.permissions)]
        : [];
      const accessRef = adminDb.collection('staffAccess').doc(applicationId);
      const batch = adminDb.batch();
      batch.set(accessRef, {
        email: application.email,
        status: parsed.data.decision,
        permissions,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: owner.uid,
      });
      batch.update(applicationRef, {
        status: parsed.data.decision,
        permissions,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: owner.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();

      if (parsed.data.decision === 'approved') {
        try {
          const staffUser = await adminAuth.getUserByEmail(String(application.email));
          if (staffUser.emailVerified && staffUser.email && staffUser.email.toLowerCase() !== OWNER_ADMIN_EMAIL) {
            await adminAuth.setCustomUserClaims(staffUser.uid, {
              ...(staffUser.customClaims || {}),
              favmoStaff: true,
              favmoPermissions: permissions,
            });
          }
        } catch (error) {
          if (!(error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found')) {
            // The approved access record is authoritative; a later verified sign-in retries claim sync.
          }
        }
      } else {
        try {
          const staffUser = await adminAuth.getUserByEmail(String(application.email));
          if (staffUser.customClaims?.favmoStaff === true) {
            const customClaims = { ...(staffUser.customClaims || {}) };
            delete customClaims.favmoStaff;
            delete customClaims.favmoPermissions;
            await adminAuth.setCustomUserClaims(staffUser.uid, customClaims);
          }
        } catch {
          // The rejected access record prevents future staff claim synchronization.
        }
      }
      const decisionText = parsed.data.decision === 'approved'
        ? `Your FAVMO application was approved with permissions: ${permissions.join(', ')}.`
        : 'Your FAVMO team application was not approved at this time.';
      await sendTransactionalEmail({
        to: String(application.email),
        subject: parsed.data.decision === 'approved' ? 'FAVMO application approved' : 'FAVMO application update',
        text: `${decisionText} Sign in using this email to access approved staff tools.`,
        html: `<p>${escapeHtml(decisionText)}</p><p>Sign in using this email to access approved staff tools.</p>`,
      });
      res.json({ ok: true, status: parsed.data.decision });
    } catch {
      res.status(503).json({ ok: false, error: 'APPLICATION_REVIEW_FAILED' });
    }
  });

  app.post('/api/staff/access-sync', async (req: Request, res: Response) => {
    const signedIn = await verifySignedInToken(req);
    if (!signedIn?.email || !signedIn.emailVerified || !adminDb || !adminAuth) {
      res.status(401).json({ ok: false, error: 'VERIFIED_ACCOUNT_REQUIRED' });
      return;
    }
    const normalizedEmail = signedIn.email.toLowerCase();
    if (normalizedEmail === OWNER_ADMIN_EMAIL) {
      res.json({ ok: true, role: 'owner' });
      return;
    }
    const accessId = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    try {
      const access = await adminDb.collection('staffAccess').doc(accessId).get();
      if (!access.exists || access.data()?.status !== 'approved') {
        res.status(403).json({ ok: false, error: 'STAFF_ACCESS_NOT_APPROVED' });
        return;
      }
      const permissions = access.data()?.permissions;
      if (!Array.isArray(permissions) || permissions.length === 0) {
        res.status(403).json({ ok: false, error: 'STAFF_PERMISSIONS_MISSING' });
        return;
      }
      const userRecord = await adminAuth.getUser(signedIn.uid);
      if (userRecord.customClaims?.favmoStaff !== true || JSON.stringify(userRecord.customClaims?.favmoPermissions) !== JSON.stringify(permissions)) {
        await adminAuth.setCustomUserClaims(signedIn.uid, {
          ...(userRecord.customClaims || {}),
          favmoStaff: true,
          favmoPermissions: permissions,
        });
      }
      res.json({ ok: true, role: 'staff', permissions });
    } catch {
      res.status(503).json({ ok: false, error: 'STAFF_ACCESS_SYNC_FAILED' });
    }
  });

  app.post('/api/notify/welcome', notifyLimiter, async (req: Request, res: Response) => {
    const userToken = await verifySignedInToken(req);
    if (!userToken || !userToken.email) {
      res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
      return;
    }

    const schema = z.object({
      name: z.string().trim().min(1).max(120),
      locale: z.enum(['ar', 'en']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'VALIDATION_FAILED' });
      return;
    }

    const isAr = parsed.data.locale === 'ar';
    const subject = isAr ? 'مرحباً بك في FAVMO' : 'Welcome to FAVMO';
    const text = isAr
      ? `أهلاً ${parsed.data.name}، تم إنشاء حسابك بنجاح في FAVMO.`
      : `Welcome ${parsed.data.name}, your FAVMO customer account has been created.`;
    const html = `<div style="background:#000;color:#fff;padding:32px;font-family:sans-serif"><h1 style="letter-spacing:0.2em">FAVMO</h1><p>${escapeHtml(text)}</p></div>`;

    const result = await sendTransactionalEmail({
      to: userToken.email,
      subject,
      text,
      html,
    });
    res.json({ ok: true, ...result });
  });

  app.post('/api/notify/order-status', notifyLimiter, async (req: Request, res: Response) => {
    const owner = await verifyOwnerToken(req);
    if (!owner) {
      res.status(403).json({ ok: false, error: 'UNAUTHORIZED_OWNER_ONLY' });
      return;
    }

    const schema = z.object({
      to: z.string().trim().email().max(254),
      orderNumber: z.string().trim().regex(/^FAV-[0-9]{4}-[0-9]{6}$/),
      status: z.string().trim().min(1).max(40),
      paymentStatus: z.string().trim().min(1).max(40),
      locale: z.enum(['ar', 'en']),
      trackingNumber: z.string().trim().max(120).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'VALIDATION_FAILED' });
      return;
    }

    const isAr = parsed.data.locale === 'ar';
    const subject = isAr
      ? `تحديث حالة الطلب ${parsed.data.orderNumber} | FAVMO`
      : `Order ${parsed.data.orderNumber} Status Update | FAVMO`;
    const trackingLine = parsed.data.trackingNumber
      ? isAr
        ? ` رقم التتبع: ${parsed.data.trackingNumber}`
        : ` Tracking Number: ${parsed.data.trackingNumber}`
      : '';
    const text = isAr
      ? `تم تحديث حالة طلبك ${parsed.data.orderNumber} إلى: ${parsed.data.status} (حالة الدفع: ${parsed.data.paymentStatus}).${trackingLine}`
      : `Your order ${parsed.data.orderNumber} status is now: ${parsed.data.status} (Payment: ${parsed.data.paymentStatus}).${trackingLine}`;
    const html = `<div style="background:#000;color:#fff;padding:32px;font-family:sans-serif"><h1 style="letter-spacing:0.2em">FAVMO</h1><p>${escapeHtml(text)}</p></div>`;

    const result = await sendTransactionalEmail({
      to: parsed.data.to,
      subject,
      text,
      html,
    });
    res.json({ ok: true, ...result });
  });

  app.post('/api/locale', (req: Request, res: Response) => {
    const schema = z.object({ locale: z.enum(['ar', 'en']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_LOCALE' });
      return;
    }
    res.cookie('favmo_locale', parsed.data.locale, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax',
      secure: IS_PROD,
      path: '/',
    });
    res.json({ ok: true, locale: parsed.data.locale });
  });

  // Owner-only secure image upload (products, logos, banners)
  const adminUploadLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 60,
    keyPrefix: 'admin-upload',
  });

  app.post('/api/admin/upload', adminUploadLimiter, async (req: Request, res: Response) => {
    const schema = z.object({
      dataUrl: z.string().min(20).max(7_500_000),
      purpose: z.enum(['product', 'logo', 'banner']).optional().default('product'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_UPLOAD_PAYLOAD' });
      return;
    }

    const permission = parsed.data.purpose === 'product' ? 'catalog' : 'content';
    const adminUser = await verifyAdminPermission(req, permission);
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }

    const decodedFile = parseDataUrl(parsed.data.dataUrl);
    if (!decodedFile) {
      res.status(400).json({ ok: false, error: 'INVALID_FILE_SIZE_OR_FORMAT' });
      return;
    }

    const signature = detectImageSignature(
      decodedFile.buffer,
      parsed.data.purpose === 'logo'
    );
    if (!signature) {
      res.status(400).json({ ok: false, error: 'UNSUPPORTED_IMAGE_SIGNATURE' });
      return;
    }

    const filename = `${crypto.randomUUID()}.${signature.ext}`;
    try {
      const url = await persistUploadedFile('admin', filename, decodedFile.buffer, signature.mime);
      res.status(201).json({ ok: true, url, mime: signature.mime, size: decodedFile.buffer.length });
    } catch (err) {
      res.status(503).json({ ok: false, error: err instanceof Error ? err.message : 'UPLOAD_STORAGE_FAILED' });
    }
  });

  app.post('/api/admin/verify', async (req: Request, res: Response) => {
    const owner = await verifyOwnerToken(req);
    if (!owner) {
      res.status(403).json({
        ok: false,
        error: 'UNAUTHORIZED_OWNER_ONLY',
        adminSdkReady: Boolean(adminAuth),
      });
      return;
    }

    try {
      const ownerRecord = await adminAuth!.getUser(owner.uid);
      const currentClaims = ownerRecord.customClaims || {};
      if (currentClaims.favmoOwner !== true) {
        await adminAuth!.setCustomUserClaims(owner.uid, {
          ...currentClaims,
          favmoOwner: true,
        });
      }
    } catch {
      res.status(503).json({ ok: false, error: 'ADMIN_CLAIM_SETUP_FAILED' });
      return;
    }

    res.json({
      ok: true,
      uid: owner.uid,
      emailVerified: true,
      role: 'owner',
    });
  });

  app.post(
    '/api/admin/verification-email',
    createRateLimiter({ windowMs: 15 * 60 * 1000, max: 3, keyPrefix: 'admin-verification' }),
    async (req: Request, res: Response) => {
      const signedIn = await verifySignedInToken(req);
      if (
        !OWNER_ADMIN_EMAIL ||
        !signedIn ||
        signedIn.email?.toLowerCase() !== OWNER_ADMIN_EMAIL
      ) {
        res.status(403).json({ ok: false, error: 'UNAUTHORIZED_OWNER_ONLY' });
        return;
      }
      if (signedIn.emailVerified) {
        res.status(409).json({ ok: false, error: 'EMAIL_ALREADY_VERIFIED' });
        return;
      }
      res.json({ ok: true });
    }
  );

  app.post('/api/admin/audit', async (req: Request, res: Response) => {
    const owner = await verifyOwnerToken(req);
    if (!owner) {
      res.status(403).json({ ok: false, error: 'UNAUTHORIZED_OWNER_ONLY' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, blocked: true, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    const schema = z.object({
      action: z.string().trim().min(1).max(120),
      targetCollection: z.string().trim().min(1).max(80),
      targetId: z.string().trim().min(1).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_AUDIT_PAYLOAD' });
      return;
    }
    try {
      const ref = await adminDb.collection('auditLogs').add({
        actorUid: owner.uid,
        actorRole: 'owner',
        action: parsed.data.action,
        targetCollection: parsed.data.targetCollection,
        targetId: parsed.data.targetId,
        createdAt: FieldValue.serverTimestamp(),
      });
      res.status(201).json({ ok: true, id: ref.id });
    } catch {
      res.status(503).json({ ok: false, error: 'AUDIT_WRITE_FAILED' });
    }
  });

  // Customer InstaPay receipt upload (raster images only, magic-byte validated)
  const receiptLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    keyPrefix: 'receipt-upload',
  });

  app.post('/api/uploads/receipt', receiptLimiter, async (req: Request, res: Response) => {
    const schema = z.object({
      dataUrl: z.string().min(20).max(7_500_000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_RECEIPT' });
      return;
    }

    const decodedFile = parseDataUrl(parsed.data.dataUrl);
    if (!decodedFile) {
      res.status(400).json({ ok: false, error: 'INVALID_FILE_SIZE_OR_FORMAT' });
      return;
    }

    const signature = detectImageSignature(decodedFile.buffer, false);
    if (!signature) {
      res.status(400).json({ ok: false, error: 'UNSUPPORTED_IMAGE_SIGNATURE' });
      return;
    }

    const filename = `${crypto.randomUUID()}.${signature.ext}`;
    try {
      const url = await persistUploadedFile('receipts', filename, decodedFile.buffer, signature.mime);
      res.status(201).json({ ok: true, url });
    } catch (err) {
      res.status(503).json({ ok: false, error: err instanceof Error ? err.message : 'UPLOAD_STORAGE_FAILED' });
    }
  });

  app.get('/api/cms/:slug', async (req: Request, res: Response) => {
    const slugSchema = z.enum([
      'home',
      'about',
      'contact',
      'shipping-returns',
      'privacy',
      'terms',
      'size-guide',
    ]);
    const parsed = slugSchema.safeParse(req.params.slug);
    if (!parsed.success) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({
        ok: false,
        blocked: true,
        error: 'FIREBASE_ADMIN_UNAVAILABLE',
      });
      return;
    }
    try {
      const snap = await adminDb.collection('pages').doc(parsed.data).get();
      if (!snap.exists) {
        res.json({ ok: true, page: null });
        return;
      }
      res.json({ ok: true, page: { slug: snap.id, ...snap.data() } });
    } catch {
      res.status(503).json({
        ok: false,
        blocked: true,
        error: 'FIRESTORE_READ_ERROR',
      });
    }
  });

  app.put('/api/admin/pages/:slug', async (req: Request, res: Response) => {
    const slugSchema = z.enum([
      'home', 'about', 'contact', 'shipping-returns', 'privacy', 'terms', 'size-guide',
    ]);
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' });
      return;
    }
    const adminUser = await verifyAdminPermission(req, 'content');
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    const optionalText = (max: number) => z.string().trim().max(max).optional().default('');
    const contentSchema = z.object({
      title_ar: optionalText(180),
      title_en: optionalText(180),
      body_ar: optionalText(12000),
      body_en: optionalText(12000),
      heroMediaType: z.enum(['placeholder', 'image', 'video']).optional().default('image'),
      heroMediaUrl: z.string().trim().max(2048).optional().default(''),
      heroPosterUrl: z.string().trim().max(2048).optional().default(''),
      campaignImageUrl: z.string().trim().max(2048).optional().default(''),
      campaignTitle_ar: optionalText(180),
      campaignTitle_en: optionalText(180),
      campaignBody_ar: optionalText(2000),
      campaignBody_en: optionalText(2000),
      campaignCta_ar: optionalText(80),
      campaignCta_en: optionalText(80),
    });
    const parsed = contentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_PAGE_CONTENT' });
      return;
    }
    try {
      await adminDb.collection('pages').doc(slug.data).set({
        ...parsed.data,
        slug: slug.data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminUser.uid,
      }, { merge: true });
      res.json({ ok: true, slug: slug.data });
    } catch {
      res.status(503).json({ ok: false, error: 'CMS_SAVE_FAILED' });
    }
  });

  app.get('/api/storefront', async (_req: Request, res: Response) => {
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    try {
      const snapshot = await adminDb.collection('settings').doc('storefront').get();
      const data = snapshot.data() || {};
      const publicFields = [
        'storeName_ar', 'storeName_en', 'storeDescription_ar', 'storeDescription_en', 'currency',
        'announcementEnabled', 'announcementText_ar', 'announcementText_en', 'whiteLogoUrl',
        'blackLogoUrl', 'heroImageUrl', 'campaignImageUrl', 'editorialImageUrl', 'contactEmail',
        'contactPhone', 'whatsappNumber', 'address_ar', 'address_en', 'instagramUrl', 'tiktokUrl',
        'facebookUrl',
      ];
      const storefront = Object.fromEntries(
        publicFields.filter((field) => data[field] !== undefined).map((field) => [field, data[field]])
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, storefront });
    } catch {
      res.status(503).json({ ok: false, error: 'STOREFRONT_READ_FAILED' });
    }
  });

  app.put('/api/admin/storefront', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminPermission(req, 'content')
      || await verifyAdminPermission(req, 'settings');
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }

    const optionalText = (max: number) => z.string().trim().max(max).optional();
    const storefrontSchema = z.object({
      storeName_ar: optionalText(120),
      storeName_en: optionalText(120),
      storeDescription_ar: optionalText(2000),
      storeDescription_en: optionalText(2000),
      currency: z.literal('EGP').optional(),
      announcementEnabled: z.boolean().optional(),
      announcementText_ar: optionalText(500),
      announcementText_en: optionalText(500),
      whiteLogoUrl: optionalText(2048),
      blackLogoUrl: optionalText(2048),
      heroImageUrl: optionalText(2048),
      campaignImageUrl: optionalText(2048),
      editorialImageUrl: optionalText(2048),
      contactEmail: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
      contactPhone: optionalText(32),
      whatsappNumber: optionalText(32),
      address_ar: optionalText(300),
      address_en: optionalText(300),
      instagramUrl: optionalText(2048),
      tiktokUrl: optionalText(2048),
      facebookUrl: optionalText(2048),
    });
    const parsed = storefrontSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_STOREFRONT_SETTINGS' });
      return;
    }

    try {
      await adminDb.collection('settings').doc('storefront').set({
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminUser.uid,
      }, { merge: true });
      await adminDb.collection('auditLogs').add({
        actorUid: adminUser.uid,
        actorRole: adminUser.role,
        action: 'UPDATE_STOREFRONT_SETTINGS',
        targetCollection: 'settings',
        targetId: 'storefront',
        createdAt: FieldValue.serverTimestamp(),
      }).catch(() => undefined);
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'STOREFRONT_SAVE_FAILED' });
    }
  });

  app.get('/api/admin/contact-messages', async (req: Request, res: Response) => {
    const owner = await verifyOwnerToken(req);
    if (!owner) {
      res.status(403).json({ ok: false, error: 'UNAUTHORIZED_OWNER_ONLY' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    try {
      const snapshot = await adminDb.collection('contactMessages').orderBy('createdAt', 'desc').limit(200).get();
      res.json({ ok: true, messages: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    } catch {
      res.status(503).json({ ok: false, error: 'CONTACT_MESSAGES_READ_FAILED' });
    }
  });

  app.patch('/api/admin/contact-messages/:id', async (req: Request, res: Response) => {
    const owner = await verifyOwnerToken(req);
    if (!owner) {
      res.status(403).json({ ok: false, error: 'UNAUTHORIZED_OWNER_ONLY' });
      return;
    }
    if (!adminDb || !/^[A-Za-z0-9_-]{1,128}$/.test(req.params.id)) {
      res.status(400).json({ ok: false, error: 'INVALID_MESSAGE_ID' });
      return;
    }
    const parsed = z.object({ status: z.enum(['new', 'read', 'resolved']) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_MESSAGE_STATUS' });
      return;
    }
    try {
      await adminDb.collection('contactMessages').doc(req.params.id).update({
        status: parsed.data.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: owner.uid,
      });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'CONTACT_MESSAGE_UPDATE_FAILED' });
    }
  });

  app.put('/api/admin/discounts', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminPermission(req, 'discounts');
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    const schema = z.object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/),
      type: z.enum(['percentage', 'fixed', 'free_shipping', 'free_item']),
      value: z.number().int().min(0).max(100000000),
      minItems: z.number().int().min(1).max(100).nullable().optional(),
      minOrderPiasters: z.number().int().min(0).nullable().optional(),
      maxDiscountPiasters: z.number().int().min(0).nullable().optional(),
      startsAt: z.string().max(32).nullable().optional(),
      endsAt: z.string().max(32).nullable().optional(),
      usageLimit: z.number().int().min(1).nullable().optional(),
      perCustomerLimit: z.number().int().min(1).nullable().optional(),
      active: z.boolean(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || (parsed.success && parsed.data.type === 'percentage' && (parsed.data.value < 1 || parsed.data.value > 100)) || (parsed.success && parsed.data.type === 'free_item' && !parsed.data.minItems)) {
      res.status(400).json({ ok: false, error: 'INVALID_DISCOUNT' });
      return;
    }
    try {
      const ref = adminDb.collection('discounts').doc(parsed.data.code);
      await adminDb.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        tx.set(ref, {
          ...parsed.data,
          minItems: parsed.data.minItems ?? null,
          minOrderPiasters: parsed.data.minOrderPiasters ?? null,
          maxDiscountPiasters: parsed.data.maxDiscountPiasters ?? null,
          startsAt: parsed.data.startsAt || null,
          endsAt: parsed.data.endsAt || null,
          usageLimit: parsed.data.usageLimit ?? null,
          perCustomerLimit: parsed.data.perCustomerLimit ?? null,
          usedCount: snapshot.exists ? Number(snapshot.data()?.usedCount || 0) : 0,
          createdAt: snapshot.exists ? snapshot.data()?.createdAt : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: adminUser.uid,
        });
      });
      res.json({ ok: true, code: parsed.data.code });
    } catch {
      res.status(503).json({ ok: false, error: 'DISCOUNT_SAVE_FAILED' });
    }
  });

  app.delete('/api/admin/discounts/:code', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminPermission(req, 'discounts');
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }
    const code = typeof req.params.code === 'string' ? req.params.code.toUpperCase() : '';
    if (!adminDb || !/^[A-Z0-9_-]{2,40}$/.test(code)) {
      res.status(400).json({ ok: false, error: 'INVALID_DISCOUNT_CODE' });
      return;
    }
    try {
      await adminDb.collection('discounts').doc(code).delete();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'DISCOUNT_DELETE_FAILED' });
    }
  });

  app.get('/api/promotions/quantity', async (_req: Request, res: Response) => {
    if (!adminDb) {
      res.json({ ok: true, promotion: null });
      return;
    }
    try {
      const snapshot = await adminDb.collection('quantityPromotions').doc('current').get();
      const promotion = snapshot.exists && snapshot.data()?.active ? { id: snapshot.id, ...snapshot.data() } : null;
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ ok: true, promotion });
    } catch {
      res.status(503).json({ ok: false, promotion: null });
    }
  });

  app.get('/api/admin/quantity-promotion', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminPermission(req, 'discounts');
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    try {
      const snapshot = await adminDb.collection('quantityPromotions').doc('current').get();
      res.json({ ok: true, promotion: snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null });
    } catch {
      res.status(503).json({ ok: false, error: 'PROMOTION_READ_FAILED' });
    }
  });

  app.put('/api/admin/quantity-promotion', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminPermission(req, 'discounts');
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    const schema = z.object({
      minItems: z.number().int().min(2).max(100),
      rewardType: z.enum(['percentage', 'fixed', 'free_item', 'free_shipping']),
      value: z.number().int().min(0).max(100000000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || (parsed.success && parsed.data.rewardType === 'percentage' && (parsed.data.value < 1 || parsed.data.value > 100)) || (parsed.success && parsed.data.rewardType === 'fixed' && parsed.data.value < 1)) {
      res.status(400).json({ ok: false, error: 'INVALID_QUANTITY_PROMOTION' });
      return;
    }
    try {
      await adminDb.collection('quantityPromotions').doc('current').set({
        ...parsed.data,
        active: true,
        updatedBy: adminUser.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.json({ ok: true, id: 'current' });
    } catch {
      res.status(503).json({ ok: false, error: 'PROMOTION_SAVE_FAILED' });
    }
  });

  app.delete('/api/admin/quantity-promotion', async (req: Request, res: Response) => {
    const adminUser = await verifyAdminPermission(req, 'discounts');
    if (!adminUser) {
      res.status(403).json({ ok: false, error: 'ADMIN_PERMISSION_REQUIRED' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({ ok: false, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }
    try {
      await adminDb.collection('quantityPromotions').doc('current').set({
        active: false,
        updatedBy: adminUser.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'PROMOTION_UPDATE_FAILED' });
    }
  });

  // Server-authoritative Checkout (when Firebase Admin credentials are available)
  const checkoutLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyPrefix: 'checkout',
  });

  app.post('/api/checkout', checkoutLimiter, async (req: Request, res: Response) => {
    if (!adminDb) {
      res.status(503).json({ ok: false, blocked: true, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }

    const schema = z.object({
      idempotencyKey: z.string().min(8).max(128),
      locale: z.enum(['ar', 'en']),
      userId: z.string().max(128).nullable().optional(),
      items: z
        .array(
          z.object({
            productId: z.string().min(1).max(128),
            variantId: z.string().min(1).max(128),
            quantity: z.number().int().min(1).max(20),
          })
        )
        .min(1)
        .max(50),
      discountCode: z.string().trim().max(40).nullable().optional(),
      paymentMethod: z.enum(['cod', 'instapay', 'paymob']),
      receiptUrl: z.string().max(500).optional(),
      shippingAddress: z.object({
        fullName: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(6).max(32),
        email: z.string().trim().email().max(254),
        country: z.string().trim().min(2).max(60),
        governorateCode: z.string().trim().min(2).max(32),
        governorateName_ar: z.string().trim().max(80),
        governorateName_en: z.string().trim().max(80),
        city: z.string().trim().min(1).max(100),
        area: z.string().trim().min(1).max(100),
        street: z.string().trim().min(1).max(200),
        building: z.string().trim().min(1).max(50),
        floor: z.string().trim().max(20).optional().default(''),
        apartment: z.string().trim().max(20).optional().default(''),
        landmark: z.string().trim().max(200).optional().default(''),
        deliveryNotes: z.string().trim().max(500).optional().default(''),
      }),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'VALIDATION_FAILED' });
      return;
    }

    const paymobReady =
      process.env.PAYMOB_ENABLED === 'true' &&
      isConfiguredSecret(process.env.PAYMOB_API_KEY) &&
      isConfiguredSecret(process.env.PAYMOB_HMAC_SECRET) &&
      isConfiguredSecret(process.env.PAYMOB_INTEGRATION_ID);

    if (parsed.data.paymentMethod === 'paymob' && !paymobReady) {
      res.status(400).json({ ok: false, error: 'PAYMOB_DISABLED' });
      return;
    }

    try {
      const existingOrderSnap = await adminDb
        .collection('orders')
        .where('idempotencyKey', '==', parsed.data.idempotencyKey)
        .limit(1)
        .get();

      if (!existingOrderSnap.empty) {
        const docSnap = existingOrderSnap.docs[0];
        res.json({ ok: true, orderId: docSnap.id, orderNumber: docSnap.data().orderNumber });
        return;
      }

      const year = new Date().getFullYear();
      const counterRef = adminDb.collection('counters').doc(`orders_${year}`);
      const orderRef = adminDb.collection('orders').doc();

      const result = await adminDb.runTransaction(async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const nextSeq = (counterSnap.exists ? Number(counterSnap.data()?.value || 0) : 0) + 1;
        const orderNumber = `FAV-${year}-${String(nextSeq).padStart(6, '0')}`;

        // Complete every Firestore read before the first write in this transaction.
        const itemDocuments = parsed.data.items.map((item) => ({
          item,
          productRef: adminDb!.collection('products').doc(item.productId),
          variantRef: adminDb!.collection('variants').doc(item.variantId),
        }));
        const itemSnapshots = await Promise.all(itemDocuments.map(async (row) => {
          const [productSnap, variantSnap] = await Promise.all([tx.get(row.productRef), tx.get(row.variantRef)]);
          return { ...row, productSnap, variantSnap };
        }));

        const preparedItems = itemSnapshots.map(({ item, productRef, variantRef, productSnap, variantSnap }) => {
          if (!productSnap.exists || productSnap.data()?.status !== 'published') throw new Error('PRODUCT_UNAVAILABLE');
          if (!variantSnap.exists || !variantSnap.data()?.active) throw new Error('VARIANT_UNAVAILABLE');
          const variant = variantSnap.data()!;
          const product = productSnap.data()!;
          const currentStock = Number(variant.stock || 0);
          if (currentStock < item.quantity) throw new Error(`INSUFFICIENT_STOCK:${variant.sku}`);
          const unitPrice = Number(variant.pricePiasters ?? product.salePricePiasters ?? product.pricePiasters);
          return { item, productRef, variantRef, variant, product, currentStock, unitPrice, lineTotal: unitPrice * item.quantity };
        });
        const subtotalPiasters = preparedItems.reduce((sum, row) => sum + row.lineTotal, 0);
        const itemsSnapshot: Record<string, unknown>[] = preparedItems.map(({ item, product, variant, unitPrice, lineTotal }) => ({
          productId: item.productId,
          variantId: item.variantId,
          slug: product.slug,
          name_ar: product.name_ar,
          name_en: product.name_en,
          colorKey: variant.colorKey,
          colorName_ar: variant.colorName_ar,
          colorName_en: variant.colorName_en,
          size: variant.size,
          sku: variant.sku,
          unitPricePiasters: unitPrice,
          quantity: item.quantity,
          lineTotalPiasters: lineTotal,
        }));

        const zonesSnap = await tx.get(adminDb.collection('shippingZones').where('active', '==', true));
        const normalizedCode = parsed.data.discountCode?.trim().toUpperCase() || '';
        const discountRef = normalizedCode ? adminDb.collection('discounts').doc(normalizedCode) : null;
        const discountSnap = discountRef ? await tx.get(discountRef) : null;
        const promotionSnap = await tx.get(adminDb.collection('quantityPromotions').doc('current'));

        // Compute shipping from shippingZones
        let shippingPiasters = 0;
        let codFeePiasters = 0;
        for (const zDoc of zonesSnap.docs) {
          const zData = zDoc.data();
          const codes: string[] = Array.isArray(zData.governorateCodes)
            ? zData.governorateCodes
            : [];
          if (codes.includes(parsed.data.shippingAddress.governorateCode)) {
            const fee = Number(zData.feePiasters || 0);
            const threshold = zData.freeShippingThresholdPiasters
              ? Number(zData.freeShippingThresholdPiasters)
              : null;
            shippingPiasters =
              threshold !== null && subtotalPiasters >= threshold ? 0 : fee;
            codFeePiasters =
              parsed.data.paymentMethod === 'cod'
                ? Number(zData.codFeePiasters || 0)
                : 0;
            break;
          }
        }

        // Discount evaluation
        let discountPiasters = 0;
        let appliedCode: string | null = null;
        if (discountSnap?.exists && discountSnap.data()?.active) {
            const dData = discountSnap.data()!;
            const nowIso = new Date().toISOString();
            const minOk =
              !dData.minOrderPiasters ||
              subtotalPiasters >= Number(dData.minOrderPiasters);
            const itemCount = parsed.data.items.reduce((sum, item) => sum + item.quantity, 0);
            const minItemsOk = !dData.minItems || itemCount >= Number(dData.minItems);
            const dateOk =
              (!dData.startsAt || nowIso >= String(dData.startsAt)) &&
              (!dData.endsAt || nowIso <= String(dData.endsAt));
            const limitOk =
              !dData.usageLimit ||
              Number(dData.usedCount || 0) < Number(dData.usageLimit);

            if (minOk && minItemsOk && dateOk && limitOk) {
              if (dData.type === 'percentage') {
                discountPiasters = Math.floor(
                  (subtotalPiasters * Number(dData.value)) / 100
                );
                if (dData.maxDiscountPiasters) {
                  discountPiasters = Math.min(
                    discountPiasters,
                    Number(dData.maxDiscountPiasters)
                  );
                }
              } else if (dData.type === 'fixed') {
                discountPiasters = Math.min(subtotalPiasters, Number(dData.value));
              } else if (dData.type === 'free_item') {
                const lowestUnitPrice = itemsSnapshot.reduce(
                  (min, item) => Math.min(min, Number(item.unitPricePiasters || 0)),
                  Number.POSITIVE_INFINITY
                );
                discountPiasters = Math.min(subtotalPiasters, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
              } else if (dData.type === 'free_shipping') {
                shippingPiasters = 0;
              }
              appliedCode = normalizedCode;
            }
        }
        const promotion = promotionSnap.exists ? promotionSnap.data() : null;
        const itemCount = parsed.data.items.reduce((sum, item) => sum + item.quantity, 0);
        if (promotion?.active === true && itemCount >= Number(promotion.minItems || 1)) {
          if (promotion.rewardType === 'percentage') {
            discountPiasters = Math.max(discountPiasters, Math.floor(subtotalPiasters * Number(promotion.value || 0) / 100));
          } else if (promotion.rewardType === 'fixed') {
            discountPiasters = Math.max(discountPiasters, Math.min(subtotalPiasters, Number(promotion.value || 0)));
          } else if (promotion.rewardType === 'free_item') {
            const lowestUnitPrice = itemsSnapshot.reduce((min, item) => Math.min(min, Number(item.unitPricePiasters || 0)), Number.POSITIVE_INFINITY);
            discountPiasters = Math.max(discountPiasters, Number.isFinite(lowestUnitPrice) ? lowestUnitPrice : 0);
          } else if (promotion.rewardType === 'free_shipping') {
            shippingPiasters = 0;
          }
        }

        const totalPiasters = Math.max(
          1,
          subtotalPiasters - discountPiasters + shippingPiasters + codFeePiasters
        );

        const paymentStatus =
          parsed.data.paymentMethod === 'instapay'
            ? 'awaiting_verification'
            : 'pending';

        const codCollectionStatus =
          parsed.data.paymentMethod === 'cod'
            ? 'pending_collection'
            : 'not_applicable';

        const timeline = [
          {
            status: 'pending',
            at: new Date().toISOString(),
          },
        ];

        for (const row of preparedItems) {
          tx.update(row.variantRef, {
            stock: row.currentStock - row.item.quantity,
            soldCount: Number(row.variant.soldCount || 0) + row.item.quantity,
            updatedAt: FieldValue.serverTimestamp(),
          });
          tx.set(adminDb.collection('stockMovements').doc(), {
            productId: row.item.productId,
            variantId: row.item.variantId,
            sku: row.variant.sku,
            previousQuantity: row.currentStock,
            newQuantity: row.currentStock - row.item.quantity,
            delta: -row.item.quantity,
            reason: `Order ${orderNumber}`,
            orderId: orderRef.id,
            actorUid: parsed.data.userId || 'guest',
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        if (discountSnap?.exists && appliedCode) {
          tx.update(discountSnap.ref, {
            usedCount: Number(discountSnap.data()?.usedCount || 0) + 1,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        tx.set(counterRef, { value: nextSeq, updatedAt: FieldValue.serverTimestamp() });
        tx.set(orderRef, {
          orderNumber,
          userId: parsed.data.userId || null,
          idempotencyKey: parsed.data.idempotencyKey,
          locale: parsed.data.locale,
          currency: 'EGP',
          status: 'pending',
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus,
          codCollectionStatus,
          subtotalPiasters,
          discountPiasters,
          shippingPiasters,
          codFeePiasters,
          totalPiasters,
          discountCode: appliedCode,
          receiptUrl: parsed.data.receiptUrl || '',
          itemsSnapshot,
          shippingAddress: parsed.data.shippingAddress,
          statusTimeline: timeline,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const phoneLast4 = parsed.data.shippingAddress.phone.replace(/\D/g, '').slice(-4);
        tx.set(adminDb!.collection('orderLookups').doc(orderNumber), {
          orderNumber,
          phoneLast4,
          status: 'pending',
          paymentStatus,
          paymentMethod: parsed.data.paymentMethod,
          currency: 'EGP',
          totalPiasters,
          itemsCount: itemsSnapshot.length,
          statusTimeline: timeline,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { orderId: orderRef.id, orderNumber };
      });

      const isAr = parsed.data.locale === 'ar';
      await sendTransactionalEmail({
        to: parsed.data.shippingAddress.email,
        subject: isAr
          ? `تأكيد الطلب ${result.orderNumber} | FAVMO`
          : `Order Confirmation ${result.orderNumber} | FAVMO`,
        text: isAr
          ? `تم استلام طلبك رقم ${result.orderNumber} بنجاح.`
          : `Your FAVMO order ${result.orderNumber} has been received.`,
        html: `<div style="background:#000;color:#fff;padding:32px;font-family:sans-serif"><h1 style="letter-spacing:0.2em">FAVMO</h1><p>${escapeHtml(
          isAr
            ? `تم استلام طلبك رقم ${result.orderNumber} بنجاح.`
            : `Your FAVMO order ${result.orderNumber} has been received.`
        )}</p></div>`,
      });

      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CHECKOUT_FAILED';
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Could not load the default credentials')) {
        res.status(503).json({ ok: false, blocked: true, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
        return;
      }
      res.status(400).json({ ok: false, error: msg });
    }
  });

  // Rate-limited Order Tracking endpoint
  const trackLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyPrefix: 'track-order',
  });

  app.post('/api/track-order', trackLimiter, async (req: Request, res: Response) => {
    const schema = z.object({
      orderNumber: z.string().trim().regex(/^FAV-[0-9]{4}-[0-9]{6}$/),
      phone: z.string().trim().min(4).max(32),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_TRACKING_INPUT' });
      return;
    }

    if (!adminDb) {
      res.status(503).json({ ok: false, blocked: true, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
      return;
    }

    try {
      const snap = await adminDb
        .collection('orderLookups')
        .doc(parsed.data.orderNumber)
        .get();
      if (!snap.exists) {
        res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND' });
        return;
      }
      const data = snap.data()!;
      const submittedLast4 = parsed.data.phone.replace(/\D/g, '').slice(-4);
      if (data.phoneLast4 !== submittedLast4) {
        res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND' });
        return;
      }
      res.json({ ok: true, tracking: data });
    } catch {
      res.status(503).json({ ok: false, blocked: true, error: 'FIREBASE_ADMIN_UNAVAILABLE' });
    }
  });

  // Paymob Initiate Payment Session (Test / Live mode aware, disabled until configured)
  app.post('/api/paymob/initiate', checkoutLimiter, async (req: Request, res: Response) => {
    const paymobMode = process.env.PAYMOB_MODE === 'live' ? 'live' : 'test';
    if (!isPaymobProviderConfigured() || !isConfiguredSecret(process.env.PAYMOB_IFRAME_ID)) {
      res.status(503).json({
        ok: false,
        blocked: true,
        error: 'PAYMOB_CREDENTIALS_MISSING',
        paymobMode,
      });
      return;
    }

    const schema = z.object({
      orderId: z.string().trim().min(1).max(128),
      orderNumber: z.string().trim().regex(/^FAV-[0-9]{4}-[0-9]{6}$/),
      amountPiasters: z.number().int().min(100),
      billing: z.object({
        fullName: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(254),
        phone: z.string().trim().min(6).max(32),
        city: z.string().trim().min(1).max(100),
        country: z.string().trim().min(2).max(60).optional().default('EG'),
      }),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'VALIDATION_FAILED' });
      return;
    }

    try {
      const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY!.trim() }),
      });
      const authData = (await authRes.json()) as { token?: string };
      if (!authRes.ok || !authData.token) {
        throw new Error('PAYMOB_AUTH_FAILED');
      }

      const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: authData.token,
          delivery_needed: false,
          amount_cents: parsed.data.amountPiasters,
          currency: 'EGP',
          merchant_order_id: parsed.data.orderNumber,
          items: [],
        }),
      });
      const orderData = (await orderRes.json()) as { id?: number };
      if (!orderRes.ok || !orderData.id) {
        throw new Error('PAYMOB_ORDER_REGISTER_FAILED');
      }

      const [firstName, ...restName] = parsed.data.billing.fullName.split(' ');
      const lastName = restName.join(' ') || 'Customer';

      const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: authData.token,
          amount_cents: parsed.data.amountPiasters,
          expiration: 3600,
          order_id: orderData.id,
          billing_data: {
            apartment: 'NA',
            email: parsed.data.billing.email,
            floor: 'NA',
            first_name: firstName || 'FAVMO',
            street: 'NA',
            building: 'NA',
            phone_number: parsed.data.billing.phone,
            shipping_method: 'NA',
            postal_code: 'NA',
            city: parsed.data.billing.city,
            country: parsed.data.billing.country === 'Egypt' ? 'EG' : parsed.data.billing.country,
            last_name: lastName,
            state: 'NA',
          },
          currency: 'EGP',
          integration_id: Number(process.env.PAYMOB_INTEGRATION_ID),
        }),
      });
      const keyData = (await keyRes.json()) as { token?: string };
      if (!keyRes.ok || !keyData.token) {
        throw new Error('PAYMOB_KEY_FAILED');
      }

      const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID!.trim()}?payment_token=${encodeURIComponent(keyData.token)}`;
      res.json({
        ok: true,
        paymobMode,
        iframeUrl,
        paymobOrderId: orderData.id,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'PAYMOB_INITIATE_FAILED',
        paymobMode,
      });
    }
  });

  // Paymob HMAC-verified webhook (disabled until PAYMOB_ENABLED === 'true')
  app.post('/api/paymob/webhook', async (req: Request, res: Response) => {
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET || '';
    if (process.env.PAYMOB_ENABLED !== 'true' || !isConfiguredSecret(hmacSecret)) {
      res.status(503).json({ ok: false, error: 'PAYMOB_DISABLED' });
      return;
    }

    const receivedHmac = String(req.query.hmac || '');
    const obj = req.body?.obj;
    if (!obj || !receivedHmac) {
      res.status(400).json({ ok: false, error: 'INVALID_WEBHOOK_PAYLOAD' });
      return;
    }

    const concatenated = [
      obj.amount_cents,
      obj.created_at,
      obj.currency,
      obj.error_occured,
      obj.has_parent_transaction,
      obj.id,
      obj.integration_id,
      obj.is_3d_secure,
      obj.is_auth,
      obj.is_capture,
      obj.is_refunded,
      obj.is_standalone_payment,
      obj.is_voided,
      obj.order?.id,
      obj.owner,
      obj.pending,
      obj.source_data?.pan,
      obj.source_data?.sub_type,
      obj.source_data?.type,
      obj.success,
    ]
      .map((v) => String(v ?? ''))
      .join('');

    const computedHmac = crypto
      .createHmac('sha512', hmacSecret)
      .update(concatenated)
      .digest('hex');

    if (
      computedHmac.length !== receivedHmac.length ||
      !crypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(receivedHmac))
    ) {
      res.status(401).json({ ok: false, error: 'INVALID_HMAC' });
      return;
    }

    const merchantOrderId = String(obj.order?.merchant_order_id || '');
    const txId = String(obj.id || '');
    const paymentSuccess = obj.success === true && obj.is_voided !== true && obj.is_refunded !== true;

    if (adminDb && merchantOrderId && txId) {
      try {
        const payDocRef = adminDb.collection('payments').doc(`paymob_${txId}`);
        const existingPay = await payDocRef.get();
        if (!existingPay.exists) {
          const orderSnap = await adminDb
            .collection('orders')
            .where('orderNumber', '==', merchantOrderId)
            .limit(1)
            .get();

          if (!orderSnap.empty) {
            const oDoc = orderSnap.docs[0];
            const oData = oDoc.data();
            const nextPayStatus = paymentSuccess ? 'paid' : 'failed';
            const nextOrderStatus = paymentSuccess ? 'confirmed' : oData.status;

            await payDocRef.set({
              orderId: oDoc.id,
              orderNumber: merchantOrderId,
              method: 'paymob',
              status: nextPayStatus,
              amountPiasters: Number(obj.amount_cents || oData.totalPiasters || 0),
              currency: 'EGP',
              providerTransactionId: txId,
              webhookEventIds: [txId],
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });

            await oDoc.ref.update({
              paymentStatus: nextPayStatus,
              status: nextOrderStatus,
              updatedAt: FieldValue.serverTimestamp(),
            });

            const lookupRef = adminDb.collection('orderLookups').doc(merchantOrderId);
            await lookupRef.update({
              paymentStatus: nextPayStatus,
              status: nextOrderStatus,
              updatedAt: FieldValue.serverTimestamp(),
            });

            if (oData.shippingAddress?.email) {
              const isAr = oData.locale === 'ar';
              await sendTransactionalEmail({
                to: oData.shippingAddress.email,
                subject: isAr
                  ? `تأكيد الدفع للطلب ${merchantOrderId} | FAVMO`
                  : `Payment ${paymentSuccess ? 'Confirmed' : 'Failed'} for ${merchantOrderId} | FAVMO`,
                text: isAr
                  ? `حالة الدفع للطلب ${merchantOrderId}: ${nextPayStatus}`
                  : `Payment status for order ${merchantOrderId}: ${nextPayStatus}`,
                html: `<div style="background:#000;color:#fff;padding:32px;font-family:sans-serif"><h1>FAVMO</h1><p>${escapeHtml(merchantOrderId)} — ${escapeHtml(nextPayStatus)}</p></div>`,
              });
            }
          }
        }
      } catch {
        // Admin DB unreachable in local sandbox without SA key
      }
    }

    res.json({ ok: true });
  });

  const newsletterLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    keyPrefix: 'newsletter',
  });

  app.post('/api/newsletter', newsletterLimiter, async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().trim().toLowerCase().email().max(254),
      locale: z.enum(['ar', 'en']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'INVALID_EMAIL' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({
        ok: false,
        blocked: true,
        error: 'FIREBASE_ADMIN_UNAVAILABLE',
      });
      return;
    }

    try {
      const normalizedId = Buffer.from(parsed.data.email)
        .toString('base64url')
        .slice(0, 120);
      const ref = adminDb.collection('subscribers').doc(normalizedId);
      const existing = await ref.get();
      if (existing.exists) {
        res.json({ ok: true, alreadySubscribed: true });
        return;
      }
      await ref.set({
        email: parsed.data.email,
        locale: parsed.data.locale,
        status: 'subscribed',
        createdAt: FieldValue.serverTimestamp(),
      });
      res.status(201).json({ ok: true, alreadySubscribed: false });
    } catch {
      res.status(503).json({
        ok: false,
        blocked: true,
        error: 'FIRESTORE_WRITE_ERROR',
      });
    }
  });

  const contactLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: 'contact',
  });

  app.post('/api/contact', contactLimiter, async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(254),
      phone: z.string().trim().max(32).optional().default(''),
      category: z.enum(['general', 'product_issue', 'website_issue', 'order_request', 'suggestion']).optional().default('general'),
      subject: z.string().trim().min(1).max(200),
      message: z.string().trim().min(10).max(4000),
      locale: z.enum(['ar', 'en']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'VALIDATION_FAILED' });
      return;
    }
    if (!adminDb) {
      res.status(503).json({
        ok: false,
        blocked: true,
        error: 'FIREBASE_ADMIN_UNAVAILABLE',
      });
      return;
    }

    try {
      const docRef = await adminDb.collection('contactMessages').add({
        ...parsed.data,
        status: 'new',
        createdAt: FieldValue.serverTimestamp(),
      });
      const notification = OWNER_ADMIN_EMAIL
        ? await sendTransactionalEmail({
            to: OWNER_ADMIN_EMAIL,
            subject: `FAVMO: ${parsed.data.subject}`,
            text: `${parsed.data.name} (${parsed.data.email}) sent a FAVMO message.\n\n${parsed.data.message}`,
            html: `<div style="font-family:sans-serif"><h2>New FAVMO customer message</h2><p><b>From:</b> ${escapeHtml(parsed.data.name)} (${escapeHtml(parsed.data.email)})</p><p><b>Subject:</b> ${escapeHtml(parsed.data.subject)}</p><p>${escapeHtml(parsed.data.message).replaceAll('\n', '<br>')}</p></div>`,
          })
        : { sent: false, skipped: true };
      res.status(201).json({ ok: true, id: docRef.id, emailSent: notification.sent });
    } catch {
      res.status(503).json({
        ok: false,
        blocked: true,
        error: 'FIRESTORE_WRITE_ERROR',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Frontend & SSR Language Routing
  // ---------------------------------------------------------------------------
  let vite: Awaited<ReturnType<typeof import('vite').createServer>> | null = null;
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist'), { index: false }));
  }

  app.get('/', (req: Request, res: Response) => {
    const preferred = detectLocaleFromRequest(req);
    res.redirect(302, `/${preferred}`);
  });

  app.use('*', async (req: Request, res: Response, next) => {
    if (req.originalUrl.startsWith('/api/')) {
      res.status(404).json({ ok: false, error: 'API_NOT_FOUND' });
      return;
    }

    try {
      const templatePath = IS_PROD
        ? path.join(__dirname, 'dist', 'index.html')
        : path.join(__dirname, 'index.html');
      let template = fs.readFileSync(templatePath, 'utf8');

      if (!IS_PROD && vite) {
        template = await vite.transformIndexHtml(req.originalUrl, template);
      }

      const urlMatch = req.originalUrl.match(/^\/(ar|en)(?=\/|\?|$)/);
      const locale: 'ar' | 'en' = urlMatch
        ? (urlMatch[1] as 'ar' | 'en')
        : detectLocaleFromRequest(req);
      const dir = locale === 'ar' ? 'rtl' : 'ltr';
      const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const { pageTitle, baseDescription, metaHtml, jsonLdHtml } = buildSsrMeta(
        locale,
        req.originalUrl,
        origin
      );

      const html = template
        .replace('<html lang="en" dir="ltr">', `<html lang="${locale}" dir="${dir}">`)
        .replace(
          '<title>FAVMO — CREATE BEYOND LIMITS.</title>',
          `<title>${escapeHtml(pageTitle)}</title>`
        )
        .replace(
          'content="FAVMO official bilingual Arabic and English streetwear platform. Designed for those who refuse to follow ordinary limits."',
          `content="${escapeHtml(baseDescription)}"`
        )
        .replace('<!--SSR_META_PLACEHOLDER-->', metaHtml)
        .replace('<!--SSR_JSONLD_PLACEHOLDER-->', jsonLdHtml);

      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    } catch (err) {
      if (!IS_PROD && vite && err instanceof Error) {
        vite.ssrFixStacktrace(err);
      }
      next(err);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FAVMO full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

createServer();
