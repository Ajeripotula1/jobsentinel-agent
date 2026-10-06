import { Badge } from './ui/badge'
import { SOURCE_META } from '@/lib/source'

// `?.` goes after the lookup, not before it: SOURCE_META always exists, but
// SOURCE_META[source] is undefined for a source the UI doesn't know yet.
// className passes through so a call site can resize the badge.
export const SourceBadge = ({ source, className }) => {
  const meta = SOURCE_META[source]
  return (
    <Badge variant={meta?.variant ?? 'secondary'} className={className}>
      {meta?.label ?? source}
    </Badge>
  )
}
