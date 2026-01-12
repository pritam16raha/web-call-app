import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CallProvider } from "@/contexts/CallContext";

export const metadata: Metadata = {
  title: "WebCall - Video & Voice Calling",
  description: "Connect with anyone through video and voice calls",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CallProvider>
            {children}
          </CallProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
