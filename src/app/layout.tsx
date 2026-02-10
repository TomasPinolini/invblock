import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Financial Command Center",
  description: "Multi-asset portfolio tracker & analysis tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased
                    bg-zinc-950 text-zinc-100 min-h-screen`}
      >
        <Providers><main id="main-content">{children}</main></Providers>
      </body>
    </html>
  );
}
