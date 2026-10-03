"""Print a summary of one or more Ashby boards - a quick way to eyeball a
board before adding it to the companies table. No database involved.

The fetching/normalizing itself lives in jobsentinel.ingestion.jobs.ashby_api
(the same adapter the loader uses); this is only the CLI around it.

Usage:
    uv run python scripts/explore_asby.py <board_token> [<board_token> ...]
    uv run python scripts/explore_asby.py ramp --positions "Software Engineer"
"""

import argparse

from jobsentinel.ingestion.jobs.ashby_api import fetch_jobs
from jobsentinel.ingestion.jobs.job_text import summarize_jobs
from jobsentinel.ingestion.jobs.positions import CANONICAL_POSITIONS, filter_by_positions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("board_tokens", nargs="+", help="Ashby board_token(s), e.g. 'ramp'")
    parser.add_argument(
        "--positions",
        nargs="+",
        choices=sorted(CANONICAL_POSITIONS),
        help="Only show jobs matching these canonical positions (title-variance aware)",
    )
    args = parser.parse_args()

    for token in args.board_tokens:
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
