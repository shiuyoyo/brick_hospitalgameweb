-- 醫師評估備註資料表 (Doctor Evaluation Notes)
-- Run this SQL in your Supabase dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS rehab_notes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  doctor_name TEXT,
  note_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by patient
CREATE INDEX IF NOT EXISTS idx_rehab_notes_patient_id ON rehab_notes(patient_id);

-- Row Level Security (RLS) — enable if needed
-- ALTER TABLE rehab_notes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated reads (adjust as needed)
-- CREATE POLICY "Doctors can manage notes" ON rehab_notes
--   USING (true) WITH CHECK (true);
