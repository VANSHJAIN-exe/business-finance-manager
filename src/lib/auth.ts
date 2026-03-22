import { supabase } from "@/integrations/supabase/client";

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const resolveLoginEmail = async (loginName: string) => {
  const cleanLoginName = loginName.trim();

  if (!cleanLoginName) {
    throw new Error("Name is required");
  }

  const { data, error } = await supabase.rpc("get_auth_email_by_login_name", {
    _login_name: cleanLoginName,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Account not found. Please contact the admin.");
  }

  return data;
};
