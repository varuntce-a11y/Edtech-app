import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UpSkillIN — Learn skills that move your career forward',
  description: 'Hassle-free upskilling for India’s graduates, professionals and job seekers. Learn practical skills from expert instructors.',
  applicationName: 'UpSkillIN',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#126a57',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
