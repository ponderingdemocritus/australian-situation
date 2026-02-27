type EnergyMetricCardProps = {
  title: string;
  value: string;
  isModeled: boolean;
};

export function EnergyMetricCard({
  title,
  value,
  isModeled
}: EnergyMetricCardProps) {
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <p>{value}</p>
      {isModeled ? <span>Modeled estimate</span> : null}
    </section>
  );
}
