import Link from 'next/link';
import { listGroups } from '@/lib/service';
import { CreateGroupForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const groups = await listGroups();
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section>
        <h1 className="text-xl font-semibold">Groups</h1>
        {groups.length === 0 ? (
          <p className="mt-3 text-stone-600">No groups yet. Make the first one.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-300 rounded border border-stone-300 bg-white">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/groups/${g.id}`} className="block px-4 py-3 hover:bg-stone-50">
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold">New group</h2>
        <div className="mt-3">
          <CreateGroupForm />
        </div>
      </section>
    </div>
  );
}
