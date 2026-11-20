"""Loads the curated UAE organization registry (organizations.yaml)."""

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel

REGISTRY_FILE = Path(__file__).with_name("organizations.yaml")


class Verification(BaseModel):
    status: Literal["verified", "unverified"]
    source_name: str | None = None
    source_url: str | None = None
    checked: date | None = None
    note: str | None = None


class Organization(BaseModel):
    id: str
    name: str
    aliases: list[str]
    category: str
    domains: list[str]
    verification: Verification

    @property
    def is_verified(self) -> bool:
        v = self.verification
        return v.status == "verified" and bool(v.source_url) and v.checked is not None


@lru_cache
def load_registry() -> tuple[Organization, ...]:
    data = yaml.safe_load(REGISTRY_FILE.read_text(encoding="utf-8"))
    orgs = tuple(Organization(**o) for o in data["organizations"])
    ids = [o.id for o in orgs]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate organization id in registry")
    return orgs
