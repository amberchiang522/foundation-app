import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ActivityCard } from "@/components/activity"
import { activityService } from "@/services"
import type { Activity } from "@/types"
import { Search } from "lucide-react"

const ITEMS_PER_PAGE = 6

export function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  // Get unique activity types
  const activityTypes = [...new Set(activities.map((a) => a.type))]

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const data = await activityService.getUpcomingActivities()
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
    let result = activities

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.location.toLowerCase().includes(query)
      )
    }

    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter((a) => a.type === typeFilter)
    }

    setFilteredActivities(result)
    setDisplayCount(ITEMS_PER_PAGE) // Reset pagination when filters change
  }, [activities, searchQuery, typeFilter])

  const displayedActivities = filteredActivities.slice(0, displayCount)
  const hasMore = displayCount < filteredActivities.length

  const loadMore = () => {
    setDisplayCount((prev) => prev + ITEMS_PER_PAGE)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">活動列表</h1>
        <p className="text-muted-foreground">瀏覽即將舉辦的志工活動</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋活動名稱、地點..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="活動類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            {activityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Activity List */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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

          {/* Load More */}
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
          {searchQuery || typeFilter !== "all"
            ? "沒有符合條件的活動"
            : "目前沒有即將舉辦的活動"}
        </div>
      )}

      {/* Link to past activities */}
      <div className="text-center pt-4 border-t">
        <Button asChild variant="link">
          <Link to="/activities/past">查看已結束的活動</Link>
        </Button>
      </div>
    </div>
  )
}
