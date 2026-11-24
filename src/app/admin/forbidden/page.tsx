import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="py-16">
      <h1 className="text-2xl font-semibold">You don’t have access to this page</h1>
      <p className="mt-2 text-muted">Your role doesn’t include the permission this page needs. Ask an administrator if you need access.</p>
      <Link href="/admin" className="mt-4 inline-block text-sm text-primary hover:underline">Back to dashboard</Link>
    </div>
  );
}
