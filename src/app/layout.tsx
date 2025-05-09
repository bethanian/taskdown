import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Taskdown',
  description: 'A modern, developer-focused checklist app.',
};

const availableThemes = [
  'light', 
  'dark', 
  'sakura', 
  'aqua', 
  'leather', 
  'lightning', 
  'zen', 
  'forest', 
  'ocean', 
  'desert', 
  'starlight'
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          themes={availableThemes} // Added themes prop
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
