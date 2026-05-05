import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Partner Kit — Too Fresh To Waste',
  description: 'Official partner presentation document for Too Fresh To Waste.',
};

export default function KitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
