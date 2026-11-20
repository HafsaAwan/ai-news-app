import type { Metadata } from "next";
import { Caveat, Poppins } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: site.name,
  description: site.tagline,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className={`${poppins.variable} ${caveat.variable}`}>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <header id="top" className="site-header">
          <nav className="shell flex flex-wrap items-center justify-between gap-x-6 gap-y-2" aria-label="Main navigation">
            <a className="brand" href="#top">
              <span className="brand-mark" aria-hidden="true" />
              {site.name}
            </a>
            <a className="nav-link" href="#about">About the deck</a>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}
