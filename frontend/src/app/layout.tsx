import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { AppToastContainer } from "@/components/ui/use-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MRT-3 Simulation",
  description: "Simulate MRT-3 operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.className
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <AppToastContainer
            position="top-right"
            newestOnTop={false}
            limit={5}
            theme="colored"
            toastClassName="mb-4 bg-card rounded-md shadow-md border-l-4 border-mrt-blue p-4 text-sm text-card-foreground"
            progressClassName="bg-mrt-blue"
            autoClose={5000}
            closeOnClick
            pauseOnHover
            draggable
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
