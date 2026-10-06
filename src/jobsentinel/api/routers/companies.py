"""
/companies endpoints.

- GET /companies - BUILD_PLAN.md Slice 8: every company whose board is
  loaded. Public, like GET /jobs: companies are shared data, not per-user.
- GET /companies/following, PUT/DELETE /companies/{id}/follow - Slice 9:
  the signed-in user's followed companies. These require sign-in, and the
  user is ALWAYS the one from the verified Clerk token
  (get_current_user_id), never a user_id in the path/body - otherwise any
  caller could follow/unfollow on anyone's behalf.

Follow/unfollow are modeled as PUT/DELETE on a "follow" sub-resource rather
than POST actions because both are idempotent - doing them twice leaves the
same state as doing them once, which is exactly what PUT and DELETE promise
(POST makes no such promise). The db layer already makes them idempotent
(ON CONFLICT DO NOTHING / a DELETE matching zero rows), so the HTTP verbs
just tell clients - and retrying proxies - that retrying is safe.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from jobsentinel.api.auth import get_current_user_id
from jobsentinel.db.companies import list_companies
from jobsentinel.db.engine import get_engine
from jobsentinel.db.user_companies import (
    follow_company,
    list_followed_companies,
    unfollow_company,
)

router = APIRouter(prefix="/companies", tags=["companies"])


class CompanySummary(BaseModel):
    id: int
    name: str
    source: str
    board_token: str


class FollowedCompany(CompanySummary):
    # When this user followed it - not when the company row was seeded.
    followed_at: datetime


@router.get("", response_model=list[CompanySummary])
def list_all_companies() -> list[CompanySummary]:
    """Every company in the companies table, ordered by id."""
    return [CompanySummary(**company) for company in list_companies(get_engine())]


@router.get("/following", response_model=list[FollowedCompany])
def list_following(
    current_user_id: str = Depends(get_current_user_id),
) -> list[FollowedCompany]:
    """The companies the signed-in user follows, ordered by name.

    An empty list (not a 404) when they follow nothing - "no follows yet"
    is a normal state, not a missing resource.
    """
    return [
        FollowedCompany(**company)
        for company in list_followed_companies(get_engine(), current_user_id)
    ]


@router.put("/{company_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow(
    company_id: int,
    current_user_id: str = Depends(get_current_user_id),
) -> Response:
    """Follow a company. 204 whether this created the follow or the user
    already followed it - the end state is identical, so the client doesn't
    need to care which (follow_company's bool is ignored on purpose).

    404 if the company doesn't exist. Detected by catching the FK violation
    rather than a SELECT-first existence check: one round-trip instead of
    two, and no gap between "checked it exists" and "inserted". It's safe
    to read any IntegrityError here as "bad company_id" because ON CONFLICT
    DO NOTHING already absorbs the only other constraint (the PK).
    """
    try:
        follow_company(get_engine(), current_user_id, company_id)
    except IntegrityError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=f"no company with id {company_id}"
        )
    # 204 means "no body" - return an empty Response explicitly so FastAPI
    # doesn't try to serialize the function's return value into one.
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{company_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow(
    company_id: int,
    current_user_id: str = Depends(get_current_user_id),
) -> Response:
    """Unfollow a company. 204 even if the user wasn't following it (or the
    company doesn't exist) - DELETE is idempotent, and "you don't follow
    this" is already the state the client asked for, so it isn't an error.
    """
    unfollow_company(get_engine(), current_user_id, company_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
