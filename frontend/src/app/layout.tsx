import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Six Hand · Texas Hold'em",
  description:
    "A six-player Texas Hold'em hand simulator with a live play log and saved hand history.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
