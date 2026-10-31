import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPI Offline Mesh — High-Assurance Offline Payments",
  description:
    "Bluetooth Mesh-routed offline UPI payment simulator with Hybrid RSA-OAEP + AES-GCM cryptography and atomic idempotency settlement.",
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased selection:bg-indigo-600 selection:text-white font-sans transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
