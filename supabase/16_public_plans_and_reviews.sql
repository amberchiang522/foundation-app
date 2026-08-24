-- =====================================================
-- 公開計畫、活動回顧與討論區
-- Migration: 16_public_plans_and_reviews.sql
-- =====================================================

-- =====================================================
-- 1. 擴展 Plans 表 - 新增公開設定與 PDF 欄位
-- =====================================================

ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS public_order INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS cover_image JSONB;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS public_description TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS intro_pdf JSONB;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS download_pdfs JSONB DEFAULT '[]';

-- Index for public plans query
CREATE INDEX IF NOT EXISTS idx_plans_public ON plans(is_public, public_order) WHERE is_public = true;

-- =====================================================
-- 2. 活動回顧表
-- =====================================================

CREATE TABLE IF NOT EXISTS event_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  event_date DATE,
  images JSONB DEFAULT '[]',
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  display_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_reviews_plan ON event_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_published ON event_reviews(is_published, published_at DESC) WHERE is_published = true;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS event_reviews_updated_at ON event_reviews;
CREATE TRIGGER event_reviews_updated_at
  BEFORE UPDATE ON event_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. 討論區表
-- =====================================================

-- 討論主題狀態
DO $$ BEGIN
  CREATE TYPE forum_post_status AS ENUM ('active', 'closed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 討論主題
CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]',
  status forum_post_status NOT NULL DEFAULT 'active',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  last_reply_by UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_status ON forum_posts(status, is_pinned DESC, last_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_plan ON forum_posts(plan_id) WHERE plan_id IS NOT NULL;

-- 討論回覆
CREATE TABLE IF NOT EXISTS forum_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES forum_replies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id, created_at);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS forum_posts_updated_at ON forum_posts;
CREATE TRIGGER forum_posts_updated_at
  BEFORE UPDATE ON forum_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS forum_replies_updated_at ON forum_replies;
CREATE TRIGGER forum_replies_updated_at
  BEFORE UPDATE ON forum_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update reply count and last_reply info
CREATE OR REPLACE FUNCTION update_forum_post_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET
      reply_count = reply_count + 1,
      last_reply_at = NEW.created_at,
      last_reply_by = NEW.created_by
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND NOT OLD.is_deleted THEN
    UPDATE forum_posts SET
      reply_count = GREATEST(0, reply_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS forum_replies_stats ON forum_replies;
CREATE TRIGGER forum_replies_stats
  AFTER INSERT OR DELETE ON forum_replies
  FOR EACH ROW EXECUTE FUNCTION update_forum_post_stats();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE forum_posts SET view_count = view_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. RLS Policies
-- =====================================================

-- Event Reviews RLS
ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view published reviews
DROP POLICY IF EXISTS "Published reviews are public" ON event_reviews;
CREATE POLICY "Published reviews are public" ON event_reviews
  FOR SELECT USING (is_published = true);

-- Admins can manage all reviews
DROP POLICY IF EXISTS "Admins manage reviews" ON event_reviews;
CREATE POLICY "Admins manage reviews" ON event_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Forum Posts RLS
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view active posts
DROP POLICY IF EXISTS "Active posts are public" ON forum_posts;
CREATE POLICY "Active posts are public" ON forum_posts
  FOR SELECT USING (status = 'active');

-- Authenticated users can create posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON forum_posts;
CREATE POLICY "Authenticated users can create posts" ON forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can edit own posts, admins can edit all
DROP POLICY IF EXISTS "Users edit own posts" ON forum_posts;
CREATE POLICY "Users edit own posts" ON forum_posts
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Admins can delete posts
DROP POLICY IF EXISTS "Admins delete posts" ON forum_posts;
CREATE POLICY "Admins delete posts" ON forum_posts
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Forum Replies RLS
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can view non-deleted replies
DROP POLICY IF EXISTS "Replies are public" ON forum_replies;
CREATE POLICY "Replies are public" ON forum_replies
  FOR SELECT USING (is_deleted = false);

-- Authenticated users can create replies
DROP POLICY IF EXISTS "Authenticated users can reply" ON forum_replies;
CREATE POLICY "Authenticated users can reply" ON forum_replies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can edit own replies, admins can edit all
DROP POLICY IF EXISTS "Users edit own replies" ON forum_replies;
CREATE POLICY "Users edit own replies" ON forum_replies
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
