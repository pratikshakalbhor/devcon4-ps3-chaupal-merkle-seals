import type { Metadata } from "next";
import { AccountBar } from "@/components/AccountBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chaupal Seal",
  description: "A seal of belonging for every chaupal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AccountBar />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}