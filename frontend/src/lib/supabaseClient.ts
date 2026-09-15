import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

let client: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("your-project") &&
    !supabaseAnonKey.includes("your-anon-key")
  );
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client && supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return client;
};

export interface SupabaseAccount {
  vpa: string;
  holder_name: string;
  balance: number;
  version: number;
}

export interface SupabaseTransaction {
  id: number;
  packet_hash: string;
  sender_vpa: string;
  receiver_vpa: string;
  amount: number;
  signed_at: string;
  settled_at: string;
  bridge_node_id: string;
  hop_count: number;
  status: string;
}

/**
 * Directly fetch latest transactions from Supabase PostgreSQL (if configured)
 */
export async function fetchSupabaseTransactions(): Promise<SupabaseTransaction[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("transactions")
      .select("*")
      .order("settled_at", { ascending: false })
      .limit(20);
    if (error) {
      console.warn("Supabase transaction query error:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("Supabase fetch exception:", err);
    return null;
  }
}

/**
 * Directly fetch accounts from Supabase PostgreSQL (if configured)
 */
export async function fetchSupabaseAccounts(): Promise<SupabaseAccount[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from("accounts").select("*");
    if (error) {
      console.warn("Supabase accounts query error:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("Supabase fetch exception:", err);
    return null;
  }
}
