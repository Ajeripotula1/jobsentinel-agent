"""Pure normalization helpers - no network, no DB."""

from datetime import datetime, timezone

import pytest

from jobsentinel.ingestion.jobs.job_text import normalize_workplace_type, normalized_job


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Remote", "remote"),
        ("OnSite", "onsite"),
        ("On-Site", "onsite"),
        ("hybrid", "hybrid"),
        ("unspecified", None),
        ("", None),
        (None, None),
    ],
)
def test_normalize_workplace_type(raw, expected):
    assert normalize_workplace_type(raw) == expected


def test_normalized_job_strips_title_and_blank_location():
    job = normalized_job(
        ats_job_id=123,
        source="ashby",
        board_token="ramp",
        title=" Security Engineer, Cloud ",
        description="text",
        url=None,
        posted_at=datetime(2026, 4, 7, tzinfo=timezone.utc),
        location="   ",
        workplace_type="Hybrid",
        raw={},
    )
    assert job["ats_job_id"] == "123"
    assert job["title"] == "Security Engineer, Cloud"
    assert job["location"] is None
    assert job["workplace_type"] == "hybrid"
