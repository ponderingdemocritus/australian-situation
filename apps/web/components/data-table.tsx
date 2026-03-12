import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@aus-dash/ui/components/ui/table";

export type DashboardCoverageRow = {
  access: string;
  endpoint: string;
  route: string;
  surface: string;
};

export function DataTable({ data }: { data: DashboardCoverageRow[] }) {
  return (
    <div className="px-4 lg:px-6">
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Surface</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={`${row.route}-${row.endpoint}`}>
                <TableCell>{row.surface}</TableCell>
                <TableCell>{row.route}</TableCell>
                <TableCell>{row.endpoint}</TableCell>
                <TableCell>{row.access}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
