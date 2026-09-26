import { Room } from '@/components/Room';

export default async function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Room code={code.replace(/\D/g, '').slice(0, 6)} />;
}
