// @ts-nocheck
// Documents repo — file bytes live in Firebase Storage (Google-native), metadata in
// the Supabase `documents` table (tenant-scoped by RLS).
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { makeRepo, attachTenant } from "./base";
import { supabase } from "../supabase";
import { storage, auth } from "../firebase";
import { getCurrentProfile } from "./profile";

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

  // Upload a File to Firebase Storage under the tenant's prefix, then record metadata.
  async upload(file: File, opts: { folder?: string; customerId?: string } = {}) {
    const profile = await getCurrentProfile();
    const tenantId = profile?.tenant_id;
    if (!tenantId) throw new Error("No tenant for upload");
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `tenants/${tenantId}/documents/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);

    const row = await attachTenant({
      name: file.name,
      folder: opts.folder ?? "General",
      mime: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      url,
      customer_id: opts.customerId ?? null,
      uploaded_by: auth.currentUser?.uid ?? null,
    });
    const { data, error } = await supabase.from("documents").insert(row).select().single();
    if (error) throw error;
    return data;
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
        await deleteObject(ref(storage, doc.storage_path));
      } catch {
        /* file may already be gone; proceed to drop the row */
      }
    }
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
  },
};
