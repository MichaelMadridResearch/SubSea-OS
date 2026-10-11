import type { ReactNode } from "react";
import "./globals.css";
import { readDesignCss } from "./theme";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subsea Response OS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <style>{readDesignCss()}</style>
        <main>{children}</main>
      </body>
    </html>
  );
}
