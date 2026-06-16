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


# Per-kind hero treatment for the email banner + CTA.
_KIND_STYLE: dict[str, dict] = {
    "approved": {"hero_bg": "#15803D", "hero_fg": "#ffffff", "accent": "#16A34A",
                 "eyebrow": "Approved &amp; Published", "title": "You're live on the Defence Layer",
                 "sub": "Your product passed review and is now visible to enterprise security buyers.",
                 "cta": "View on the marketplace", "cta_path": "/marketplace"},
    "needs_info": {"hero_bg": "#F5B800", "hero_fg": "#1C1B19", "accent": "#F5B800",
                   "eyebrow": "Action Needed", "title": "We need a little more",
                   "sub": "One quick step before we can publish your listing.",
                   "cta": "Resume your submission", "cta_path": "/onboarding"},
    "rejected": {"hero_bg": "#1C1B19", "hero_fg": "#ffffff", "accent": "#DC2626",
                 "eyebrow": "Submission Update", "title": "An update on your review",
                 "sub": "Your submission wasn't approved this time — here's what happened.",
                 "cta": None, "cta_path": None},
    "received": {"hero_bg": "#1C1B19", "hero_fg": "#ffffff", "accent": "#F5B800",
                 "eyebrow": "Submission Received", "title": "Thanks — you're in the queue",
                 "sub": "Our team is reviewing your product now.",
                 "cta": "View the marketplace", "cta_path": "/marketplace"},
}

_PROMO = (
    "Attacked.ai is the Defence Layer — the marketplace where enterprise security teams discover "
    "and compare vendors on verified evidence, not marketing claims. Every product is mapped to the "
    "GUARD risk framework and given a transparent Defence Rating, so buyers see exactly what you "
    "protect against and how strong the proof behind it is. Your listing now sits in front of "
    "decision-makers at the moment they're evaluating their defences."
)
_PROMO_POINTS = [
    "Verified, evidence-based Defence Ratings — trust you can prove",
    "Mapped to 13 GUARD risk categories buyers actually search",
    "Seen by enterprise security teams at the moment of decision",
]


def _html_email(body: str, kind: str = "", ctx: dict | None = None) -> str:
    """Render a premium, status-aware branded HTML email (table layout, inline
    styles, no external images — reliable across email clients)."""
    ctx = ctx or {}
    s = _KIND_STYLE.get(kind, _KIND_STYLE["received"])
    base = (settings.APP_BASE_URL or "").rstrip("/")

    paras = "".join(
        f'<p style="margin:0 0 16px;">{_html.escape(p).strip().replace(chr(10), "<br>")}</p>'
        for p in (body or "").split("\n\n") if p.strip()
    )

    rows_data = [("Product", ctx.get("product")),
                 ("Vendor", ctx.get("vendor") or ctx.get("company")),
                 ("Category", ctx.get("category"))]
    if ctx.get("rating") not in (None, ""):
        rows_data.append(("Defence Rating", f'{ctx.get("rating")} / 100 · {ctx.get("band") or ""}'))
    rows = "".join(
        f'<tr><td style="padding:7px 0;color:#8B8576;font-size:12px;width:130px;text-transform:uppercase;letter-spacing:.5px;">{_html.escape(k)}</td>'
        f'<td style="padding:7px 0;color:#1C1B19;font-size:14px;font-weight:600;">{_html.escape(str(v))}</td></tr>'
        for k, v in rows_data if v
    )
    summary = (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#FAF8F3;border:1px solid #EEE9DF;border-radius:12px;padding:6px 18px;">{rows}</table>'
    ) if rows else ""

    points = "".join(
        f'<tr><td valign="top" style="padding:4px 10px 4px 0;color:#F5B800;font-size:15px;">&#10003;</td>'
        f'<td style="padding:4px 0;color:#2A2620;font-size:14px;line-height:1.5;">{_html.escape(p)}</td></tr>'
        for p in _PROMO_POINTS
    )

    cta = ""
    if s.get("cta") and base:
        cta = (
            f'<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
            f'<td style="border-radius:10px;background:#F5B800;"><a href="{base}{s["cta_path"]}" '
            f'style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#1C1B19;'
            f'text-decoration:none;border-radius:10px;">{s["cta"]} &rarr;</a></td></tr></table>'
        )

    return f"""\
<body style="margin:0;padding:0;background:#F1EEE7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EEE7;">
    <tr><td align="center" style="padding:30px 14px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #E6E1D6;border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="background:#1C1B19;padding:22px 34px;">
          <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-.4px;">Attacked<span style="color:#F5B800;">.ai</span></span>
          <span style="color:#8B8576;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-left:9px;">The Defence Layer</span>
        </td></tr>
        <tr><td style="background:{s["hero_bg"]};padding:36px 34px;text-align:center;">
          <div style="color:{s["hero_fg"]};opacity:.85;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">{s["eyebrow"]}</div>
          <div style="color:{s["hero_fg"]};font-size:26px;font-weight:800;margin-top:10px;line-height:1.25;">{s["title"]}</div>
          <div style="color:{s["hero_fg"]};opacity:.92;font-size:14px;margin-top:8px;">{s["sub"]}</div>
        </td></tr>
        <tr><td style="padding:32px 34px 6px;color:#2A2620;font-size:15.5px;line-height:1.65;">{paras}</td></tr>
        <tr><td style="padding:6px 34px 2px;">{summary}</td></tr>
        <tr><td style="padding:18px 34px 4px;text-align:center;">{cta}</td></tr>
        <tr><td style="padding:18px 34px 0;"><div style="border-top:1px solid #EEE9DF;"></div></td></tr>
        <tr><td style="padding:22px 34px 30px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#C99A00;">Why vendors choose us</div>
          <div style="font-size:17px;font-weight:700;color:#1C1B19;margin-top:6px;">The Defence Layer advantage</div>
          <p style="margin:12px 0 14px;color:#5C564C;font-size:14px;line-height:1.65;">{_html.escape(_PROMO)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0">{points}</table>
        </td></tr>
        <tr><td style="background:#FAF8F3;border-top:1px solid #E6E1D6;padding:22px 34px;text-align:center;">
          <p style="margin:0;color:#1C1B19;font-size:13px;font-weight:700;">Attacked.ai &middot; The Defence Layer</p>
          <p style="margin:7px 0 0;color:#A89F8C;font-size:11px;line-height:1.5;">You're receiving this about your product listing on the Attacked.ai marketplace.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>"""


