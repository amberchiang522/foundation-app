import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { activityService, projectService } from "@/services"
import type { Activity, Plan } from "@/types"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  Sprout,
  Scale,
  HandHeart,
  ChevronRight,
  Calendar,
  MapPin,
  Loader2,
  FolderOpen,
} from "lucide-react"

export function AboutPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const data = await activityService.getUpcomingActivities()
        setActivities(data.slice(0, 3))
      } catch (error) {
        console.error("Failed to load activities:", error)
      } finally {
        setIsLoading(false)
      }
    }

    const loadPlans = async () => {
      try {
        const allPlans = await projectService.getPlans()
        // Filter only public plans and sort by publicOrder
        const publicPlans = allPlans
          .filter(p => p.isPublic && p.status === 'active')
          .sort((a, b) => (a.publicOrder || 0) - (b.publicOrder || 0))
        setPlans(publicPlans)
      } catch (error) {
        console.error("Failed to load plans:", error)
      } finally {
        setIsLoadingPlans(false)
      }
    }

    loadActivities()
    loadPlans()
  }, [])
  return (
    <div className="space-y-16 md:space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative min-h-[600px] md:min-h-[700px] -mt-4 rounded-b-3xl overflow-hidden">
        {/* 背景圖片 */}
        <div className="absolute inset-0">
          <img
            src="/images/hero-bg.jpg"
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              img.style.display = "none"
              const container = img.parentElement
              if (container && !container.querySelector(".loading-spinner")) {
                const spinner = document.createElement("div")
                spinner.className = "loading-spinner absolute inset-0 flex items-center justify-center"
                spinner.innerHTML = `<svg class="w-12 h-12 text-white/50 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
                container.appendChild(spinner)
              }
            }}
          />
        </div>

        {/* 內容 */}
        <div className="relative container max-w-5xl h-full flex flex-col justify-center py-20 md:py-28">
          <p className="text-[#c9a962] tracking-[0.3em] text-sm uppercase mb-4">
            Hon.Precision Public Charity Foundation
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            鴻勁公益
            <br />
            慈善基金會
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-lg mb-8 leading-relaxed">
            取之社會，用之社會。讓「善」成為一種能夠持續循環的力量。
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link to="/activities">
                瀏覽活動
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent text-white border-white hover:bg-white hover:text-primary"
            >
              <Link to="/apply">參加志工</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 關於我們 + 核心價值 */}
      <section className="container max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* 左側：關於我們 */}
          <div>
            <p className="text-[#c9a962] tracking-[0.2em] text-xs uppercase mb-2">
              About Us
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-6">
              以實際行動落實社會關懷的
              <br />
              慈善基金會
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              「財團法人鴻勁公益慈善基金會」由鴻勁精密股份有限公司捐助成立。我們相信企業的成長，應該與社會的溫度一起前進—將經營成果轉化為具體的公益力量，投入弱勢照護、教育助學、急難救助與在地關懷。
            </p>

            {/* 統計數字 */}
            <div className="flex gap-8 md:gap-12 pt-6 border-t">
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">500+</p>
                <p className="text-muted-foreground text-sm">服務家庭</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">10+</p>
                <p className="text-muted-foreground text-sm">合作機構</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">50+</p>
                <p className="text-muted-foreground text-sm">志工夥伴</p>
              </div>
            </div>
          </div>

          {/* 右側：核心價值卡片 */}
          <div className="space-y-4">
            {[
              {
                icon: HandHeart,
                title: "持續陪伴",
                desc: "透過定期訪視與追蹤機制，提供長期且穩定的關懷，而非單次給予後即結束連結。",
              },
              {
                icon: Sprout,
                title: "勁心種苗",
                desc: "鼓勵受助者成長後以志工服務回饋社會，讓愛從「被幫助」轉化為「去幫助」。",
              },
              {
                icon: Scale,
                title: "尊嚴為本",
                desc: "重視受助者的自尊與隱私，以陪伴代替施捨，不讓受助家庭承受額外壓力。",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex gap-4 p-5 bg-card border rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 核心公益計畫 */}
      <section className="container max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[#c9a962] tracking-[0.2em] text-xs uppercase mb-2">
              Core Programs
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-primary">
              核心公益計畫
            </h2>
          </div>
          <p className="text-muted-foreground text-sm max-w-md">
            透過多元化的公益計畫，為不同需求的對象提供適切的協助與支持。
          </p>
        </div>

        {isLoadingPlans ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : plans.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                to={`/plans/${plan.id}`}
                className="group relative bg-card border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* 圖片區域 */}
                <div className="aspect-[4/3] bg-secondary overflow-hidden">
                  {plan.coverImage ? (
                    <img
                      src={plan.coverImage.originalUrl}
                      alt={plan.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.style.display = "none"
                        const container = img.parentElement
                        if (container && !container.querySelector(".loading-spinner")) {
                          const spinner = document.createElement("div")
                          spinner.className = "loading-spinner w-full h-full flex items-center justify-center"
                          spinner.innerHTML = `<svg class="w-8 h-8 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
                          container.appendChild(spinner)
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                {/* 內容 */}
                <div className="p-4">
                  <h3 className="font-bold text-foreground mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {plan.cardDescription || "點擊查看詳細介紹"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            目前尚無公開的計畫
          </div>
        )}
      </section>

      {/* 服務面向 */}
      <section className="container max-w-6xl">
        <div className="grid md:grid-cols-3 gap-5">
          {/* 左側深色卡片 */}
          <div className="bg-primary text-white rounded-2xl p-8 flex flex-col">
            <p className="text-[#c9a962] tracking-[0.2em] text-xs uppercase mb-2">
              Features & Care
            </p>
            <h2 className="text-2xl font-bold mb-4">
              特色與
              <br />
              關懷面向
            </h2>
            <p className="text-white/70 text-sm mb-8 flex-1">
              針對真正需要的人，提供最直接的協助
            </p>
            <Button
              asChild
              variant="secondary"
              className="w-fit"
            >
              <Link to="/apply">了解更多</Link>
            </Button>
          </div>

          {/* 右側圖片卡片 */}
          <div className="relative rounded-2xl overflow-hidden group">
            <img
              src="/images/feature-1.jpg"
              alt="急難救助"
              className="w-full h-full object-cover min-h-[250px] group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                img.style.display = "none"
                const container = img.parentElement
                if (container && !container.querySelector(".loading-spinner")) {
                  const spinner = document.createElement("div")
                  spinner.className = "loading-spinner absolute inset-0 flex items-center justify-center bg-muted/50"
                  spinner.innerHTML = `<svg class="w-8 h-8 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
                  container.appendChild(spinner)
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 p-6 text-white">
              <h3 className="text-xl font-bold mb-1">急難救助與弱勢照護</h3>
              <p className="text-white/80 text-sm">
                因意外、變故陷入困境的家庭，提供即時援助
              </p>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden group">
            <img
              src="/images/feature-2.jpg"
              alt="教育助學"
              className="w-full h-full object-cover min-h-[250px] group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                img.style.display = "none"
                const container = img.parentElement
                if (container && !container.querySelector(".loading-spinner")) {
                  const spinner = document.createElement("div")
                  spinner.className = "loading-spinner absolute inset-0 flex items-center justify-center bg-muted/50"
                  spinner.innerHTML = `<svg class="w-8 h-8 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
                  container.appendChild(spinner)
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 p-6 text-white">
              <h3 className="text-xl font-bold mb-1">教育助學與偏鄉關懷</h3>
              <p className="text-white/80 text-sm">
                讓求學路不因經濟因素中斷，深入資源不足地區
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 最新活動預告 */}
      <section className="container max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[#c9a962] tracking-[0.2em] text-xs uppercase mb-2">
              Upcoming Events
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-primary">
              最新活動
            </h2>
          </div>
          <Button asChild variant="outline" className="w-fit gap-2">
            <Link to="/activities">
              查看全部活動
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card border rounded-2xl overflow-hidden"
              >
                <div className="aspect-[16/9] bg-secondary flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                  <div className="h-5 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-5">
            {activities.map((activity) => (
              <Link
                key={activity.id}
                to={`/activities/${activity.id}`}
                className="bg-card border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-[16/9] bg-secondary">
                  {activity.coverImage?.originalUrl ? (
                    <img
                      src={activity.coverImage.originalUrl}
                      alt={activity.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                      <Calendar className="w-12 h-12 text-primary/20" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(activity.date), "yyyy/MM/dd", { locale: zhTW })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {activity.location}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{activity.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {activity.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            目前沒有即將舉辦的活動
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="container max-w-4xl">
        <div className="bg-primary rounded-3xl p-8 md:p-12 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            加入我們，一起讓善的力量持續擴散
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            無論是成為志工、參與活動，或是以其他方式支持我們，每一份力量都是推動改變的關鍵。
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link to="/apply">立即加入志工</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent text-white border-white hover:bg-white hover:text-primary"
            >
              <Link to="/activities">瀏覽活動</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
