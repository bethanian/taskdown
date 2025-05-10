
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GoogleAuthProvider } from '@/contexts/GoogleAuthContext';

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
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    console.error("Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment variables.");
    // Optionally render a fallback or error message if Client ID is critical for the entire app
  }
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* GAPI script is loaded by googleCalendarService on demand now */}
        {/* <Script src="https://apis.google.com/js/api.js" strategy="beforeInteractive" /> */}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {googleClientId ? (
          <GoogleOAuthProvider clientId={googleClientId}>
            <GoogleAuthProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
                themes={availableThemes}
              >
                {children}
                <Toaster />
              </ThemeProvider>
            </GoogleAuthProvider>
          </GoogleOAuthProvider>
        ) : (
          // Fallback if Google Client ID is not available
          // This ensures the app can still run, albeit without Google features
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            themes={availableThemes}
          >
            {children}
            <Toaster />
            <div 
              style={{ 
                position: 'fixed', 
                bottom: '10px', 
                left: '10px', 
                background: 'yellow', 
                padding: '10px', 
                border: '1px solid orange', 
                zIndex: 1000 
              }}
            >
              Google Client ID not configured. Calendar features will be unavailable.
            </div>
          </ThemeProvider>
        )}
      </body>
    </html>
  );
}
