"""
PostgreSQL access layer — a lazily-initialised psycopg connection pool.
Replaces the former Supabase client. All queries return dict rows.
"""
from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Return the shared connection pool, creating it on first use."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=settings.DATABASE_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


def wait_for_db(retries: int = 30, delay: float = 2.0) -> None:
    """Block until the database accepts a trivial query (used on startup)."""
    last_err: Exception | None = None
    for _ in range(retries):
        try:
            with get_pool().connection() as conn:
                conn.execute("SELECT 1")
            return
        except Exception as exc:  # noqa: BLE001 — startup probe
            last_err = exc
            time.sleep(delay)
    raise RuntimeError(f"Database not reachable: {last_err}")


@contextmanager
def cursor() -> Iterator[psycopg.Cursor]:
    """Yield a dict-row cursor inside a pooled connection (auto-commits)."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            yield cur


def query(sql: str, params: tuple | dict | None = None) -> list[dict[str, Any]]:
    """Run a SELECT and return all rows as dicts."""
    with cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def query_one(sql: str, params: tuple | dict | None = None) -> dict[str, Any] | None:
    with cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def execute(sql: str, params: tuple | dict | None = None) -> dict[str, Any] | None:
    """Run an INSERT/UPDATE/DELETE; returns the first row if RETURNING is used."""
    with cursor() as cur:
        cur.execute(sql, params)
        if cur.description:
            return cur.fetchone()
        return None