def _templates(kind: str, ctx: dict) -> tuple[str, str]:
    """Return (subject, body) for a notification kind."""
    company = ctx.get("company") or "there"
    product = ctx.get("product") or "your product"
    note = (ctx.get("note") or "").strip()

    if kind == "approved":
        subject = f"You're live — {product} is now on Attacked.ai"
        body = (
            f"Hi {company},\n\n"
            f"Congratulations — after review, “{product}” has been approved and is now "
            "published on the Attacked.ai Defence Layer marketplace, in front of the enterprise "
            "security teams who use Attacked.ai to find and compare vendors on verified evidence."
        )
        if note:
            body += f"\n\nA note from our review team:\n{note}"
        body += "\n\nThank you for the detailed submission — the strength of your evidence made this an easy decision."
    elif kind == "rejected":
        subject = f"An update on your submission — {product}"
        body = (
            f"Hi {company},\n\n"
            f"Thank you for submitting “{product}” to the Attacked.ai Defence Layer. After "
            "careful review, we're not able to approve this listing at this time.\n\n"
            f"Reason:\n{note or 'No reason provided.'}\n\n"
            "You're welcome to address the above and resubmit whenever you're ready — we'd be glad to take another look."
        )
    elif kind == "needs_info":
        subject = f"A quick request about {product}"
        body = (
            f"Hi {company},\n\n"
            f"Thanks for submitting “{product}”. Before we can publish it, our review team needs "
            "a little more from you:\n\n"
            f"{note or 'Please provide additional details.'}\n\n"
            "Once you've added it, we'll review again right away."
        )
    else:
        subject = f"We received your submission — {product}"
        body = (
            f"Hi {company},\n\n"
            f"Thanks for submitting “{product}” to the Attacked.ai Defence Layer. It's now in our "
            "review queue — we verify product details and evidence before publishing, and we'll email you "
            "the moment a decision is made."
        )
    return subject, body


def _deliver(to_email: str, subject: str, body: str, kind: str = "", ctx: dict | None = None) -> None:
    """Send via SMTP. From = SMTP_FROM (e.g. dhghosh22@gmail.com); To = the
    recipient the admin entered. Raises on failure."""
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)                          # plain-text fallback
    msg.add_alternative(_html_email(body, kind, ctx), subtype="html")  # branded HTML
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
            _deliver(to_email, subject, body, kind, ctx)
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
