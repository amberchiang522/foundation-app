import { useState, useRef } from "react"
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
  Image,
  MessageSquare,
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
  { href: "/dashboard/event-reviews", icon: Image, label: "活動回顧" },
  { href: "/dashboard/forum", icon: MessageSquare, label: "討論管理" },
  { href: "/dashboard/reports", icon: BarChart3, label: "報表中心" },
  { href: "/dashboard/settings", icon: Settings, label: "系統設定" },
]

const superAdminNavItems = [
  { href: "/dashboard/accounts", icon: Shield, label: "帳號管理" },
]

export function Sidebar({ isAdmin = false, isSuperAdmin = false }: SidebarProps) {
  const location = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    // 清除關閉定時器
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    // 1秒延遲後展開
    openTimeoutRef.current = setTimeout(() => {
      setIsExpanded(true)
    }, 1000)
  }

  const handleMouseLeave = () => {
    // 清除開啟定時器
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current)
      openTimeoutRef.current = null
    }
    // 1秒延遲後收起
    closeTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false)
    }, 1000)
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-background transition-all duration-300 ease-in-out overflow-hidden",
        isExpanded ? "w-64" : "w-14"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={cn("p-3 transition-all duration-300", isExpanded && "p-6")}>
        <Link to="/dashboard" className="inline-block">
          <img
            src="/logo.png"
            alt="鴻勁公益慈善基金會"
            className={cn(
              "w-auto object-contain transition-all duration-300",
              isExpanded ? "h-10" : "h-8"
            )}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </Link>
      </div>
      <ScrollArea className={cn("flex-1 px-2 transition-all duration-300", isExpanded && "px-3")}>
        <nav className="space-y-1">
          {volunteerNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={item.label}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className={cn(
                "transition-opacity duration-300 whitespace-nowrap overflow-hidden",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>
                {item.label}
              </span>
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="my-4 border-t" />
              <p className={cn(
                "px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider transition-opacity duration-300 whitespace-nowrap",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>
                管理功能
              </p>
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    location.pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={cn(
                    "transition-opacity duration-300 whitespace-nowrap overflow-hidden",
                    isExpanded ? "opacity-100" : "opacity-0"
                  )}>
                    {item.label}
                  </span>
                </Link>
              ))}
            </>
          )}

          {isSuperAdmin && (
            <>
              <div className="my-4 border-t" />
              <p className={cn(
                "px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider transition-opacity duration-300 whitespace-nowrap",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>
                超級管理
              </p>
              {superAdminNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    location.pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={cn(
                    "transition-opacity duration-300 whitespace-nowrap overflow-hidden",
                    isExpanded ? "opacity-100" : "opacity-0"
                  )}>
                    {item.label}
                  </span>
                </Link>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>
    </aside>
  )
}
