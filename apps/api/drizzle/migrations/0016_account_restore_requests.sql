-- 0016_account_restore_requests.sql
-- Queue deleted-account restore requests for admin review.

CREATE TABLE IF NOT EXISTS account_restore_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email varchar(255) NOT NULL,
  role varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  reason text,
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decision_note text,
  CONSTRAINT account_restore_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT account_restore_requests_role_check CHECK (role IN ('patient', 'provider', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_account_restore_requests_status_requested
  ON account_restore_requests(status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_restore_requests_email
  ON account_restore_requests(lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_restore_requests_pending_user
  ON account_restore_requests(user_id)
  WHERE status = 'pending' AND user_id IS NOT NULL;