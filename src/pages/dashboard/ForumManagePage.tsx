import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { forumService } from "@/services"
import type { ForumPostWithDetails } from "@/types"
import { format } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  Pin,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react"

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "warning" }> = {
  pending: { label: "待審核", variant: "warning" },
  active: { label: "已通過", variant: "default" },
  closed: { label: "已關閉", variant: "secondary" },
  archived: { label: "已封存", variant: "destructive" },
}

export function ForumManagePage() {
  const [posts, setPosts] = useState<ForumPostWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<ForumPostWithDetails | null>(null)
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    setIsLoading(true)
    try {
      const data = await forumService.getAllPosts()
      setPosts(data)
    } catch (error) {
      console.error("Failed to load posts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const openReview = (post: ForumPostWithDetails) => {
    setSelectedPost(post)
    setIsReviewOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedPost) return
    setIsProcessing(true)
    try {
      await forumService.approvePost(selectedPost.id)
      await loadPosts()
      setIsReviewOpen(false)
    } catch (error) {
      console.error("Failed to approve:", error)
      alert("審核失敗，請稍後再試")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPost) return
    if (!confirm("確定要拒絕此討論嗎？")) return

    setIsProcessing(true)
    try {
      await forumService.rejectPost(selectedPost.id)
      await loadPosts()
      setIsReviewOpen(false)
    } catch (error) {
      console.error("Failed to reject:", error)
      alert("操作失敗，請稍後再試")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePin = async (post: ForumPostWithDetails) => {
    try {
      if (post.isPinned) {
        await forumService.unpinPost(post.id)
      } else {
        await forumService.pinPost(post.id)
      }
      await loadPosts()
    } catch (error) {
      console.error("Failed to toggle pin:", error)
    }
  }

  const handleClose = async (post: ForumPostWithDetails) => {
    if (!confirm("確定要關閉此討論嗎？關閉後將無法留言。")) return

    try {
      await forumService.closePost(post.id)
      await loadPosts()
    } catch (error) {
      console.error("Failed to close:", error)
    }
  }

  const handleDelete = async (post: ForumPostWithDetails) => {
    if (!confirm("確定要刪除此討論嗎？此操作無法復原。")) return

    try {
      await forumService.deletePost(post.id)
      await loadPosts()
    } catch (error) {
      console.error("Failed to delete:", error)
    }
  }

  const pendingPosts = posts.filter(p => p.status === "pending")
  const activePosts = posts.filter(p => p.status === "active")
  const otherPosts = posts.filter(p => p.status !== "pending" && p.status !== "active")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const PostCard = ({ post }: { post: ForumPostWithDetails }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={statusLabels[post.status]?.variant || "outline"}>
                {statusLabels[post.status]?.label || post.status}
              </Badge>
              {post.isPinned && (
                <Badge variant="outline" className="gap-1">
                  <Pin className="h-3 w-3" />
                  置頂
                </Badge>
              )}
              {post.images && post.images.length > 0 && (
                <Badge variant="outline" className="gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {post.images.length}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold truncate">{post.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {post.content}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span>{post.author?.name || "匿名"}</span>
              <span>{format(new Date(post.createdAt), "yyyy/MM/dd HH:mm", { locale: zhTW })}</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {post.replyCount}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {post.status === "pending" ? (
              <Button size="sm" onClick={() => openReview(post)}>
                審核
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openReview(post)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {post.status === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePin(post)}
                    className={post.isPinned ? "text-primary" : ""}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(post)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">討論管理</h1>
        <p className="text-muted-foreground">審核及管理志工討論內容</p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{pendingPosts.length}</div>
            <div className="text-sm text-muted-foreground">待審核</div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-green-600">{activePosts.length}</div>
            <div className="text-sm text-muted-foreground">已發布</div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{posts.length}</div>
            <div className="text-sm text-muted-foreground">總討論數</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            待審核 {pendingPosts.length > 0 && `(${pendingPosts.length})`}
          </TabsTrigger>
          <TabsTrigger value="active">已發布</TabsTrigger>
          <TabsTrigger value="other">其他</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                沒有待審核的討論
              </CardContent>
            </Card>
          ) : (
            pendingPosts.map(post => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-4 space-y-3">
          {activePosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                沒有已發布的討論
              </CardContent>
            </Card>
          ) : (
            activePosts.map(post => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>

        <TabsContent value="other" className="mt-4 space-y-3">
          {otherPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                沒有其他討論
              </CardContent>
            </Card>
          ) : (
            otherPosts.map(post => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPost?.status === "pending" ? "審核討論" : "檢視討論"}
            </DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant={statusLabels[selectedPost.status]?.variant || "outline"}>
                  {statusLabels[selectedPost.status]?.label || selectedPost.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedPost.author?.name || "匿名"} 發表於{" "}
                  {format(new Date(selectedPost.createdAt), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                </span>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">標題</label>
                <h2 className="text-xl font-semibold mt-1">{selectedPost.title}</h2>
              </div>

              {/* Content */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">內容</label>
                <div className="mt-1 p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedPost.content}</p>
                </div>
              </div>

              {/* Images */}
              {selectedPost.images && selectedPost.images.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    圖片 ({selectedPost.images.length})
                  </label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {selectedPost.images.map((img) => (
                      <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img
                          src={img.thumbnailUrl || img.originalUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedPost?.status === "pending" ? (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  拒絕
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  審核通過
                </Button>
              </>
            ) : (
              <>
                {selectedPost?.status === "active" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedPost) handleClose(selectedPost)
                      setIsReviewOpen(false)
                    }}
                  >
                    關閉討論
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsReviewOpen(false)}>
                  關閉
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
