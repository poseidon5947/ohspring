import "./globals.css";
import "./golden.css";
import WebsiteLoader from "@/components/WebsiteLoader";
import PortfolioAtmosphere from "@/components/PortfolioAtmosphere";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
export const metadata = {
  title: "AB Systems Tech | Software, Hardware & IT Support",
  description:
    "Soluciones tecnológicas desde Colombia. Custom software and remote IT support worldwide. Hardware repairs and on-site support in Colombia.",
  icons: { icon: "/brand/icon.webp" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <PortfolioAtmosphere />
        <WebsiteLoader>{children}</WebsiteLoader>
      </body>
    </html>
  );
}
