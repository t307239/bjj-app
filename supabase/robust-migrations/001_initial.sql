-- ============================================================
-- ROBUST ジム会員管理システム — Initial Migration
-- Supabase project: gym-member-hub
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて実行
-- ============================================================

-- updated_at 自動更新トリガー関数（全テーブル共通）
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- gyms テーブル（テナント管理）
-- ============================================================
CREATE TABLE gyms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan_cap    INT  NOT NULL DEFAULT 8,
  overage_yen INT  NOT NULL DEFAULT 1000,
  features    TEXT[] NOT NULL DEFAULT ARRAY['attendance','payments','videos'],
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER gyms_updated_at
  BEFORE UPDATE ON gyms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- gym_staff テーブル（権限管理中間テーブル）
-- ============================================================
CREATE TABLE gym_staff (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  -- ON DELETE RESTRICT: 退職スタッフのAuth削除時でも履歴を保持
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role       TEXT NOT NULL DEFAULT 'instructor'
               CHECK (role IN ('owner','admin','instructor')),
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (gym_id, user_id)
);
CREATE TRIGGER gym_staff_updated_at
  BEFORE UPDATE ON gym_staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- gym_members テーブル（会員）
-- ============================================================
CREATE TABLE gym_members (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                    UUID NOT NULL REFERENCES gyms(id),
  -- Supabase Auth との紐付け（マイページ用）
  user_id                   UUID REFERENCES auth.users(id) UNIQUE,
  email                     TEXT NOT NULL,
  name                      TEXT NOT NULL,
  phone                     TEXT,
  gender                    TEXT CHECK (gender IN ('male','female','other')),
  birth_year                INT,
  stripe_customer_id        TEXT UNIQUE,
  stripe_subscription_id    TEXT,
  default_payment_method_id TEXT,
  payment_method            TEXT NOT NULL DEFAULT 'stripe'
                              CHECK (payment_method IN ('stripe','bank_transfer')),
  qr_token                  TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  plan_type                 TEXT NOT NULL CHECK (plan_type IN (
                              'fulltime','twice_weekly','drop_in'
                            )),
  plan_cap                  INT,
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','paused','cancelled')),
  insurance_expires_at      DATE,
  is_minor                  BOOLEAN DEFAULT false,
  guardian_consent          BOOLEAN DEFAULT false,
  guardian_name             TEXT,
  guardian_contact          TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  UNIQUE (gym_id, email)
);
CREATE TRIGGER gym_members_updated_at
  BEFORE UPDATE ON gym_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- attendance_logs テーブル（出欠）
-- ============================================================
CREATE TABLE attendance_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      UUID NOT NULL REFERENCES gym_members(id),
  gym_id         UUID NOT NULL REFERENCES gyms(id),
  class_type     TEXT CHECK (class_type IN (
                   'beginner','basic','regular','nogi','private','other'
                 )),
  checked_in_at  TIMESTAMPTZ DEFAULT now(),
  billing_period TEXT NOT NULL,
  charged        BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- gym_videos テーブル（Google Drive 動画）
-- ============================================================
CREATE TABLE gym_videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID NOT NULL REFERENCES gyms(id),
  title         TEXT NOT NULL,
  description   TEXT,
  drive_file_id TEXT NOT NULL,
  thumbnail_url TEXT,
  class_type    TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER gym_videos_updated_at
  BEFORE UPDATE ON gym_videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS 有効化
-- ============================================================
ALTER TABLE gyms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_staff       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_videos      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS ヘルパー関数
-- ============================================================
CREATE OR REPLACE FUNCTION is_gym_staff_or_owner(target_gym_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM gym_staff
    WHERE gym_id = target_gym_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM gyms
    WHERE id = target_gym_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- RLS ポリシー — オーナー・スタッフ（管理画面）
-- ============================================================
CREATE POLICY gyms_access       ON gyms            USING (is_gym_staff_or_owner(id));
CREATE POLICY members_access    ON gym_members     USING (is_gym_staff_or_owner(gym_id));
CREATE POLICY attendance_access ON attendance_logs USING (is_gym_staff_or_owner(gym_id));
CREATE POLICY videos_access     ON gym_videos      USING (is_gym_staff_or_owner(gym_id));
CREATE POLICY staff_owner_only  ON gym_staff
  USING (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));

-- ============================================================
-- RLS ポリシー — 会員本人（マイページ）
-- ============================================================
CREATE POLICY members_self_read ON gym_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY attendance_self_read ON attendance_logs
  FOR SELECT USING (
    member_id IN (SELECT id FROM gym_members WHERE user_id = auth.uid())
  );

CREATE POLICY videos_member_read ON gym_videos
  FOR SELECT USING (
    gym_id IN (
      SELECT gym_id FROM gym_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND is_active = true
  );

-- ============================================================
-- インデックス（パフォーマンス）
-- ============================================================
CREATE INDEX idx_attendance_member_period ON attendance_logs (member_id, billing_period);
CREATE INDEX idx_members_qr_token         ON gym_members (qr_token);
CREATE INDEX idx_members_user_id          ON gym_members (user_id);
CREATE INDEX idx_members_stripe_customer  ON gym_members (stripe_customer_id);

-- ============================================================
-- 初期データ: ROBUST 柔術（slug = 'robust'）
-- ※ owner_id は Supabase Auth でオーナーアカウントを作成後に更新
-- ============================================================
-- INSERT INTO gyms (name, slug, owner_id, plan_cap, overage_yen)
-- VALUES ('ROBUST 柔術', 'robust', '<YOUR_AUTH_USER_ID>', 8, 1000);

-- webhook 冪等性テーブル（z270: event.id で二重処理を防ぐ）
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id   TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- gym_members の追加カラム（z265-z270 で追加）
ALTER TABLE gym_members ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE gym_members ADD COLUMN IF NOT EXISTS sports_history  TEXT;
ALTER TABLE gym_members ADD COLUMN IF NOT EXISTS video_access    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gym_members ADD COLUMN IF NOT EXISTS family_discount     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gym_members ADD COLUMN IF NOT EXISTS family_member_name  TEXT;
