-- 010: gym_members の冗長インデックスを削除（書き込み高速化・ストレージ削減）
-- Why: user_id / qr_token / stripe_customer_id は UNIQUE 制約により既に一意インデックスが
--      張られている。001_initial で追加した通常インデックス(idx_members_*)は完全に重複しており、
--      INSERT/UPDATE ごとに二重の索引維持コストが発生するだけで参照性能には寄与しない。
--      重複分を削除する（参照は UNIQUE インデックスが引き続き担うため性能低下はない）。
DROP INDEX IF EXISTS idx_members_user_id;
DROP INDEX IF EXISTS idx_members_qr_token;
DROP INDEX IF EXISTS idx_members_stripe_customer;
