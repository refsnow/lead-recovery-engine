import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Leadloop',
    template: '%s · Leadloop',
  },
  description:
    'Recover the leads you are already paying for. Automatically qualify, follow up and route real-estate leads with complete visibility from enquiry to conversion.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
