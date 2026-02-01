import { supabaseAdmin } from "../config/supabase/client.js";
import type { LotRow } from "../types/index.js";

export const createLot = async (totalFiles: number) => {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .insert({ total_files: totalFiles, status: "uploading" })
    .select()
    .single();

  if (error) throw new Error(`Failed to create lot: ${error.message}`);
  return data as LotRow;
};

export const updateLotStatus = async (
  lotId: string,
  status: string,
  processedFiles: string[],
  failedFiles: string[]
) => {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .update({
      status,
      processed_files: processedFiles,
      failed_files: failedFiles,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lotId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update lot: ${error.message}`);
  return data as LotRow;
};

export const getLotById = async (lotId: string) => {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .select()
    .eq("id", lotId)
    .single();

  if (error) throw new Error(`Failed to fetch lot ${lotId}: ${error.message}`);
  return data as LotRow;
};

export const getAllLots = async () => {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .select()
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch lots: ${error.message}`);
  return data as LotRow[];
};

export const updateLotStatusOnly = async (lotId: string, status: string) => {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lotId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update lot status: ${error.message}`);
  return data as LotRow;
};
