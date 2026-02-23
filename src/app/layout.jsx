import "./globals.css";
import { getAppName } from "@/lib/config";

export const metadata = {
  title: getAppName(),
  description: "Simple payment aggregator MVP",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
