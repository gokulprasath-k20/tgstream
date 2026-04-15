import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata = {
  title: 'TGStream - Premium Watch Parties',
  description: 'Experience the ultimate watch party with high-quality streaming and video calls.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} dark`} suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans bg-[#05060f] text-white selection:bg-indigo-500/30`}>
        <div className="flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
