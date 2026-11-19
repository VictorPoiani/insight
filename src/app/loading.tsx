import { AsteriskLoader } from '../components/ui/AsteriskLoader';

export default function GlobalTabLoading() {
  return (
    <div className="w-full min-h-screen bg-background flex items-center justify-center">
      <AsteriskLoader size="lg" fullHeight />
    </div>
  );
}