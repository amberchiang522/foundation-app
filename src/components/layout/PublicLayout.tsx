import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { ScrollToTop } from "./ScrollToTop"

export function PublicLayout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <div className="container py-6">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
