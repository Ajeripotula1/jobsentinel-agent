import { useCompanies, useFollowCompany, useFollowedCompanies, useUnfollowCompany } from '@/hooks/useCompanies'
import ErrorAlert from '@/components/ErrorAlert'
import { CompanyCard } from '@/components/company/CompanyCard'
import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { useAuth } from '@clerk/clerk-react'

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
    <div>
      <header>
        <div className='flex gap-2 items-center'>
        <h1 className="text-2xl font-semibold"> Companies</h1>
        {/* isSignedIn gate: signed out, useFollowedCompanies is disabled and a
            disabled query stays `pending` forever, so the count never shows -
            this makes that intent explicit rather than incidental. */}
        {isSignedIn && !isPending && !followedPending && (
          <p className='text-sm'>Following {followingCount} of {totalCount} companies</p>
          )
        }
      </div>
      <Input
        type="text"
        placeholder="Search companies..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      </header>
      


      {isError && <ErrorAlert error={error} title="Couldn't load companies" />}

      {isPending && <div>Loading....</div>}


      {!isPending && companies && filteredCompanies.length === 0 && (
        <p className='text-sm text-muted-foreground'>No companies match "{filter}".</p>
      )}

      {/* 1 column on phones, up to 3 on wide screens - a fixed grid-cols-3
          squeezes cards unreadably narrow on mobile. */}
      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
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
