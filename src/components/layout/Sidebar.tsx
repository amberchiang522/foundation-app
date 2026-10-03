import { useState } from "react"
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

  return (
    <>
      {/* Fixed width placeholder to maintain layout */}
      <div className="hidden md:block w-12 shrink-0" />

      {/* Actual sidebar - positioned fixed as overlay */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-background transition-all duration-150 ease-out overflow-hidden",
          "fixed left-0 top-14 h-[calc(100vh-3.5rem)] z-40",
          isExpanded ? "w-48 shadow-xl" : "w-12"
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {volunteerNavItems.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsExpanded(false)}
                  className={cn(
                    "flex items-center rounded-md h-8 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  {/* Icon - fixed width */}
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4" />
                  </div>
                  {/* Label - only visible when expanded */}
                  <span className={cn(
                    "text-sm whitespace-nowrap overflow-hidden transition-all duration-150",
                    isExpanded ? "opacity-100 w-auto pr-3" : "opacity-0 w-0"
                  )}>
                    {item.label}
                  </span>
                </Link>
              )
            })}

            {isAdmin && (
              <>
                <div className="my-3 border-t mx-1" />
                {adminNavItems.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setIsExpanded(false)}
                      className={cn(
                        "flex items-center rounded-md h-8 transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      title={!isExpanded ? item.label : undefined}
                    >
                      <div className="w-8 h-8 flex items-center justify-center shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className={cn(
                        "text-sm whitespace-nowrap overflow-hidden transition-all duration-150",
                        isExpanded ? "opacity-100 w-auto pr-3" : "opacity-0 w-0"
                      )}>
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </>
            )}

            {isSuperAdmin && (
              <>
                <div className="my-3 border-t mx-1" />
                {superAdminNavItems.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setIsExpanded(false)}
                      className={cn(
                        "flex items-center rounded-md h-8 transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      title={!isExpanded ? item.label : undefined}
                    >
                      <div className="w-8 h-8 flex items-center justify-center shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className={cn(
                        "text-sm whitespace-nowrap overflow-hidden transition-all duration-150",
                        isExpanded ? "opacity-100 w-auto pr-3" : "opacity-0 w-0"
                      )}>
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </>
            )}
          </nav>
        </ScrollArea>
      </aside>
    </>
  )
}
