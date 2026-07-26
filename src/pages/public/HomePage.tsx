import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ActivityCard } from "@/components/activity"
import { activityService } from "@/services"
import type { Activity } from "@/types"
import { ArrowRight, Users } from "lucide-react"

export function HomePage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const data = await activityService.getUpcomingActivities()
        setActivities(data.slice(0, 6)) // 首頁只顯示前 6 筆
      } catch (error) {
        console.error("Failed to load activities:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadActivities()
  }, [])

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12 md:py-20 space-y-6">
        <img
          src="/logo.png"
          alt="鴻勁公益慈善基金會"
          className="h-32 md:h-44 lg:h-52 w-auto mx-auto object-contain"
          onError={(e) => {
            // Hide image if not found
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          加入我們的志工團隊，一起為社會貢獻力量。
          <br className="hidden sm:inline" />
          無論是急難救助、社區服務或教育支持，都需要你的參與。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="gap-2">
            <Link to="/apply">
              <Users className="h-5 w-5" />
              參加志工
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/activities">瀏覽活動</Link>
          </Button>
        </div>
      </section>

      {/* Activities Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">最新活動</h2>
            <p className="text-muted-foreground">即將舉辦的志工活動</p>
          </div>
          <Button asChild variant="ghost" className="gap-1">
            <Link to="/activities">
              查看全部
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-xl border bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            目前沒有即將舉辦的活動
          </div>
        )}

        {/* Past Activities Link */}
        <div className="text-center pt-4">
          <Button asChild variant="link">
            <Link to="/activities/past">查看已結束的活動</Link>
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted/50 rounded-2xl p-8 md:p-12 text-center space-y-4">
        <h2 className="text-2xl font-semibold">成為我們的一份子</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          填寫申請表單，審核通過後即可開始參與志工活動。
          <br />
          你的每一份付出，都能為需要幫助的人帶來溫暖。
        </p>
        <Button asChild size="lg">
          <Link to="/apply">立即申請</Link>
        </Button>
      </section>
    </div>
  )
}
