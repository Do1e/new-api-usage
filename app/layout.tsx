import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - API Usage",
  description: "API usage analytics dashboard",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;