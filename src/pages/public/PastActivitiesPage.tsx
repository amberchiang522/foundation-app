import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ActivityCard } from "@/components/activity"
import { activityService } from "@/services"
import type { Activity } from "@/types"
import { Search, ArrowLeft } from "lucide-react"

const ITEMS_PER_PAGE = 6

export function PastActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const data = await activityService.getPastActivities()
        setActivities(data)
        setFilteredActivities(data)
      } catch (error) {
        console.error("Failed to load activities:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadActivities()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const result = activities.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.location.toLowerCase().includes(query)
      )
      setFilteredActivities(result)
      setDisplayCount(ITEMS_PER_PAGE)
    } else {
      setFilteredActivities(activities)
    }
  }, [activities, searchQuery])

  const displayedActivities = filteredActivities.slice(0, displayCount)
  const hasMore = displayCount < filteredActivities.length

  const loadMore = () => {
    setDisplayCount((prev) => prev + ITEMS_PER_PAGE)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/activities">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">已結束的活動</h1>
          <p className="text-muted-foreground">查看過去舉辦的志工活動</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜尋活動..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Activity List */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl border bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      ) : filteredActivities.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayedActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={loadMore}>
                載入更多（{filteredActivities.length - displayCount} 筆）
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? "沒有符合條件的活動" : "沒有已結束的活動紀錄"}
        </div>
      )}
    </div>
  )
}
