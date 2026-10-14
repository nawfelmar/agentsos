import Link from "next/link";

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-relay border border-line bg-surface p-6 shadow-panel">
        <h1 className="font-display text-2xl text-ink">Relay needs a database seed</h1>
        <p className="mt-2 text-sm text-muted">
          From the <code className="font-mono text-xs text-accent">relay/</code> directory run:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-relay bg-canvas p-3 font-mono text-xs text-muted">
{`npm install
npm run db:setup
npm run dev`}
        </pre>
        <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
          Retry Command Center →
        </Link>
      </div>
    </div>
  );
}
