import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/li
...
).json({
      error: error.message || "Errore server",
      code: "SERVER_ERROR"
    });
  }
}