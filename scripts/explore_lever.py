"""Print a summary of one or more Lever boards - a quick way to eyeball a
board before adding it to the companies table. No database involved.

The fetching/normalizing itself lives in jobsentinel.ingestion.jobs.lever_api
(the same adapter the loader uses); this is only the CLI around it.

Usage:
    uv run python scripts/explore_lever.py <company> [<company> ...]
    uv run python scripts/explore_lever.py spotify --positions "Software Engineer"
"""

import argparse

from jobsentinel.ingestion.jobs.lever_api import fetch_jobs
from jobsentinel.ingestion.jobs.job_text import summarize_jobs
from jobsentinel.ingestion.jobs.positions import CANONICAL_POSITIONS, filter_by_positions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("companys", nargs="+", help="Lever company(s), e.g. 'spotify'")
    parser.add_argument(
        "--positions",
        nargs="+",
        choices=sorted(CANONICAL_POSITIONS),
        help="Only show jobs matching these canonical positions (title-variance aware)",
    )
    args = parser.parse_args()

    for token in args.companys:
        try:
            jobs = fetch_jobs(token)
        except Exception as exc:
            print(f"skipping '{token}': {exc}")
            continue

        if args.positions:
            jobs = filter_by_positions(jobs, args.positions)
        summarize_jobs(token, jobs, filtered=bool(args.positions))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
