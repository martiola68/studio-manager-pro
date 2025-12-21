import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey ? createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { adminEmail } = req.body;

    if (!adminEmail) {
      return res.status(400).json({ error: "adminEmail required" });
    }

    // 1. Get all users from Auth
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return res.status(500).json({ error: "Failed to list users", details: listError.message });
    }

    console.log(`Found ${authUsers.users.length} users in Auth`);

    // 2. Delete all users EXCEPT admin
    const deleted = [];
    const errors = [];

    for (const user of authUsers.users) {
      if (user.email && user.email.toLowerCase() !== adminEmail.toLowerCase()) {
        console.log(`Deleting user: ${user.email} (${user.id})`);
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.error(`Failed to delete ${user.email}:`, deleteError);
          errors.push({ email: user.email, error: deleteError.message });
        } else {
          deleted.push(user.email);
        }
      }
    }

    // 3. Clean database (SQL già eseguito separatamente)
    console.log(`Deleted ${deleted.length} users from Auth`);
    console.log(`Errors: ${errors.length}`);

    return res.status(200).json({
      success: true,
      deleted: deleted.length,
      errors: errors.length,
      deletedEmails: deleted,
      errorDetails: errors
    });

  } catch (error: any) {
    console.error("Cleanup error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
}