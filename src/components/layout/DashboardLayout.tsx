import { useState } from "react"
import { Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Sidebar } from "./Sidebar"
import { DashboardHeader } from "./DashboardHeader"
import { MobileSidebar } from "./MobileSidebar"

export function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, isAdmin, isSuperAdmin, logout } = useAuth()

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <Sidebar isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          onMenuClick={() => setMobileMenuOpen(true)}
          userName={user?.name || '使用者'}
          onLogout={logout}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
