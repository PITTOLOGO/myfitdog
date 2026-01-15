import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "myFitDog",
  description: "Calorie & coaching per cani",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>
        <div className="app-shell">
          <div className="app-surface">{children}</div>
        </div>
      </body>
    </html>
  );
}
