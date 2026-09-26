import { Badge } from '@/components/ui/badge'
import { GAP_TYPE_LABELS, MATCH_META } from '@/lib/match'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

// Renders a FitAssessment (src/jobsentinel/agent/shared/schema.py) - the
// same shape GET and POST /jobs/{id}/score return. Presentational only: no
// hooks, no fetching; ScoreFitPanel decides *when* this renders.
//
// Safeguards, and why each one exists:
// - MATCH_META / GAP_TYPE_LABELS lookups fall back to the raw enum value.
//   If the backend ever adds an enum value before lib/match.js is updated,
//   the UI shows "new_value" in a neutral badge instead of crashing on
//   `undefined.className`.
// - `?? []` on the lists. The schema says they're always arrays, but this
//   data is LLM output persisted to the DB - a default costs nothing and
//   a `.map` on undefined would take down the whole page.
// - `gap.note` is `str | None` in the schema, so it only renders when set.

// Module-level (not defined inside FitAssessmentView): a component declared
// inside another component's body is a *new* component type on every
// render, so React unmounts and remounts its whole subtree each time.
const Section = ({ title, children }) => (
    <section className="space-y-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {children}
    </section>
)

// Shared list shell for Strengths and Gaps: the empty state lives in one
// place instead of being repeated per section. An empty list is a valid
// result (a strong match can have zero gaps), not an error.
const ItemList = ({ items, renderItem }) =>
    items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None identified.</p>
    ) : (
        // Index keys are fine here: the list is replaced wholesale on a
        // re-run, never reordered or edited in place, and items have no id.
        <ul className="space-y-3">
            {items.map((item, i) => (
                <li key={i} className="flex gap-2">
                    {renderItem(item)}
                </li>
            ))}
        </ul>
    )

// Icon + text row. `shrink-0` stops a long requirement from squeezing the
// icon in the 400px column; `mt-0.5` nudges the 16px icon to line up with
// the first line of 14px text instead of the block's center; `min-w-0`
// lets the text wrap rather than overflow.
const StrengthItem = ({ strength }) => (
    <>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">{strength.requirement}</p>
            <p className="text-sm text-muted-foreground">{strength.evidence}</p>
        </div>
    </>
)

const GapItem = ({ gap }) => (
    <>
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 space-y-1">
            {/* flex-wrap: in a narrow column the badge drops under a long
                requirement instead of overflowing the card. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium">{gap.requirement}</p>
                <Badge variant="outline">{GAP_TYPE_LABELS[gap.gap_type] ?? gap.gap_type}</Badge>
            </div>
            {gap.note && <p className="text-sm text-muted-foreground">{gap.note}</p>}
        </div>
    </>
)

export const FitAssessmentView = ({ assessment }) => {
    const { match, summary, recommendation_note } = assessment
    const strengths = assessment.strengths ?? []
    const gaps = assessment.gaps ?? []
    const meta = MATCH_META[match] ?? { label: match, description: null, className: undefined }

    return (
        <div className="@container space-y-5">
            {/* Verdict first: the badge is the one-glance answer. */}
            <div className="space-y-1.5">
                <Badge className={`h-auto px-3 py-1 text-sm ${meta.className ?? ''}`}>{meta.label}</Badge>
                {meta.description && <p className="text-xs text-muted-foreground">{meta.description}</p>}
            </div>

            <p className="text-sm leading-relaxed">{summary}</p>

            {/* Side by side when the *panel* is ≥32rem wide, stacked otherwise.
                `@lg:` is a container query, not a viewport breakpoint (`lg:`):
                it keys off the @container on the root div below, i.e. how
                much room this component actually got. At a 1024px viewport
                the panel is only ~440px (two cramped ~210px columns), so a
                viewport breakpoint would pick the wrong layout there. */}
            <div className="grid gap-5 @lg:grid-cols-2">
                        {/* <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> */}

                <Section title={`Strengths (${strengths.length})`}>
                    <ItemList items={strengths} renderItem={(s) => <StrengthItem strength={s} />} />
                </Section>

                <Section title={`Gaps (${gaps.length})`}>
                    <ItemList items={gaps} renderItem={(g) => <GapItem gap={g} />} />
                </Section>
            </div>

            {recommendation_note && (
                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                    <p className="font-medium">Recommendation</p>
                    <p className="text-muted-foreground">{recommendation_note}</p>
                </div>
            )}
        </div>
    )
}
