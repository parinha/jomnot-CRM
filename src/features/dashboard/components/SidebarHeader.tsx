'use client';

import type { CompanyProfile } from '@/src/types';

export default function SidebarHeader({ profile }: { profile: CompanyProfile }) {
  const initial = (profile.name || 'S').charAt(0).toUpperCase();

  return (
    <div className="h-16 flex items-center gap-3 px-4 border-b border-white/[0.08] shrink-0">
      {profile.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logo} alt="Logo" className="h-8 w-8 object-contain rounded-lg" />
      ) : (
        <div className="h-8 w-8 rounded-lg bg-[#FFC206] flex items-center justify-center text-zinc-900 text-xs font-bold shrink-0 shadow-md shadow-amber-500/30">
          {initial}
        </div>
      )}
      <span className="text-sm font-semibold text-white truncate">{profile.name || 'Studio'}</span>
    </div>
  );
}
