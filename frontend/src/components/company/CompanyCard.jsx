import { Card, CardHeader, CardTitle, CardContent, CardAction } from '../ui/card'
import { Briefcase, Check, Plus } from 'lucide-react'
import { SourceBadge } from '../SourceBadge'
import { Button } from '../ui/button'
import { Link } from 'react-router-dom'
// Presentational only: CompaniesPage owns the data and the follow/unfollow
// mutations; this just renders props and reports clicks via toggleFollow.
export const CompanyCard = ({ company, isFollowing, toggleFollow, isPending, isSignedIn }) => {
    return (
        // A followed card gets a stronger ring so you can scan the grid for
        // what you follow without reading every button.
        <Card className={isFollowing ? 'ring-primary/40' : undefined}>
            <CardHeader>
                {/* min-w-0: a grid/flex child won't shrink below its content
                    width by default, which would stop `truncate` from ever
                    kicking in and push the button out of the card. */}
                <div className='flex min-w-0 items-center gap-3'>
                    {/* Monogram stand-in for a logo - we don't store logos,
                        and this gives the card a visual anchor. */}
                    <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-base font-semibold text-muted-foreground'>
                        {company.name.charAt(0).toUpperCase()}
                    </div>
                    <CardTitle className='truncate text-lg' title={company.name}>
                        {company.name}
                    </CardTitle>
                </div>
                {/* CardAction pins the button to the header's top-right, so
                    it's sized to its label instead of stretching to fill the
                    card. self-center lines it up with the monogram. */}
                <CardAction className='self-center'>
                    {/* `=== false`, not `!isSignedIn`: Clerk's isSignedIn is
                        `undefined` until it has loaded, and treating that as
                        signed out flashes the sign-in link at signed-in users
                        on every page load. While loading, show a disabled Follow. */}
                    {isSignedIn === false ? (
                        <Button
                            size='sm'
                            variant='outline'
                            render={<Link to={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`} />}
                        >
                            <Plus data-icon='inline-start' />
                            Follow
                        </Button>
                    ) : (
                        <Button
                            size='sm'
                            variant={isFollowing ? 'secondary' : 'default'}
                            disabled={!isSignedIn || isPending}
                            onClick={toggleFollow}
                        >
                            {isFollowing ? <Check data-icon='inline-start' /> : <Plus data-icon='inline-start' />}
                            {isFollowing ? 'Following' : 'Follow'}
                        </Button>
                    )}
                </CardAction>
            </CardHeader>
            <CardContent className='flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground'>
                <SourceBadge source={company.source} className='h-6 px-2.5 text-sm' />
                <span className='flex items-center gap-1.5'>
                    <Briefcase className='size-4' />
                    {company.job_count} open {company.job_count === 1 ? 'role' : 'roles'}
                </span>
            </CardContent>
        </Card>
    )
}
