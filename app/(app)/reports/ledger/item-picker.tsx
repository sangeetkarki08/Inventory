'use client';

import { useRouter } from 'next/navigation';

interface ItemOption {
  id: number;
  name: string;
  unit: string;
  category: string;
}

export function ItemPicker({
  items,
  selectedId,
}: {
  items: ItemOption[];
  selectedId?: number;
}) {
  const router = useRouter();

  return (
    <select
      defaultValue={selectedId ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        if (v) router.push(`/reports/ledger?item=${v}`);
        else router.push('/reports/ledger');
      }}
      className="w-full px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
    >
      <option value="">— Select an item —</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name} ({i.category}, {i.unit})
        </option>
      ))}
    </select>
  );
}
