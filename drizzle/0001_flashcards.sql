CREATE TABLE IF NOT EXISTS flashcard_sets (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id text REFERENCES documents(id) ON DELETE SET NULL,
  title text NOT NULL,
  subject text NOT NULL DEFAULT '',
  description text,
  creation_method text NOT NULL DEFAULT 'manual' CHECK (creation_method IN ('manual', 'ai')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flashcard_sets_user_id_idx ON flashcard_sets(user_id);
CREATE TABLE IF NOT EXISTS flashcards (
  id text PRIMARY KEY,
  set_id text NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
  front_text text NOT NULL,
  back_text text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flashcards_set_id_idx ON flashcards(set_id);
CREATE TABLE IF NOT EXISTS flashcard_progress (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flashcard_id text NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'known')),
  review_count integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flashcard_progress_owner_card_unique UNIQUE (user_id, flashcard_id)
);
