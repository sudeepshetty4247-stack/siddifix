export function descriptionOverlap(a: string, b: string) {
  const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const left = words(a), right = words(b);
  const union = new Set([...left, ...right]);
  return union.size ? [...left].filter(w => right.has(w)).length / union.size : 0;
}