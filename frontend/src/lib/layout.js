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

// ---- Tabbed card (Job Detail's right column: Fit score | Job Agent) ----
// Same idea as above, one level deeper. The height has to be passed down
// through EVERY layer, or scrolling silently stops working:
//   grid cell -> Card -> Tabs -> TabsContent (the thing that scrolls)
// Each layer is a flex column that takes the leftover height (flex-1) and
// is allowed to be shorter than its content (min-h-0).

// On the Card. h-full (not max-h-full like SCROLL_CARD): a fixed-size box,
// so switching tabs never resizes it, and the chat later gets the full
// column height to lay out its message list + input.
export const TABS_CARD = 'lg:h-full'

// On <Tabs> (already `flex flex-col` in the horizontal orientation).
export const TABS_ROOT = 'gap-4 lg:min-h-0 lg:flex-1'

// On <TabsList>: inset by the Card's own padding variable so the tab chooser
// sits in the top-left corner, lined up with the content below it.
export const TABS_LIST = 'mx-(--card-spacing)'

// On each <TabsContent> (already `flex-1`) - this is the element that
// scrolls, so the tab list above it stays pinned. With keepMounted, Base UI
// hides inactive panels with the `hidden` attribute (Tailwind's preflight
// makes that `display: none !important`), and each panel keeps its own
// scroll position while hidden.
export const TABS_PANEL = 'px-(--card-spacing) lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain'
