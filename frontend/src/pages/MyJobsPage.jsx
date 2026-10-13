import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useFeedJobs } from '@/hooks/useJobs'
import { JobsTable } from '@/components/jobs/JobsTable'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'

// One line under the title saying where the feed's jobs come from.
const feedSubtitle = (signedOut, followedCount) => {
    if (signedOut) return 'Open roles from the companies you follow.'
    if (followedCount === undefined) return null // still loading
    if (followedCount === 0) return "You're not following any companies yet."
    return `Open roles from the ${followedCount} ${followedCount === 1 ? 'company' : 'companies'} you follow.`
}

// The signed-in user's feed: jobs from companies they follow (GET /jobs/feed).
//
// Public route. Signed out, it renders the same layout with no data - an
// empty table plus a sign-in message - so visitors can see what the feature
// is before creating an account. useFeedJobs is `enabled: !!userId`, so
// nothing is fetched for them.
export const MyJobsPage = () => {
    // `=== false`, not `!isSignedIn`: Clerk's isSignedIn is `undefined`
    // until it loads, and treating that as signed out would flash the
    // preview at signed-in users on every page load. While Clerk loads, the
    // table just shows its loading rows.
    const { isSignedIn } = useAuth()
    const signedOut = isSignedIn === false
    const { data: feed, isPending, isError, error } = useFeedJobs()
    const subtitle = feedSubtitle(signedOut, feed?.followed_count)

    // The empty cases need different advice. Signed in, followed_count in
    // the envelope tells "following nothing" apart from "no openings".
    let emptyMessage = 'None of the companies you follow have open jobs right now.'
    if (signedOut) {
        emptyMessage = 'Sign in and follow some companies - their open jobs will show up here.'
    } else if (feed?.followed_count === 0) {
        emptyMessage = 'Follow some companies on the Companies page and their open jobs will show up here.'
    }

    return (
        <div className='flex flex-col gap-6'>
            {/* Same header shape as CompaniesPage: title + one-line subtitle
                on the left, the page's action on the right. */}
            <header className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
                <div className='flex flex-col gap-1'>
                    <h1 className='text-2xl font-semibold tracking-tight'>My jobs</h1>
                    {/* min-h keeps the header from jumping when the count
                        arrives after the feed loads. */}
                    <p className='min-h-5 text-sm text-muted-foreground'>{subtitle}</p>
                </div>
                <Link to='/companies' className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {signedOut ? 'Browse companies' : 'Edit companies'}
                </Link>
            </header>

            {/* Message only - Sign in / Sign up already live in the navbar. */}
            {signedOut && (
                <Alert>
                    <AlertTitle>Sign in to see your job feed</AlertTitle>
                    <AlertDescription>
                        Follow the companies you care about, and every open role they post lands
                        here, newest first, in one list.
                    </AlertDescription>
                </Alert>
            )}

            <JobsTable
                // Signed out, pass an empty list rather than `undefined` so
                // the table renders its empty state. And override isPending:
                // a disabled query stays "pending" forever, so the table
                // would show loading rows that never resolve.
                jobs={signedOut ? [] : feed?.jobs}
                isPending={signedOut ? false : isPending}
                isError={isError}
                error={error}
                emptyMessage={emptyMessage}
            />
        </div>
    )
}
