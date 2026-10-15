import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL || 'https://xvxwqqiwthofiswtxqet.supabase.co';
const key = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2eHdxcWl3dGhvZmlzd3R4cWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNjYyMjUsImV4cCI6MjEwMTY0MjIyNX0.Hb4iKvOXjJCdGBAqVXsTJjELu9wR1TnsQMxHi-nQUSU';
export const supabase = createClient(url, key);
