import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { SkeletonBox } from './Skeleton';

export function CustomerAuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { localePath } = useLocale();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-20">
        <div className="max-w-md space-y-4">
          <SkeletonBox className="h-8 w-44" />
          <SkeletonBox className="h-12 w-full" />
          <SkeletonBox className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    const redirectTarget = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`${localePath('/account')}?gate=1&redirect=${encodeURIComponent(redirectTarget)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
