import Link from 'next/link';

export default function NotFound() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Group not found</h1>
      <p className="mt-2 text-stone-600">That link does not match a group.</p>
      <Link href="/" className="mt-4 inline-block underline">
        Back to all groups
      </Link>
    </div>
  );
}
