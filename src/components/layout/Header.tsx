import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, user } = useAuth()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">鴻勁公益慈善基金會</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 items-center space-x-6 text-sm font-medium">
          <Link to="/activities" className="transition-colors hover:text-primary">
            活動列表
          </Link>
          <Link to="/apply" className="transition-colors hover:text-primary">
            參加志工
          </Link>
          <Link to="/apply/status" className="transition-colors hover:text-primary">
            申請進度
          </Link>
        </nav>

        <div className="hidden md:flex items-center space-x-2">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user?.name}
              </span>
              <Button asChild>
                <Link to="/dashboard">進入後台</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">登入</Link>
              </Button>
              <Button asChild>
                <Link to="/apply">參加志工</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden ml-auto p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t p-4 space-y-3">
          <Link
            to="/activities"
            className="block py-2 transition-colors hover:text-primary"
            onClick={() => setMobileMenuOpen(false)}
          >
            活動列表
          </Link>
          <Link
            to="/apply"
            className="block py-2 transition-colors hover:text-primary"
            onClick={() => setMobileMenuOpen(false)}
          >
            參加志工
          </Link>
          <Link
            to="/apply/status"
            className="block py-2 transition-colors hover:text-primary"
            onClick={() => setMobileMenuOpen(false)}
          >
            申請進度
          </Link>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="block py-2 transition-colors hover:text-primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              進入後台
            </Link>
          ) : (
            <Link
              to="/login"
              className="block py-2 transition-colors hover:text-primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              登入
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
