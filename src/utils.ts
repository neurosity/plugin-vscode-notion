export function mapRange(
  value: number,
  lowValue: number,
  highValue: number,
  lowScale: number = 0,
  highScale: number = 1
): number {
  return (
    lowScale +
    ((highScale - lowScale) * (value - lowValue)) /
      (highValue - lowValue)
  );
}
