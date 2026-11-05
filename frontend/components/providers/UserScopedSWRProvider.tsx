'use client'

import { useMemo, type ReactNode } from 'react'
import { SWRConfig } from 'swr'

export default function UserScopedSWRProvider({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const config = useMemo(() => ({ provider: () => new Map() }), [])

  return (
    <SWRConfig key={userId} value={config}>
      {children}
    </SWRConfig>
  )
}
