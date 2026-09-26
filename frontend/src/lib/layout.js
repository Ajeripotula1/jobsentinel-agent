// Classes for a shadcn Card that scrolls its own content on lg+ screens
// while its title stays pinned. Used by the Job Detail page's two columns
// (posting + ScoreFitPanel). All lg:-prefixed: on mobile they're plain
// cards in a normal scrolling page.
//
// Why scroll *inside* the Card, not a wrapper around it: Card draws its
// outline with `ring-1`, a box-shadow painted outside its own box. A
// scrolling wrapper clips everything outside its box - ring included - so
// the outline disappeared. Scrolling CardContent inside the Card keeps the
// ring, rounded corners, and title all intact.

// On the Card (already `flex flex-col overflow-hidden`):
// - max-h-full: never taller than its grid cell - but no taller than its
//   content either, so a short card (e.g. "Score fit" button) stays short
//   instead of stretching into an empty full-height box. The cell has a
//   definite height (the page grid's minmax(0,1fr) row), so % resolves.
// - self-start: in a grid, items stretch to the row height by default,
//   which would make max-h-full meaningless for the short case.
export const SCROLL_CARD = 'lg:max-h-full lg:self-start'

// On CardContent - the one flex child that gives up height when the Card
// hits max-h-full:
// - min-h-0: a flex item's default min-height is its content height, so
//   without this it refuses to shrink and just overflows the Card.
// - overflow-y-auto: whatever doesn't fit scrolls, scrollbar only if needed.
// - overscroll-contain: reaching the end doesn't chain the scroll outward.
export const SCROLL_CARD_CONTENT = 'lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain'
