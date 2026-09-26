import { Link } from 'react-router-dom'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useRunScoreFit, useScoreFit } from '@/hooks/useScoreFit'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ErrorAlert from '@/components/ErrorAlert'
import { FitAssessmentView } from './FitAssessmentView'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { SCROLL_CARD, SCROLL_CARD_CONTENT } from '@/lib/layout'

// "Render by precedence" = an if / else-if chain where ORDER MATTERS: the
// panel is always in exactly one state, and the first condition that's true
// wins. Written as early returns (each `if` returns, so reaching the next
// `if` implies every check above it was false - that's what makes it an
// else-if chain without the `else` keywords).
//
// The one exception is `run.isError`, which UI.md marks "(any state above)":
// it isn't a state of its own, it's an extra alert layered ON TOP of the
// score-null / score-exists states. So it's rendered with `&&` inside those
// branches rather than being another rung of the ladder.
const ScoreFitBody = ({ jobId }) => {
    const profile = useProfile()
    const score = useScoreFit(jobId)
    const run = useRunScoreFit(jobId)

    // Rendered alongside whichever state we end up in (see note above).
    // ErrorAlert already returns null when error is null, but gating on
    // isError keeps the intent readable.
    const runError = run.isError && (
        <ErrorAlert error={run.error} title="Scoring failed" onRetry={() => run.mutate()} />
    )

    // 1. Loading. Checked first because until both queries resolve, `data` is
    //    undefined - every check below would be comparing against garbage.
    if (profile.isPending || score.isPending) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        )
    }

    // 2. A query really failed (401/500/network - 404s were already turned
    //    into `null` by the hooks). Retry refetches whichever one broke.
    if (profile.isError) {
        return <ErrorAlert error={profile.error} title="Couldn't load your profile" onRetry={profile.refetch} />
    }
    if (score.isError) {
        return <ErrorAlert error={score.error} title="Couldn't load your fit score" onRetry={score.refetch} />
    }

    // 3. No resume. This MUST come before the `score === null` check: with no
    //    profile the score GET also 404s -> null, so if the order were
    //    swapped we'd show a "Score fit" button that can only fail.
    if (profile.data === null) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Upload your resume first to score this job.</p>
                <Link to="/profile" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
                    Upload resume
                </Link>
            </div>
        )
    }

    // 4. Has a resume, never scored against it. Idle vs. running is ONE
    //    button whose icon/label swap, so nothing jumps when you click it.
    //    The "up to a minute" hint sits below, not in the label: buttons are
    //    whitespace-nowrap, so a long label would overflow the 400px column.
    if (score.data === null) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Not scored yet against your current resume.</p>
                <Button size="lg" className="w-full" onClick={() => run.mutate()} disabled={run.isPending}>
                    {run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {run.isPending ? 'Analyzing fit…' : 'Score fit'}
                </Button>
                {run.isPending && (
                    <p className="text-center text-xs text-muted-foreground">This can take up to a minute.</p>
                )}
                {runError}
            </div>
        )
    }

    // 5. Has a score. No `if` needed - everything above returned, so this is
    //    the `else`. The old result stays on screen during a re-run; only the
    //    button reflects run.isPending.
    return (
        // border-t separates the action from the result above it.
        <div className="space-y-4">
            <FitAssessmentView assessment={score.data} />
            <div className="border-t" />
            <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
                <RefreshCw className={run.isPending ? 'animate-spin' : undefined} />
                {run.isPending ? 'Re-scoring…' : 'Re-run'}
            </Button>
            {runError}
        </div>
    )
}

export const ScoreFitPanel = ({ jobId }) => {
    return(
        <Card className={SCROLL_CARD}>
            <CardHeader>
                <CardTitle>AI Job Fit Score</CardTitle>
                <CardDescription>How your resume lines up with this posting</CardDescription>
            </CardHeader>
            <CardContent className={SCROLL_CARD_CONTENT}>
                <ScoreFitBody jobId= {jobId}/>
            </CardContent>
        </Card>
    )
}

