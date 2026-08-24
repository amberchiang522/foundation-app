import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { forumService } from "@/services"
import type { ForumPostWithDetails, ForumReplyWithDetails } from "@/types"
import { format, formatDistanceToNow, differenceInMonths, differenceInYears } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  ArrowLeft,
  Eye,
  MessageSquare,
  Loader2,
  Send,
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

export function ForumPostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [post, setPost] = useState<ForumPostWithDetails | null>(null)
  const [replies, setReplies] = useState<ForumReplyWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRepliesLoading, setIsRepliesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [replyContent, setReplyContent] = useState("")
  const [isReplying, setIsReplying] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadPost()
  }, [id])

  const loadPost = async () => {
    if (!id) {
      setError("找不到討論")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const data = await forumService.getPostById(id)
      if (!data) {
        setError("找不到此討論")
      } else if (data.status !== 'active') {
        setError("此討論不存在或已關閉")
      } else {
        setPost(data)
        loadReplies()
      }
    } catch (err) {
      console.error("Failed to load post:", err)
      setError("載入失敗，請稍後再試")
    } finally {
      setIsLoading(false)
    }
  }

  const loadReplies = async () => {
    if (!id) return
    setIsRepliesLoading(true)
    try {
      const data = await forumService.getReplies(id)
      setReplies(data)
    } catch (err) {
      console.error("Failed to load replies:", err)
    } finally {
      setIsRepliesLoading(false)
    }
  }

  const handleReply = async () => {
    if (!post || !replyContent.trim()) return
    if (!isAuthenticated) {
      alert("請先登入才能留言")
      navigate("/login")
      return
    }

    setIsReplying(true)
    try {
      await forumService.createReply({
        postId: post.id,
        content: replyContent.trim(),
        images: [],
        createdBy: user?.id || '',
      })

      setReplyContent("")
      loadReplies()
      // Update post to refresh reply count
      const updatedPost = await forumService.getPostById(post.id)
      if (updatedPost) setPost(updatedPost)
    } catch (err) {
      console.error("Failed to create reply:", err)
      alert("留言失敗，請稍後再試")
    } finally {
      setIsReplying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">{error || "找不到討論"}</h2>
          <Button variant="outline" onClick={() => navigate("/forum")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回討論區
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate("/forum")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回討論區
      </Button>

      {/* Post Content */}
      <div className="bg-card border rounded-xl p-6 space-y-6">
        {/* Title */}
        <div className="flex items-start gap-3">
          {post.isPinned && (
            <Pin className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
          )}
          <h1 className="text-2xl font-bold">{post.title}</h1>
        </div>

        {/* Author Info */}
        <div className="flex items-center gap-4 pb-4 border-b">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {post.author?.avatar ? (
              <img
                src={post.author.avatar.thumbnailUrl || post.author.avatar.originalUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-primary">
                {post.author?.name?.charAt(0) || "?"}
              </span>
            )}
          </div>
          <div>
            <div className="font-medium">{post.author?.name || "匿名"}</div>
            <div className="text-sm text-muted-foreground">
              {getVolunteerDuration(post.author?.createdAt)}
            </div>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {format(new Date(post.createdAt), "yyyy年M月d日 HH:mm", { locale: zhTW })}
          </div>
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap text-base leading-relaxed">
          {post.content}
        </div>

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {post.images.map((img) => (
              <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={img.originalUrl}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(img.originalUrl, '_blank')}
                />
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-6 pt-4 border-t text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {post.viewCount} 瀏覽
          </span>
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {post.replyCount} 則留言
          </span>
        </div>
      </div>

      {/* Replies Section */}
      <div className="bg-card border rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-semibold">留言 ({replies.length})</h2>

        {/* Reply Input */}
        {isAuthenticated ? (
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar.thumbnailUrl || user.avatar.originalUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-primary">
                  {user?.name?.charAt(0) || "?"}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="發表你的看法..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleReply}
                  disabled={isReplying || !replyContent.trim()}
                >
                  {isReplying ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  送出留言
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 bg-muted/50 rounded-lg">
            <Button variant="outline" onClick={() => navigate("/login")}>
              登入後即可留言
            </Button>
          </div>
        )}

        {/* Replies List */}
        {isRepliesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            還沒有留言，成為第一個留言的人吧！
          </div>
        ) : (
          <div className="space-y-4">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {reply.author?.avatar ? (
                    <img
                      src={reply.author.avatar.thumbnailUrl || reply.author.avatar.originalUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-primary">
                      {reply.author?.name?.charAt(0) || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{reply.author?.name || "匿名"}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.createdAt), {
                        addSuffix: true,
                        locale: zhTW
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{reply.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
