import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HARDT Records", template: "%s · HARDT Records" },
  description: "County recorder document intake for HARDT.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
