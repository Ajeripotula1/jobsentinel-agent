
// TanStack Query (cache) keys

export const queryKeys = {
    jobs: ['jobs'], // all jobs
    companies: ['companies'], // all loaded companies (filter options)
    job: (id) => ['job', id], // key specific job
    profile: ['profile'], // only show user their own (singular profile)
    score: (id) => ['score', id], // score against SPECIFIC job id
    agent: (id) => ['agent', id], // scope agent interactions to specific job id
    followedCompanies: (id) => ['follow', 'companies', id] // scope followed companies to specific user

}