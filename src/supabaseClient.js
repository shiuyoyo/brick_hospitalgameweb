import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://bxpooqjjozrtxbgbkymf.supabase.co';

const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cG9vcWpqb3pydHhiZ2JreW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQ2NDEsImV4cCI6MjA2ODkyMDY0MX0.yUlA7kSOx_02T9LUK3p3znl4BEiEAeqDUbJMuKvbFQ8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
