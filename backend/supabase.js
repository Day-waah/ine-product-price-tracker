require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

module.exports = supabase;