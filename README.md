# JobSentinel

**An agentic job tracker that monitors the companies you care about and helps you build applications grounded in your real experience.**

Follow the companies you want to work for. JobSentinel checks their job boards daily and surfaces new postings that match the roles you're targeting. For any job, an AI agent scores your fit, then **interviews you** to close the gaps and drafts a tailored resume and cover letter from only what you've told it.

Most AI resume tools take a posting and generate generic resumes and cover letters, often inventing experience you don't have. JobSentinel **works with you** to create personalized, accurate ones.

## What it does

- **Tracks companies you want to work for.** Pick companies from a curated list or add your own; JobSentinel finds their job board on Greenhouse, Ashby or Lever automatically.
- **Surfaces what's new and relevant.** Boards are polled daily. Your feed shows only postings at companies you follow, for the roles and locations you want, with new ones flagged and closed ones removed.
- **Reads your resume.** Upload a PDF and it extracts your experience, education, projects and skills into a structured profile.
- **Scores your fit.** An AI agent rates how well you match a posting, lists your strengths with evidence from your resume, and flags each gap as missing, contradicting, or unclear in the posting.
- **Works with you on the application.** A chat agent for each job answers questions about your fit, interviews you to fill the gaps, and drafts a tailored resume and cover letter grounded only in your answers. It remembers each job's conversation, so you can pick up where you left off.
- **Keeps your data yours.** Profiles, follows, scores and conversations are private to each user.

## How it works

```
React (S3 + CloudFront) ──> FastAPI on Lambda ──> AI agents on AgentCore Runtime
                                    │              (Strands + Amazon Bedrock)
                                    │                        │
                                    └──> Postgres + pgvector <┘

EventBridge Scheduler ──> Poller Lambda ──> Greenhouse / Ashby / Lever APIs ──> Postgres
```

- **Three serverless units.** The API, the AI agents and the daily job poller deploy and scale independently.
- **Real agents, not single prompts.** The Score Fit agent and the Job Agent choose which tools to call (job details, your profile, the stored fit assessment) and ground every claim in what those tools return.
- **Grounded in the fit score.** The Job Agent unlocks once a job is scored, and grounds the conversation in concrete facts from the posting and your fit assessment.
- **Evaluated, not just eyeballed.** An evaluation harness runs the agents over real postings and checks their tool calls and outcomes, with manual review for invented facts.

## Progress

**Built:** resume upload and extraction, the Score Fit agent, the Job Agent with per-job conversation memory, the evaluation harness, Clerk sign-in with per-user data, and the full web UI. The complete scoring and application flow works end to end in the browser.

**Next:**
1. Multi-company ingestion across Greenhouse, Ashby and Lever
2. Following companies and a personalized feed
3. Daily polling with new and closed posting detection
4. Adding any company, with automatic job-board discovery
5. Per-user AI budgets, then deployment to AWS

## Tech stack

**AI:** Amazon Bedrock (Claude Haiku 4.5) · Strands Agents SDK · AgentCore Runtime · AgentCore Memory

**Backend:** Python · FastAPI · SQLAlchemy · Alembic · PostgreSQL + pgvector · Pydantic · pytest

**Frontend:** React 19 · Vite · TanStack Query · React Router · Tailwind CSS · shadcn/ui

**Infrastructure:** AWS Lambda + Mangum · EventBridge Scheduler · S3 + CloudFront · Supabase · SSM Parameter Store

**Auth:** Clerk
