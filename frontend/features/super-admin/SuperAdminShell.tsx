import type { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default function SuperAdminShell({
  userName,
  children,
}: {
  userName: string
  children: ReactNode
}) {
  return (
    <div className="app-layout" data-role="super_admin">
      <Sidebar role="super_admin" userName={userName} />
      <div className="main-area">
        <Topbar title="" role="super_admin" />
        <div className="content-area">{children}</div>
      </div>
    </div>
  )
}
