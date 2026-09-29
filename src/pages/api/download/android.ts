import type { NextApiRequest, NextApiResponse } from "next";

const APK_URL =
  "https://github.com/martiola68/studio-manager-pro/releases/download/android-latest/Studio-Manager-Pro-Android.apk";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", 'attachment; filename="Studio-Manager-Pro-Android.apk"');
  return res.redirect(302, APK_URL);
}
