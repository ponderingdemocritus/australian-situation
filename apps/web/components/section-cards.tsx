import { Card, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";

export type SectionCardItem = {
  detail: string;
  label: string;
  value: string;
};

export function SectionCards({ items }: { items: SectionCardItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {items.map((item, index) => (
        <Card
          key={item.label}
          className={index === 0 ? "border-primary/30 bg-primary/5 @xl/main:col-span-2 @5xl/main:col-span-1" : ""}
        >
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className={`font-semibold tabular-nums ${index === 0 ? "text-3xl" : "text-2xl"}`}>
              {item.value}
            </CardTitle>
            <div className="text-sm text-muted-foreground">{item.detail}</div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
