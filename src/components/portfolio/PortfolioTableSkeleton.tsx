export function PortfolioTableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-800/30">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-700" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
