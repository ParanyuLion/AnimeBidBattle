export function characterImageUrl(id: string): string {
  return `/characters/${encodeURIComponent(id)}.jpg`;
}

/** Placeholder text for a card whose image is missing. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s.]+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return '?';
  if (words.length === 1) return first.slice(0, 1).toUpperCase();
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}
