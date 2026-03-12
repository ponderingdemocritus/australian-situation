import { Card, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui/components/ui/card";

export type SectionCardItem = {
  detail: string;
  label: string;
  value: string;
};

export function SectionCards({ items }: { items: SectionCardItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.label}
          className="bg-gradient-to-t from-primary/5 to-card shadow-xs"
        >
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{item.value}</CardTitle>
            <div className="text-sm text-muted-foreground">{item.detail}</div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
