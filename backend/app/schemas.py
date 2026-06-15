"""Pydantic request models for the vendor portal (onboarding enhancement)."""
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

# Allowed enumerations (single source of truth).
# Evidence taxonomy = value proof for a PRODUCT (certifications are vendor-level
# and collected in Company Information, so they are intentionally excluded here).
EVIDENCE_TYPES = (
    # Links
    "article",
    "news",
    "blog",
    "research_report",
    "customer_success",
    "case_study",
    # Customer validation
    "customer_review",
    "testimonial",
    "reference_customer",
    # Supporting documents
    "supporting_document",
)
SOURCE_TYPES = ("upload", "link", "text")
TRUST_TIERS = ("A", "B", "C", "D")


def _in(value: Optional[str], allowed: tuple, field: str) -> Optional[str]:
    if value is None:
        return value
    if value not in allowed:
        raise ValueError(f"{field} must be one of {allowed}")
    return value


class VerifyRequest(BaseModel):
    """Strict verification — at least one identifier required."""
    vendor_id: Optional[int] = None
    company_name: Optional[str] = None


class ProductCreate(BaseModel):
    # Vendor must already exist — identified by id or exact company name.
    vendor_id: Optional[int] = None
    company_name: Optional[str] = None
    product_name: str = Field(min_length=1)
    product_description: Optional[str] = None
    logo_url: Optional[str] = None
    product_images: list[str] = []
    product_videos: list[str] = []
    optional_metadata: dict[str, Any] = {}
    work_email: Optional[str] = None  # for review-status notifications


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    product_description: Optional[str] = None
    logo_url: Optional[str] = None
    product_images: Optional[list[str]] = None
    product_videos: Optional[list[str]] = None
    optional_metadata: Optional[dict[str, Any]] = None


class VendorProfileUpdate(BaseModel):
    hq: Optional[str] = None
    website: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    entity_type: Optional[str] = None
    status: Optional[str] = None


class EvidenceCreate(BaseModel):
    type: str
    title: str = Field(min_length=1)
    description: Optional[str] = None
    file_url: Optional[str] = None
    source_type: str = "text"
    issuer: Optional[str] = None
    issued_date: Optional[str] = None  # ISO date string, e.g. 2025-01-31
    trust_tier: str = "D"

    @field_validator("type")
    @classmethod
    def _type(cls, v):
        return _in(v, EVIDENCE_TYPES, "type")

    @field_validator("source_type")
    @classmethod
    def _src(cls, v):
        return _in(v, SOURCE_TYPES, "source_type")

    @field_validator("trust_tier")
    @classmethod
    def _tier(cls, v):
        return _in(v, TRUST_TIERS, "trust_tier")


class EvidenceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    file_url: Optional[str] = None
    source_type: Optional[str] = None
    issuer: Optional[str] = None
    issued_date: Optional[str] = None
    trust_tier: Optional[str] = None

    @field_validator("source_type")
    @classmethod
    def _src(cls, v):
        return _in(v, SOURCE_TYPES, "source_type")

    @field_validator("trust_tier")
    @classmethod
    def _tier(cls, v):
        return _in(v, TRUST_TIERS, "trust_tier")


class EvidenceVerify(BaseModel):
    verified_by: Optional[str] = None


class ScoreBreakdownItem(BaseModel):
    category: str
    score: float = 0
    evidence_ids: list[str] = []


class TraceabilityItem(BaseModel):
    evidence_id: str
    impact: float = 0


class DefenseRatingUpsert(BaseModel):
    defense_rating: int = 0
    score_breakdown: list[ScoreBreakdownItem] = []
    evidence_traceability: list[TraceabilityItem] = []
    snapshot: bool = True  # also append to history


class DefenseRatingPreview(BaseModel):
    """Inline (un-persisted) rating computation for the onboarding Defence Rating
    step — products are not created until submit, so we score from the live draft."""
    product: dict[str, Any] = {}
    vendor: dict[str, Any] = {}
    evidence: list[dict[str, Any]] = []
    guard_mapping: dict[str, Any] = {}


class QAItem(BaseModel):
    question: str
    answer: str = ""


class GuardMapStep(BaseModel):
    """One turn of the conversational GUARD-mapping loop (stateless)."""
    product: dict[str, Any] = {}
    vendor: dict[str, Any] = {}
    answers: list[QAItem] = []
