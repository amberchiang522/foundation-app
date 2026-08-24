import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { forumService } from "@/services"
import { MultiImageUploader } from "@/components/upload/MultiImageUploader"
import type { ForumPostWithDetails, ImageData } from "@/types"
import type { ImageUploadResult } from "@/services/imageService"
import { differenceInMonths, differenceInYears } from "date-fns"
import {
  Loader2,
  Plus,
  MessageSquare,
  Pin,
} from "lucide-react"

// 計算志工年資
const getVolunteerDuration = (createdAt?: string) => {
  if (!createdAt) return "志工"
  const joinDate = new Date(createdAt)
  const now = new Date()
  const years = differenceInYears(now, joinDate)
  const months = differenceInMonths(now, joinDate) % 12

  if (years > 0) {
    return months > 0 ? `${years} 年 ${months} 個月` : `${years} 年`
  }
  if (months > 0) {
    return `${months} 個月`
  }
  return "新加入"
}

export function ForumPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // Forum state
  const [posts, setPosts] = useState<ForumPostWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Create post dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newPostTitle, setNewPostTitle] = useState("")
  const [newPostContent, setNewPostContent] = useState("")
  const [newPostImages, setNewPostImages] = useState<ImageUploadResult[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadForumPosts()
  }, [])

  const loadForumPosts = async () => {
    setIsLoading(true)
    try {
      const data = await forumService.getPosts()
      setPosts(data)
    } catch (error) {
      console.error("Failed to load forum posts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const openCreateDialog = () => {
    if (!isAuthenticated) {
      alert("請先登入才能發表討論")
      navigate("/login")
      return
    }
    setNewPostTitle("")
    setNewPostContent("")
    setNewPostImages([])
    setIsCreateOpen(true)
  }

  const handleCreatePost = async () => {
    if (!newPostTitle.trim()) {
      alert("請輸入標題")
      return
    }
    if (!newPostContent.trim()) {
      alert("請輸入內容")
      return
    }

    setIsSubmitting(true)
    try {
      const images: ImageData[] = newPostImages.map((img, index) => ({
        id: img.id,
        originalUrl: img.originalUrl,
        thumbnailUrl: img.thumbnailUrl,
        fileName: img.fileName,
        fileSize: img.fileSize,
        mimeType: img.mimeType,
        order: index,
      }))

      await forumService.createPost({
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        images,
        status: 'pending',
        isPinned: false,
        createdBy: user?.id || '',
      })

      alert("討論已送出！您的討論已送出審核，審核通過後即會顯示。")
      setIsCreateOpen(false)
      loadForumPosts()
    } catch (error) {
      console.error("Failed to create post:", error)
      alert("發表失敗，請稍後再試")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openPostDetail = (post: ForumPostWithDetails) => {
    navigate(`/forum/${post.id}`)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">討論區</h1>
        <p className="text-muted-foreground">
          與其他志工分享心得、交流經驗
        </p>
      </section>

      {/* Create Button */}
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1" />
          發表討論
        </Button>
      </div>

      {/* Forum List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">目前沒有討論</p>
          <p className="text-sm">成為第一個發起討論的志工吧！</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid md:grid-cols-[1fr_80px_80px_180px] bg-muted/50 px-6 py-3 text-sm font-medium text-muted-foreground border-b">
            <div>討論</div>
            <div className="text-center">瀏覽</div>
            <div className="text-center">留言</div>
            <div>發起人</div>
          </div>

          {/* Table Body */}
          <div className="divide-y">
            {posts.map(post => (
              <div
                key={post.id}
                onClick={() => openPostDetail(post)}
                className="grid md:grid-cols-[1fr_80px_80px_180px] gap-4 md:gap-0 p-4 md:px-6 md:py-5 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                {/* Title & Content */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {post.isPinned && (
                      <Pin className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    <h3 className="font-semibold text-primary hover:underline truncate">
                      {post.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {post.content}
                  </p>
                </div>

                {/* Views - Desktop */}
                <div className="hidden md:flex items-center justify-center text-sm text-muted-foreground">
                  {post.viewCount}
                </div>

                {/* Replies - Desktop */}
                <div className="hidden md:flex items-center justify-center text-sm font-medium">
                  {post.replyCount}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {post.author?.avatar ? (
                      <img
                        src={post.author.avatar.thumbnailUrl || post.author.avatar.originalUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-primary">
                        {post.author?.name?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {post.author?.name || "匿名"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getVolunteerDuration(post.author?.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Mobile Stats */}
                <div className="flex md:hidden items-center gap-4 text-xs text-muted-foreground">
                  <span>{post.viewCount} 瀏覽</span>
                  <span>{post.replyCount} 留言</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Post Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>發表討論</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">標題</label>
              <Input
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="輸入討論標題"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">內容</label>
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="輸入討論內容..."
                rows={5}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">圖片（最多 5 張）</label>
              <div className="mt-1">
                <MultiImageUploader
                  type="forum-image"
                  value={newPostImages}
                  onChange={setNewPostImages}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreatePost} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              送出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
