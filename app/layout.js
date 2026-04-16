import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata = {
  title: 'TGStream',
  description: 'Private, secure messaging — instantly.',
};

// Next.js 16 separates viewport config from metadata
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} dark`} suppressHydrationWarning>
      <head>
        {/* Capacitor / PWA meta */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#05060f" />
      </head>
      <body className={`${jakarta.variable} font-sans bg-[#05060f] text-white selection:bg-indigo-500/30`}>
        {children}
      </body>
    </html>
  );
}
