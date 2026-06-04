-- Create nilai_config table for granular score settings
CREATE TABLE IF NOT EXISTS nilai_config (
    test_id TEXT NOT NULL,          -- psts, psasi, psat, etc
    class_id BIGINT NOT NULL,       -- link ke classes.id
    hidden_subjects JSONB DEFAULT '[]', -- array key mapel yang mau di-hide
    PRIMARY KEY (test_id, class_id),
    CONSTRAINT fk_nilai_config_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Add is_private column to score tables
ALTER TABLE nilai_psts ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE nilai_psasi ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE nilai_psat ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- FIX: Add missing foreign key relationship for Joins
/*
ALTER TABLE simulation_progress
ADD CONSTRAINT fk_sim_progress_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- 5. Enable Realtime for Monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE simulation_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_progress;
*/
