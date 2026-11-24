CREATE TABLE IF NOT EXISTS groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name     text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  UNIQUE (group_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description  text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 80),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  paid_by      uuid NOT NULL REFERENCES members(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per member who shares the expense. The shares of an expense
-- always add up to its amount_cents, and the service layer is what keeps that true.
CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id  uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id),
  share_cents integer NOT NULL CHECK (share_cents >= 0),
  PRIMARY KEY (expense_id, member_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_member  uuid NOT NULL REFERENCES members(id),
  to_member    uuid NOT NULL REFERENCES members(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (from_member <> to_member)
);

CREATE INDEX IF NOT EXISTS expenses_group_idx ON expenses (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS settlements_group_idx ON settlements (group_id, created_at DESC);
