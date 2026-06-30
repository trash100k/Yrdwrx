// @ts-nocheck
// Documents repo — file bytes live in Supabase Storage (private `documents` bucket,
// tenant-scoped by storage RLS on the path prefix `tenants/<tenantId>/...`); metadata
// lives in the Supabase `documents` table (tenant-scoped by table RLS).
import { makeRepo, attachTenant } from "./base";
import { supabase, getCurrentUser } from "../supabase";
import { getCurrentProfile } from "./profile";

const BUCKET = "documents";
const base = makeRepo("documents", { orderBy: { column: "created_at" } });

export const documentsRepo = {
  ...base,

  async forCustomer(customerId: string) {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // Upload a File to Supabase Storage under the tenant's prefix, then record metadata.
  async upload(file: File, opts: { folder?: string; customerId?: string } = {}) {
    const profile = await getCurrentProfile();
    const tenantId = profile?.tenant_id;
    if (!tenantId) throw new Error("No tenant for upload");
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `tenants/${tenantId}/documents/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    // Private bucket → store a long-lived signed URL for convenient inline access;
    // re-sign on demand via signedUrl() when it expires.
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const row = await attachTenant({
      name: file.name,
      folder: opts.folder ?? "General",
      mime: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      url: signed?.signedUrl ?? null,
      customer_id: opts.customerId ?? null,
      uploaded_by: getCurrentUser()?.uid ?? null,
    });
    const { data, error } = await supabase.from("documents").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  // Re-sign a stored document for viewing/download (signed URLs expire).
  async signedUrl(storagePath: string, expiresInSeconds = 3600) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw error;
    return data?.signedUrl ?? null;
  },

  // Delete both the metadata row and the underlying file.
  async remove(id: string) {
    const { data: doc } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    if (doc?.storage_path) {
      try {
        await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      } catch {
        /* file may already be gone; proceed to drop the row */
      }
    }
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
  },
};
