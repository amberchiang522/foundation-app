import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  User,
  Calendar,
  Clock,
  Users,
  FileCheck,
  FolderKanban,
  CalendarDays,
  BarChart3,
  Settings,
  Shield,
  Building2,
} from "lucide-react"

interface SidebarProps {
  isAdmin?: boolean
  isSuperAdmin?: boolean
}

const volunteerNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "儀表板" },
  { href: "/dashboard/profile", icon: User, label: "個人資料" },
  { href: "/dashboard/my-activities", icon: Calendar, label: "我的報名" },
  { href: "/dashboard/my-service", icon: Clock, label: "服務時數" },
]

const adminNavItems = [
  { href: "/dashboard/volunteers", icon: Users, label: "志工管理" },
  { href: "/dashboard/applications", icon: FileCheck, label: "申請審核" },
  { href: "/dashboard/plans", icon: FolderKanban, label: "計畫管理" },
  { href: "/dashboard/organizations", icon: Building2, label: "機構管理" },
  { href: "/dashboard/activities", icon: CalendarDays, label: "活動管理" },
  { href: "/dashboard/reports", icon: BarChart3, label: "報表中心" },
  { href: "/dashboard/settings", icon: Settings, label: "系統設定" },
]

const superAdminNavItems = [
  { href: "/dashboard/accounts", icon: Shield, label: "帳號管理" },
]

export function Sidebar({ isAdmin = false, isSuperAdmin = false }: SidebarProps) {
  const location = useLocation()

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-background">
      <div className="p-6">
        <Link to="/dashboard" className="inline-block">
          <img
            src="/logo.png"
            alt="鴻勁公益慈善基金會"
            className="h-10 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </Link>
      </div>
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1">
          {volunteerNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="my-4 border-t" />
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                管理功能
              </p>
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    location.pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </>
          )}

          {isSuperAdmin && (
            <>
              <div className="my-4 border-t" />
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                超級管理
              </p>
              {superAdminNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    location.pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>
    </aside>
  )
}
