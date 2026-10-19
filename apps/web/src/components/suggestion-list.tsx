/**
 * The words a text box suggests as you type, from the society's catalogue. A
 * native <datalist>: the box stays free text, so a new word is allowed, and the
 * phone's own keyboard offers the matches. Point an input's `list` at `id`.
 */
export function SuggestionList({ id, items }: { id: string; items: { label: string }[] }) {
  return (
    <datalist id={id}>
      {items.map((item) => (
        <option key={item.label} value={item.label} />
      ))}
    </datalist>
  );
}
