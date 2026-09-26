// Display metadata for FitAssessment's `match` and gap `gap_type` enums.
// Keys are the exact string values the API returns (see
// src/jobsentinel/agent/shared/schema.py), so `MATCH_META[assessment.match]`
// works with no translation step. `className` is meant for a shadcn <Badge
// className={...}> - it overrides the badge's default colors.

// Descriptions are copied verbatim from MATCH_DEFINITIONS in schema.py (the
// single source of truth for what each value means - the same text the
// model itself was prompted with). If that dict changes, update these.
export const MATCH_META = {
    strong_match: {
        label: 'Strong match',
        description: 'Meets essentially all important requirements; profile aligns closely with the role.',
        className: 'bg-emerald-600 text-white',
    },
    good_match: {
        label: 'Good match',
        description: 'Meets most important requirements but has some non-critical gaps.',
        className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
    },
    potential_match: {
        label: 'Potential match',
        description: 'Relevant foundation, but meaningful gaps exist; reasonable stretch.',
        className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    },
    weak_match: {
        label: 'Weak match',
        description: 'Some overlap, but several important requirements are missing.',
        className: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
    },
    not_a_match: {
        label: 'Not a match',
        description: 'Major incompatibility or a hard requirement prevents meaningful fit.',
        className: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
    },
}

// Why a requirement is a gap rather than a strength (GapType in schema.py).
export const GAP_TYPE_LABELS = {
    not_mentioned: 'Not in your profile',
    contradicts: 'Conflicts with your profile',
    posting_underspecified: 'Posting is unclear',
}
