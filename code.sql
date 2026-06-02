-- FIX: Add missing foreign key relationship for Joins
ALTER TABLE simulation_progress
ADD CONSTRAINT fk_sim_progress_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- Full table schema (if you haven't created it yet)
/*
CREATE TABLE IF NOT EXISTS simulation_questions (
    id SERIAL PRIMARY KEY,
    subject_id TEXT NOT NULL,
    class_id INT NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    answer INT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_progress (
    user_id INT NOT NULL,
    subject_id TEXT NOT NULL,
    last_index INT DEFAULT 0,
    total_questions INT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, subject_id),
    CONSTRAINT fk_sim_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
*/
