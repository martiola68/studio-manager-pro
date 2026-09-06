export function Microsoft365DashboardGrafica() {
  return (
    <style jsx global>{`
      .microsoft365-page {
        overflow: hidden !important;
        background: rgb(241 245 249) !important;
      }

      .microsoft365-page > div {
        height: 100% !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 14px 0 22px !important;
        scrollbar-gutter: stable !important;
      }

      .microsoft365-page > div > div:first-child {
        margin-bottom: 16px !important;
      }

      .microsoft365-page h1 {
        margin: 0 !important;
        font-size: 1.7rem !important;
        line-height: 2rem !important;
        font-weight: 800 !important;
        color: rgb(15 23 42) !important;
      }

      .microsoft365-page h1 + p {
        margin-top: 4px !important;
        color: rgb(71 85 105) !important;
        font-size: .88rem !important;
      }

      .microsoft365-page > div > .flex.gap-2 {
        margin-bottom: 18px !important;
      }

      .microsoft365-page > div > [class*="rounded-lg"][class*="border"],
      .microsoft365-page > div > [class*="rounded-xl"][class*="border"] {
        border: 1px solid rgb(56 189 248) !important;
        border-left: 3px solid rgb(2 132 199) !important;
        border-radius: 9px !important;
        background: white !important;
        box-shadow: 0 8px 20px rgb(15 23 42 / .055) !important;
      }

      .microsoft365-page > div > [class*="rounded-lg"][class*="border"] + [class*="rounded-lg"][class*="border"],
      .microsoft365-page > div > [class*="rounded-xl"][class*="border"] + [class*="rounded-xl"][class*="border"] {
        margin-top: 16px !important;
      }

      .microsoft365-page > div > [class*="rounded-lg"][class*="border"] > div:first-child,
      .microsoft365-page > div > [class*="rounded-xl"][class*="border"] > div:first-child {
        padding: 18px 20px 10px !important;
      }

      .microsoft365-page > div > [class*="rounded-lg"][class*="border"] > div:not(:first-child),
      .microsoft365-page > div > [class*="rounded-xl"][class*="border"] > div:not(:first-child) {
        padding-left: 20px !important;
        padding-right: 20px !important;
        padding-bottom: 18px !important;
      }

      .microsoft365-page [class*="CardTitle"],
      .microsoft365-page [class*="text-2xl"],
      .microsoft365-page [class*="font-semibold"] {
        color: rgb(15 23 42) !important;
      }

      .microsoft365-page [class*="CardDescription"],
      .microsoft365-page .text-muted-foreground {
        color: rgb(100 116 139) !important;
      }

      .microsoft365-page [class*="rounded-md"][class*="border"],
      .microsoft365-page [class*="rounded-lg"][class*="border"] [class*="rounded-md"][class*="border"] {
        border: 1px solid rgb(125 211 252) !important;
        border-radius: 8px !important;
        background: rgb(240 249 255) !important;
        box-shadow: none !important;
      }

      .microsoft365-page select,
      .microsoft365-page input:not([type="checkbox"]) {
        border: 1px solid rgb(125 211 252) !important;
        border-radius: 7px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
      }

      .microsoft365-page button[class*="bg-primary"],
      .microsoft365-page button:not([class*="border"])[class*="text-primary-foreground"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .microsoft365-page button[class*="border"] {
        background: white !important;
        border-color: rgb(56 189 248) !important;
        color: rgb(3 105 161) !important;
      }

      .microsoft365-page [role="alert"] {
        border: 1px solid rgb(56 189 248) !important;
        border-left: 3px solid rgb(2 132 199) !important;
        border-radius: 9px !important;
        background: white !important;
        box-shadow: 0 6px 16px rgb(15 23 42 / .045) !important;
      }

      .microsoft365-page [role="alert"] [class*="rounded"] {
        background: transparent !important;
      }

      .microsoft365-page .grid > [class*="rounded-md"][class*="border"],
      .microsoft365-page .space-y-3 > [class*="rounded-md"][class*="border"],
      .microsoft365-page .space-y-4 > [class*="rounded-md"][class*="border"] {
        background: rgb(240 249 255) !important;
      }

      .microsoft365-page > div > [class*="rounded-lg"][class*="border"]:hover,
      .microsoft365-page > div > [class*="rounded-xl"][class*="border"]:hover {
        box-shadow: 0 10px 24px rgb(15 23 42 / .075) !important;
      }
    `}</style>
  );
}
