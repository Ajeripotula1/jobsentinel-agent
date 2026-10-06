import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '../ui/button'
import { Link } from 'react-router-dom'
// Presentational only: CompaniesPage owns the data and the follow/unfollow
// mutations; this just renders props and reports clicks via toggleFollow.
export const CompanyCard = ({ company, isFollowing, toggleFollow, isPending, isSignedIn }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{company.name}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className='flex gap-3 items-center'>
                    <Badge>{company.source}</Badge>
                    <span>-</span>
                    <span> Some number jobs</span>
                </div>
                {/* `=== false`, not `!isSignedIn`: Clerk's isSignedIn is
                    `undefined` until it has loaded, and treating that as
                    signed out flashes "Sign in to follow" at signed-in users
                    on every page load. While loading, show a disabled Follow. */}
                {isSignedIn === false ? (
                    <Link to={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`}
                        className={buttonVariants()}>
                        Sign in to follow
                    </Link>
                ) : (
                    <Button
                        variant={isFollowing ? 'outline' : 'default'}
                        disabled={!isSignedIn || isPending}
                        onClick={toggleFollow}
                    >
                        {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                )}

            </CardContent>
        </Card>
    )
}
