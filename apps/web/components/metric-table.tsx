import type { ReactNode } from "react";

type MetricTableRow = {
  detail?: ReactNode;
  label: ReactNode;
  value: ReactNode;
};

type MetricTableProps = {
  rows: MetricTableRow[];
};

export function MetricTable({ rows }: MetricTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Metric</th>
            <th className="pb-2 pr-4 font-medium">Value</th>
            <th className="pb-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium text-muted-foreground">
                {row.label}
              </td>
              <td className="py-2 pr-4 font-semibold text-foreground">
                {row.value}
              </td>
              <td className="py-2 text-muted-foreground">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
