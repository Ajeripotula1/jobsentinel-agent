import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { buttonVariants } from '@/components/ui/button'

export function HomePage() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Track job fit without the guesswork
      </h1>
      <p className="mt-4 text-muted-foreground">
        JobSentinel follows specific companies' job boards, scores your fit against a posting,
        and helps you tailor a resume and cover letter for it — grounded only in what you've
        actually told it, never invented.
      </p>
      {/* The first step differs by auth state. Visitors start where the
          flow starts - seeing which companies are covered. Signed-in users
          go straight to their feed, which is also how a returning user gets
          there in one click (My jobs is the second nav tab, not the first). */}
      <div className="mt-8 flex justify-center gap-3">
        <SignedOut>
          <Link to="/companies" className={buttonVariants({ size: 'lg' })}>
            Browse companies
          </Link>
          <Link to="/sign-up" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Get started
          </Link>
        </SignedOut>
        <SignedIn>
          <Link to="/feed" className={buttonVariants({ size: 'lg' })}>
            My jobs
          </Link>
          <Link to="/profile" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Upload your resume
          </Link>
        </SignedIn>
      </div>
    </div>
  )
}