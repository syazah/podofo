import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv"
dotenv.config()

export const supabaseAdmin = createClient(
  process.env.SUPABASE_PROJECT_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)
