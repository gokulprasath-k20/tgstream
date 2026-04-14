import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'TGStream | Watch Movies Together',
  description: 'A secure and high-performance watch party application.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Navbar />
        <main style={{ paddingTop: '80px', minHeight: '100vh' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
