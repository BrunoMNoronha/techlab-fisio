import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechLab Fisio",
  description: "Fundação técnica do frontend do TechLab Fisio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
