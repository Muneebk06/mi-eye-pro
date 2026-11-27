export const barColor = (v: number) => (v >= 80 ? '#16A34A' : v >= 75 ? '#D97706' : '#B91C1C');

export default function Bar({ value }: { value: number }) {
  return <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%`, background: barColor(value) }} /></div>;
}
