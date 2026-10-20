import type { Metadata } from 'next';
import { ChatWorkspace } from '@/components/chat/chat-workspace';

export const metadata: Metadata = { title: 'Investigation | Resolve' };
export default function DemoPage() {
  return <ChatWorkspace />;
}
