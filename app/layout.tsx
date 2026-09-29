import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AdSenseScript } from '@/components/AdSenseScript';

export const metadata: Metadata = {
  title: 'BeamShare - Real-Time Zero-Database P2P Code & File Sharing',
  description: 'Instant peer-to-peer code editor, document, and image sharing platform without servers, logins, or cloud databases. Powered by WebRTC.',
  keywords: ['P2P code share', 'WebRTC file transfer', 'CodeShare alternative', 'Zero database share', 'Real-time code collaboration', 'BeamShare'],
  authors: [{ name: 'BeamShare Team' }],
  openGraph: {
    title: 'BeamShare - Instant P2P Code & File Sharing',
    description: '100% Peer-to-Peer browser code editor & document sharing. Zero database storage.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <AdSenseScript />
      </head>
      <body className="bg-[#090d16] text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
