import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ui/theme-provider';

export const metadata: Metadata = {
  title: 'Resolve | AI Payment Dispute Agent',
  description:
    'An AI payment investigator with human-approved mock refunds built with Next.js, native AI tool calling, and Supabase. Fictional data, transparent tool activity, and human control.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('resolve-theme');document.documentElement.dataset.theme=(t==='dark'||t==='light')?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){}" }} />
        <a className="skip-link" href="#main-content">Skip to content</a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
