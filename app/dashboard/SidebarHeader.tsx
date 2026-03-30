'use client'

import { useStore } from './AppStore'

export default function SidebarHeader() {
  const { companyProfile: profile } = useStore()
  const initial = (profile.name || 'S').charAt(0).toUpperCase()

  return (
    <div className="h-16 flex items-center gap-3 px-4 border-b border-zinc-200 shrink-0">
      {profile.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.logo}
          alt="Logo"
          className="h-8 w-8 object-contain rounded"
        />
      ) : (
        <div className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-zinc-900 text-xs font-bold shrink-0">
          {initial}
        </div>
      )}
      <span className="text-sm font-semibold text-zinc-900 truncate">
        {profile.name || 'Studio'}
      </span>
    </div>
  )
}
