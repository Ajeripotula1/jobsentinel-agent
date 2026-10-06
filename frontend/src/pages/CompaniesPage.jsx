import { useCompanies, useFollowCompany, useFollowedCompanies, useUnfollowCompany } from '@/hooks/useCompanies'
import ErrorAlert from '@/components/ErrorAlert'
import { CompanyCard } from '@/components/company/CompanyCard'
import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { useAuth } from '@clerk/clerk-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

// Shared by the real grid and the loading skeletons so they always line up.
// 1 column on phones, stepping up to 4 on wide screens - each card needs
// room for the name plus the Follow button side by side.
const GRID = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export const CompaniesPage = () => {
  const {isSignedIn} = useAuth()
  // get companies + followed companies
  const { data: companies, isPending, isError, error } = useCompanies()
  const { data: followedCompanies, isPending: followedPending } = useFollowedCompanies()

  // Set of IDs for quick lookups; undefined (signed out or loading) means following nothing.
  const followedIds = useMemo(() => new Set(followedCompanies?.map((c) => c.id)), [followedCompanies])
  
  const followingCount = followedIds.size
  const totalCount = companies?.length ?? 0

  const [filter, setFilter] = useState('')

  const filteredCompanies = useMemo(() => {
    if (!companies) return []
    const searchTerm = filter.trim().toLowerCase()
    return companies.filter(
      (company) =>
        (company.name.toLowerCase().includes(searchTerm))
    )
  },
    [companies, filter]
  )

  // Follow and unfollow mutations 
  const follow = useFollowCompany()
  const unfollow = useUnfollowCompany()

  return (
    <div className='flex flex-col gap-6'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Companies</h1>
          {/* isSignedIn gate: signed out, useFollowedCompanies is disabled and a
              disabled query stays `pending` forever, so the count never shows -
              this makes that intent explicit rather than incidental. */}
          {isSignedIn && !isPending && !followedPending && (
            <p className='text-sm text-muted-foreground'>Following {followingCount} of {totalCount} companies</p>
          )}
          {isSignedIn === false && (
            <p className='text-sm text-muted-foreground'>Follow companies to track their job boards.</p>
          )}
        </div>
        {/* Capped width: a full-width search box on a wide screen reads as
            a page-level banner rather than a filter for the grid below. */}
        <div className='relative w-full sm:max-w-xs'>
          <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='search'
            placeholder='Search companies...'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className='pl-8'
          />
        </div>
      </header>

      {isError && <ErrorAlert error={error} title="Couldn't load companies" />}

      {/* Skeletons shaped like the cards, so the grid doesn't jump when the
          real data lands. */}
      {isPending && (
        <div className={GRID}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className='h-[7.5rem] rounded-xl' />
          ))}
        </div>
      )}

      {!isPending && companies && filteredCompanies.length === 0 && (
        <p className='py-12 text-center text-sm text-muted-foreground'>No companies match "{filter}".</p>
      )}

      <div className={GRID}>
        {filteredCompanies.map((company) => {
          const isFollowing = followedIds.has(company.id)
          // A mutation only tracks its latest call, so match that call's
          // argument (`variables`) to tell which card is mid-request.
          // Named so it doesn't shadow the page-level `isPending` above.
          const isTogglePending =
            (follow.isPending && follow.variables === company.id) ||
            (unfollow.isPending && unfollow.variables === company.id)
          // A closure per card: remembers this card's id + follow state, so
          // the card can just call toggleFollow() without knowing either.
          const toggle = () => (isFollowing ? unfollow : follow).mutate(company.id)

          return (
            <CompanyCard
              key={company.id}
              isSignedIn={isSignedIn}
              isPending={isTogglePending}
              company={company}
              isFollowing={isFollowing}
              toggleFollow={toggle}
            />)
          }

        )
      }
      </div>

    </div>
  )
}
