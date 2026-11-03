'use client';

import { useEffect } from 'react';
import { useCompanyProfile } from '@/src/hooks/useSettings';
import { applyBrand } from '@/src/lib/brand';

/** Keeps the app's brand CSS variables in sync with Settings → Company → Brand color. */
export default function BrandTheme() {
  const { data: profile, isLoading } = useCompanyProfile();
  const color = profile?.brandColor;
  useEffect(() => {
    if (!isLoading) applyBrand(color);
  }, [color, isLoading]);
  return null;
}
