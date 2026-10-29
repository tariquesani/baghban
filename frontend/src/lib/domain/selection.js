/**
 * Whether this map item is the current selection.
 * `type` is `bed` or `obstacle`. A pot or planter stays a bed; its kind
 * stays on the object. Bed 2 and obstacle 2 are different selections.
 * @param {{ type?: string, id?: number | string } | null | undefined} selection
 * @param {'bed' | 'obstacle'} type
 * @param {number | string | null | undefined} id
 */
export function isSelected(selection, type, id) {
  if (!selection || selection.id == null || id == null) return false;
  return selection.type === type && selection.id === id;
}
