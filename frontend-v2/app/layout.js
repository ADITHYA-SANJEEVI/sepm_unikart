import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Inter } from "next/font/google";
import { V2AppProviders } from "@/components/v2-app-providers";
import { V2Shell } from "@/components/v2-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "UniKart - Campus Marketplace",
  description: "Buy, sell, rent, and compare student essentials. The trusted campus marketplace for faster, safer peer-to-peer transactions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <V2AppProviders>
          <V2Shell>{children}</V2Shell>
        </V2AppProviders>
      </body>
    </html>
  );
}
