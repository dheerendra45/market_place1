"""
Vendor notification emails for the admin review workflow.

Every notification is RECORDED in admin_notifications regardless of whether a
mail server is configured — so the dashboard always shows what was (or would be)
sent. If SMTP_HOST is set, the email is actually delivered; otherwise it is
stored as 'queued'. Mirrors the codebase's graceful-fallback pattern.
"""
from __future__ import annotations

import html as _html
import smtplib
from email.message import EmailMessage

from .config import settings
from .database import execute

BRAND = "Attacked.ai — The Defence Layer"


def _html_email(body: str) -> str:
    """Wrap the plain-text body in a branded HTML email (gold header, white card)."""
    paras = "".join(
        f'<p style="margin:0 0 14px;">{_html.escape(p).strip().replace(chr(10), "<br>")}</p>'
        for p in body.split("\n\n") if p.strip()
    )
    return f"""\
<div style="background:#F6F4EF;padding:28px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;border-radius:14px;overflow:hidden;border:1px solid #E6E1D6;">
    <div style="background:#1C1B19;padding:20px 26px;">
      <span style="color:#fff;font-size:21px;font-weight:700;letter-spacing:-.3px;">Attacked<span style="color:#F5B800;">.ai</span></span>
      <span style="color:#8B8576;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;margin-left:10px;">The Defence Layer</span>
    </div>
    <div style="background:#fff;padding:30px 26px;color:#1C1B19;font-size:15px;line-height:1.6;">
      {paras}
    </div>
    <div style="background:#fff;border-top:1px solid #E6E1D6;padding:16px 26px;color:#8B8576;font-size:11px;text-align:center;">
      &copy; Attacked.ai &middot; The Defence Layer
    </div>
  </div>
</div>"""


def _templates(kind: str, ctx: dict) -> tuple[str, str]:
    """Return (subject, body) for a notification kind."""
    company = ctx.get("company") or "there"
    product = ctx.get("product") or "your product"
    note = (ctx.get("note") or "").strip()
    url = settings.APP_BASE_URL.rstrip("/")

    if kind == "received":
        subject = f"We received your submission — {product}"
        body = (
            f"Hi {company},\n\n"
            f"Thanks for submitting “{product}” to the {BRAND}.\n\n"
            "Your submission is now PENDING review by our team. We verify product "
            "details and evidence before publishing to the marketplace. You'll get "
            "an email as soon as a decision is made.\n\n"
            "— The Attacked.ai Defence Layer team"
        )
    elif kind == "approved":
        subject = f"Approved & published — {product}"
        body = (
            f"Hi {company},\n\n"
            f"Good news — “{product}” has been APPROVED and is now live on "
            f"the {BRAND} marketplace.\n\n"
            f"View it here: {url}/marketplace\n\n"
            + (f"Reviewer note:\n{note}\n\n" if note else "")
            + "— The Attacked.ai Defence Layer team"
        )
    elif kind == "rejected":
        subject = f"Submission not approved — {product}"
        body = (
            f"Hi {company},\n\n"
            f"After review, “{product}” was NOT approved for the marketplace "
            "at this time.\n\n"
            f"Reason:\n{note or 'No reason provided.'}\n\n"
            "You're welcome to address the above and resubmit through onboarding.\n\n"
            "— The Attacked.ai Defence Layer team"
        )
    elif kind == "needs_info":
        subject = f"Action needed — more information for {product}"
        body = (
            f"Hi {company},\n\n"
            f"Before we can publish “{product}”, our reviewers need some "
            "additional information:\n\n"
            f"{note or 'Please provide additional details.'}\n\n"
            f"Resume your submission here: {url}/onboarding\n\n"
            "— The Attacked.ai Defence Layer team"
        )
    else:
        subject = f"Update on your submission — {product}"
        body = f"Hi {company},\n\n{note}\n\n— The Attacked.ai Defence Layer team"
    return subject, body


def _deliver(to_email: str, subject: str, body: str) -> None:
    """Send via SMTP. Raises on failure."""
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)                          # plain-text fallback
    msg.add_alternative(_html_email(body), subtype="html")  # branded HTML
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as s:
        if settings.SMTP_TLS:
            s.starttls()
        if settings.SMTP_USER:
            s.login(settings.SMTP_USER, settings.SMTP_PASS)
        s.send_message(msg)


def build_email(kind: str, ctx: dict) -> tuple[str, str]:
    """Public template builder — used by the admin email-preview endpoint."""
    return _templates(kind, ctx)


def notify(kind: str, *, to_email: str | None, ctx: dict,
           product_id: int | None = None, vendor_id: int | None = None,
           subject: str | None = None, body: str | None = None) -> dict:
    """Build, (try to) send, and ALWAYS record a vendor notification.

    If subject/body are supplied (admin edited the template), they override the
    generated template."""
    g_subject, g_body = _templates(kind, ctx)
    subject = subject or g_subject
    body = body or g_body
    status, error = "queued", None
    if to_email and settings.SMTP_HOST:
        try:
            _deliver(to_email, subject, body)
            status = "sent"
        except Exception as exc:  # noqa: BLE001 — record the failure, never crash
            status, error = "failed", str(exc)[:300]
    elif not to_email:
        status, error = "failed", "no recipient email on submission"

    row = execute(
        "INSERT INTO admin_notifications "
        "(product_id, vendor_id, to_email, kind, subject, body, status, error) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
        (product_id, vendor_id, to_email, kind, subject, body, status, error),
    )
    return row
