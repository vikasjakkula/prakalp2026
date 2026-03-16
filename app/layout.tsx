import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Smart Environmental Station | Helix3",
  description: "AI-powered environmental monitoring & prediction — soil, atmosphere, air quality, and 6-hour forecasts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-classic">
        {children}
      </body>
    </html>
  );
}
