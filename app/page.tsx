// app/lab/page.tsx
import AtomicChainReaction from '@/components/AtomicChainReaction';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Break Somnia',
  description: 'Simulate atomic chain reactions with physics to break Somnia Network',
};

export default function LabPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-gray-950 dark:to-indigo-950">
      <AtomicChainReaction />
    </main>
  );
}