// Fetch Jobs from API

import { useQuery } from "@tanstack/react-query"
import { useApi } from "./useApi"
import { queryKeys } from "./queryKeys"
import { useAuth } from "@clerk/clerk-react"
// Fetch all jobs
export const useJobs = () => {
    const api = useApi()
    return useQuery({
        queryKey: queryKeys.jobs,
        queryFn: () => api('/jobs'),
        staleTime: 5 * 60_000 
    })
}

// Fetch Single job
export const useJob = (jobId) =>{
    const api = useApi()
    return useQuery({
        queryKey: queryKeys.job(jobId),
        queryFn: () => api(`/jobs/${jobId}`),
        staleTime: 5 * 60_000 
    })
}

// Fetch jobs from followed companies 
export const useFeedJobs = () =>{
    const {userId} = useAuth()
    const api = useApi()
    return useQuery({
        queryKey: queryKeys.feedJobs(userId),
        queryFn: () => api(`/jobs/feed`),
        // Same per-user convention as useFollowedCompanies: no userId means
        // no token yet, so the request would just 401.
        enabled: !!userId,
        // Long staleTime is safe because follow/unfollow invalidate this
        // key (see useCompanies.js) - the only thing that changes the feed
        // besides the nightly poll.
        staleTime: 5 * 60_000
    })
}
