import type { NextApiRequest, NextApiResponse } from "next";

const APK_URL =
  "https://github.com/martiola68/studio-manager-pro/releases/download/android-latest/Studio-Manager-Pro-Android.apk";

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const upstream = await fetch(APK_URL, {
      redirect: "follow",
      headers: {
        "User-Agent": "Studio-Manager-Pro",
        Accept: "application/vnd.android.package-archive,application/octet-stream",
      },
    });

    if (!upstream.ok) {
      throw new Error(`Download APK non disponibile (HTTP ${upstream.status})`);
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", 'attachment; filename="Studio-Manager-Pro-Android.apk"');
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.end(bytes);
  } catch (error) {
    console.error("Errore download APK:", error);
    return res.status(502).json({ error: "APK temporaneamente non disponibile." });
  }
}
