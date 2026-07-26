import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Menu, LogOut, Home } from "lucide-react"

interface DashboardHeaderProps {
  onMenuClick?: () => void
  userName?: string
  onLogout?: () => void
}

export function DashboardHeader({ onMenuClick, userName = "使用者", onLogout }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <button
        className="md:hidden p-2 -ml-2"
        onClick={onMenuClick}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Logo - visible on mobile */}
      <Link to="/dashboard" className="md:hidden flex items-center gap-2">
        <img
          src="/logo.png"
          alt="鴻勁公益慈善基金會"
          className="h-8 w-auto"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        <span className="font-bold text-sm">管理後台</span>
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <Home className="h-4 w-4" />
            <span className="sr-only">返回首頁</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline-block text-sm font-medium">
            {userName}
          </span>
        </div>

        <Button variant="ghost" size="icon" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          <span className="sr-only">登出</span>
        </Button>
      </div>
    </header>
  )
}
