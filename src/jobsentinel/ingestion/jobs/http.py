"""The one HTTP call every ATS adapter makes: GET a public board's JSON.

Shared so the timeout and status handling live in one place instead of
being copy-pasted into greenhouse_api/ashby_api/lever_api.

Errors are deliberately *not* wrapped or swallowed here. requests'
own exceptions (Timeout, ConnectionError, HTTPError) already say what went
wrong, and the caller - load_jobs, later the poller - is the one place that
decides what a failure means (log it, skip that company, keep going).
"""

from typing import Any

import requests

# (connect, read) seconds. Boards return every posting in one response, so
# the read side gets more room - a big Greenhouse board with content=true is
# several MB.
TIMEOUT = (5, 30)


class BoardNotFound(Exception):
    """The ATS has no board for this token - almost always a wrong/stale
    board_token in the companies table, not a transient failure."""


def get_board_json(url: str, params: dict | None = None) -> Any:
    response = requests.get(url, params=params, timeout=TIMEOUT)
    if response.status_code == 404:
        raise BoardNotFound(f"no board at {response.url} - check the board_token")
    # Anything else non-2xx (429, 5xx) raises requests.HTTPError.
    response.raise_for_status()
    return response.json()
