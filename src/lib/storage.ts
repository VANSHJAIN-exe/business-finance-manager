import { supabase } from "@/integrations/supabase/client";

export const uploadPublicFile = async (bucket: "avatars" | "work-images" | "voice-notes", path: string, file: File) => {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) {
    throw error;
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};
