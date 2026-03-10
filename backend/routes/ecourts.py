"""
POST /api/ecourts/lookup

Attempts to look up a case on India's eCourts portal (services.ecourts.gov.in).

Inputs (all optional — provide CNR number OR case_number + year):
  cnr_number  : 16-char CNR (Case Number Record) — most reliable
  case_number : Court-assigned case number (e.g. "CRL/2024/001")
  year        : Filing year
  state_code  : State ISO code (e.g. "MH" for Maharashtra)
  court_code  : Court establishment code

Behavior:
  1. CNR lookup is attempted first via the eCourts public portal.
  2. If CAPTCHA is required or portal is unreachable → returns found=False,
     source="unavailable" with a user-facing error message.
  3. Returned fields may be None — the frontend renders blank editable inputs.
  4. Nothing is saved by the backend. Frontend saves only after user confirms.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import httpx
import logging
from datetime import datetime
from database import get_db
from routes.auth import get_current_advocate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ecourts", tags=["ecourts"])

ECOURTS_BASE = "https://services.ecourts.gov.in/ecourtindia_v6/"
REQUEST_TIMEOUT = 12  # seconds

_BROWSER_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
)

HIGH_COURT_CONFIGS = {
    "bombay": {
        "name": "Bombay High Court",
        "base_url": "https://bombayhighcourt.nic.in/",
        "api_url": "https://services.ecourts.gov.in/ecourtindia_v6_hc/",
        "state_code": "MH",
        "court_code": "1",
    },
    "delhi": {
        "name": "Delhi High Court",
        "base_url": "https://delhihighcourt.nic.in/",
        "api_url": "https://services.ecourts.gov.in/ecourtindia_v6_hc/",
        "state_code": "DL",
        "court_code": "2",
    },
    "madras": {
        "name": "Madras High Court",
        "base_url": "https://mhc.tn.gov.in/judis/",
        "api_url": "https://services.ecourts.gov.in/ecourtindia_v6_hc/",
        "state_code": "TN",
        "court_code": "3",
    },
    "calcutta": {
        "name": "Calcutta High Court",
        "base_url": "https://calcuttahighcourt.gov.in/",
        "api_url": "https://services.ecourts.gov.in/ecourtindia_v6_hc/",
        "state_code": "WB",
        "court_code": "4",
    },
    "karnataka": {
        "name": "Karnataka High Court",
        "base_url": "https://karnatakajudiciary.kar.nic.in/",
        "api_url": "https://services.ecourts.gov.in/ecourtindia_v6_hc/",
        "state_code": "KA",
        "court_code": "5",
    },
}


# ── Request / Response models ─────────────────────────────────────────────

class EcourtsLookupRequest(BaseModel):
    cnr_number: Optional[str] = None     # 16-char CNR (preferred)
    case_number: Optional[str] = None    # Court-assigned case number
    year: Optional[int] = None
    state_code: Optional[str] = None
    court_code: Optional[str] = None
    court_type: Optional[str] = "district"  # "district" or "high_court"
    high_court_code: Optional[str] = None   # e.g. "bombay", "delhi", "madras", "calcutta", "karnataka"


class EcourtsResult(BaseModel):
    found: bool
    source: str            # 'ecourts' | 'not_found' | 'unavailable'
    error: Optional[str] = None
    # Case identity
    cnrNumber: Optional[str] = None
    caseNumber: Optional[str] = None
    caseType: Optional[str] = None
    # Dates
    filingDate: Optional[str] = None
    registrationDate: Optional[str] = None
    nextHearingDate: Optional[str] = None
    nextHearingDateTimestamp: Optional[int] = None
    # Court
    courtName: Optional[str] = None
    judgeName: Optional[str] = None
    # Status & parties
    caseStatus: Optional[str] = None
    petitioner: Optional[str] = None
    respondent: Optional[str] = None
    remarks: Optional[str] = None
    # Tells the UI which fields have an "eCourts badge"
    fetchedFields: list = []


# ── Route ─────────────────────────────────────────────────────────────────

@router.post("/lookup")
async def ecourts_lookup(
    body: EcourtsLookupRequest,
    advocate=Depends(get_current_advocate),
):
    """Look up a case on India's eCourts portal.
    Always returns HTTP 200; 'found' and 'source' communicate the outcome.
    """
    if not body.cnr_number and not body.case_number:
        return {
            "success": True,
            "data": EcourtsResult(
                found=False,
                source="not_found",
                error="Please provide a CNR number or case number.",
            ).model_dump(),
        }

    try:
        result = await _fetch_from_ecourts(body)
        return {"success": True, "data": result.model_dump()}
    except Exception as exc:
        logger.exception("eCourts lookup failed: %s", exc)
        return {
            "success": True,
            "data": EcourtsResult(
                found=False,
                source="unavailable",
                error=(
                    "eCourts portal is temporarily unavailable. "
                    "Please enter the hearing details manually below."
                ),
                cnrNumber=body.cnr_number,
            ).model_dump(),
        }


@router.post("/refresh-all")
async def refresh_all_cases(
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    """
    Manually trigger the eCourts case status refresh for the current advocate.

    Checks all active cases whose caseNumber looks like a CNR (14-18 alphanumeric
    chars starting with 2 letters). For each case:
      - Calls eCourts portal; skips gracefully on CAPTCHA / timeout
      - If a new/changed hearing date is found: updates DB + queues push notification
    Returns a detailed summary (useful for testing without waiting for Monday cron).
    """
    from scheduler import refresh_all_for_advocate

    summary = await refresh_all_for_advocate(db, advocate["id"])
    return {"success": True, "summary": summary}


# ── Fetch logic ───────────────────────────────────────────────────────────

async def _fetch_from_ecourts(body: EcourtsLookupRequest) -> EcourtsResult:
    """Attempt to fetch case data from the eCourts portal or High Court portal."""
    cnr = (body.cnr_number or "").strip().upper()

    if body.court_type == "high_court":
        return await _fetch_from_high_court(body, cnr)

    base_headers = {
        "User-Agent": _BROWSER_UA,
        "Accept": "application/json, text/html, */*; q=0.8",
        "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
        "Origin": "https://services.ecourts.gov.in",
        "Referer": ECOURTS_BASE,
        "X-Requested-With": "XMLHttpRequest",
    }

    async with httpx.AsyncClient(
        timeout=REQUEST_TIMEOUT, follow_redirects=True
    ) as client:
        # Warm up session to pick up cookies
        try:
            await client.get(ECOURTS_BASE, headers=base_headers)
        except Exception:
            pass  # Non-fatal

        if cnr:
            return await _try_cnr_lookup(client, base_headers, cnr)

        # Case number + year path (less reliable, needs more params)
        return EcourtsResult(
            found=False,
            source="unavailable",
            error=(
                "For reliable results, please use the 16-character CNR number "
                "printed on your court notice. Case number + year search "
                "requires additional court codes not available without the CNR."
            ),
            caseNumber=body.case_number,
        )


async def _try_cnr_lookup(
    client: httpx.AsyncClient, headers: dict, cnr: str
) -> EcourtsResult:
    """Attempt to retrieve case details by CNR number from eCourts portal."""
    try:
        resp = await client.post(
            ECOURTS_BASE,
            data={
                "cino": cnr,
                "captcha": "",
                "terms": "0",
                "ajax_req": "true",
                "p": "casestatus/viewCinoDetails",
            },
            headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
        )

        # ── Try JSON response first ────────────────────────────────────
        try:
            data = resp.json()
            if data and isinstance(data, dict):
                msg = (data.get("msg") or data.get("message") or "").lower()
                if not msg.startswith("please") and not msg.startswith("invalid"):
                    return _parse_ecourts_json(data, cnr)
        except Exception:
            pass

        # ── Analyse HTML response ──────────────────────────────────────
        html_lower = resp.text.lower()

        if "captcha" in html_lower or "enter the code" in html_lower:
            return EcourtsResult(
                found=False,
                source="unavailable",
                error=(
                    "eCourts portal requires CAPTCHA verification. "
                    "Please enter the hearing details manually below."
                ),
                cnrNumber=cnr,
            )

        if "case not found" in html_lower or "invalid cino" in html_lower or "no record" in html_lower:
            return EcourtsResult(
                found=False,
                source="not_found",
                error=f"No case found for CNR {cnr} on eCourts portal.",
                cnrNumber=cnr,
            )

        # Best-effort HTML parse
        parsed = _try_parse_html(resp.text, cnr)
        if parsed:
            return parsed

        return EcourtsResult(
            found=False,
            source="unavailable",
            error=(
                "eCourts portal returned an unexpected response. "
                "Please enter the hearing details manually below."
            ),
            cnrNumber=cnr,
        )

    except httpx.TimeoutException:
        return EcourtsResult(
            found=False,
            source="unavailable",
            error="eCourts portal timed out. Please enter hearing details manually.",
            cnrNumber=cnr,
        )
    except (httpx.ConnectError, httpx.RemoteProtocolError):
        return EcourtsResult(
            found=False,
            source="unavailable",
            error=(
                "Could not connect to eCourts portal. "
                "Please check your internet connection or enter details manually."
            ),
            cnrNumber=cnr,
        )


# ── Response parsers ──────────────────────────────────────────────────────

def _parse_ecourts_json(data: dict, cnr: str) -> EcourtsResult:
    """Parse a JSON response from the eCourts API."""
    fetched: list = []
    result = EcourtsResult(found=True, source="ecourts", cnrNumber=cnr)

    _map = [
        ("caseType",    ["case_type", "caseType"]),
        ("caseNumber",  ["case_no", "case_number"]),
        ("judgeName",   ["judge_name", "coram", "judge"]),
        ("courtName",   ["court_name", "court"]),
        ("caseStatus",  ["status", "case_status", "caseStatus"]),
        ("petitioner",  ["petitioner", "pet_name", "appellant"]),
        ("respondent",  ["respondent", "res_name", "respondent_name"]),
        ("nextHearingDate", ["next_date", "next_hearing_date", "nextDate"]),
        ("filingDate",  ["filing_date", "filingDate"]),
        ("registrationDate", ["registration_date", "regDate"]),
        ("remarks",     ["remarks", "notes", "purpose"]),
    ]

    for field, keys in _map:
        for k in keys:
            val = data.get(k)
            if val and str(val).strip():
                setattr(result, field, str(val).strip())
                fetched.append(field)
                break

    # Parse date → timestamp
    if result.nextHearingDate:
        ts = _parse_date_to_ts(result.nextHearingDate)
        if ts:
            result.nextHearingDateTimestamp = ts

    result.fetchedFields = list(set(fetched))
    if not fetched:
        result.found = False
        result.source = "not_found"
        result.error = f"No case data found for CNR {cnr}."
    return result


def _try_parse_html(html: str, cnr: str):
    """Best-effort HTML scraping for eCourts case detail pages."""
    try:
        from bs4 import BeautifulSoup  # type: ignore
        soup = BeautifulSoup(html, "html.parser")
        fetched: list = []
        result = EcourtsResult(found=False, source="ecourts", cnrNumber=cnr)

        label_map = {
            "case status": ("caseStatus", False),
            "next date": ("nextHearingDate", True),
            "next hearing": ("nextHearingDate", True),
            "next date of hearing": ("nextHearingDate", True),
            "coram": ("judgeName", False),
            "judge": ("judgeName", False),
            "petitioner": ("petitioner", False),
            "respondent": ("respondent", False),
            "court": ("courtName", False),
            "filing date": ("filingDate", False),
            "registration date": ("registrationDate", False),
            "remarks": ("remarks", False),
            "purpose": ("remarks", False),
        }

        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = [c.get_text(separator=" ", strip=True) for c in row.find_all(["td", "th"])]
                if len(cells) < 2:
                    continue
                label = cells[0].lower().strip()
                value = cells[1].strip() if cells[1].strip() else None
                if not value:
                    continue
                for keyword, (field, is_date) in label_map.items():
                    if keyword in label and field not in fetched:
                        setattr(result, field, value)
                        fetched.append(field)
                        if is_date:
                            ts = _parse_date_to_ts(value)
                            if ts:
                                result.nextHearingDateTimestamp = ts
                        break

        if fetched:
            result.found = True
            result.fetchedFields = fetched
            return result
        return None
    except Exception as exc:
        logger.debug("HTML parse failed: %s", exc)
        return None


async def _fetch_from_high_court(body: EcourtsLookupRequest, cnr: str) -> EcourtsResult:
    """Attempt to fetch case data from a High Court portal via eCourts HC service."""
    hc_code = (body.high_court_code or "").strip().lower()

    if not hc_code or hc_code not in HIGH_COURT_CONFIGS:
        available = ", ".join(HIGH_COURT_CONFIGS.keys())
        return EcourtsResult(
            found=False,
            source="unavailable",
            error=f"Invalid or missing high_court_code. Available: {available}",
            cnrNumber=cnr or None,
        )

    if not cnr and not body.case_number:
        return EcourtsResult(
            found=False,
            source="not_found",
            error="Please provide a CNR number or case number for High Court lookup.",
        )

    hc_config = HIGH_COURT_CONFIGS[hc_code]
    hc_api_url = hc_config["api_url"]

    base_headers = {
        "User-Agent": _BROWSER_UA,
        "Accept": "application/json, text/html, */*; q=0.8",
        "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
        "Origin": "https://services.ecourts.gov.in",
        "Referer": hc_api_url,
        "X-Requested-With": "XMLHttpRequest",
    }

    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT, follow_redirects=True
        ) as client:
            try:
                await client.get(hc_api_url, headers=base_headers)
            except Exception:
                pass

            if cnr:
                post_data = {
                    "cino": cnr,
                    "captcha": "",
                    "terms": "0",
                    "ajax_req": "true",
                    "p": "casestatus/viewCinoDetails",
                    "court_code": hc_config["court_code"],
                    "state_code": hc_config["state_code"],
                }
            else:
                post_data = {
                    "case_no": body.case_number,
                    "rgyear": str(body.year) if body.year else "",
                    "captcha": "",
                    "terms": "0",
                    "ajax_req": "true",
                    "p": "casestatus/viewCaseDetails",
                    "court_code": hc_config["court_code"],
                    "state_code": hc_config["state_code"],
                }

            resp = await client.post(
                hc_api_url,
                data=post_data,
                headers={**base_headers, "Content-Type": "application/x-www-form-urlencoded"},
            )

            try:
                data = resp.json()
                if data and isinstance(data, dict):
                    msg = (data.get("msg") or data.get("message") or "").lower()
                    if not msg.startswith("please") and not msg.startswith("invalid"):
                        result = _parse_ecourts_json(data, cnr or body.case_number or "")
                        if result.found:
                            result.courtName = result.courtName or hc_config["name"]
                        return result
            except Exception:
                pass

            html_lower = resp.text.lower()

            if "captcha" in html_lower or "enter the code" in html_lower:
                return EcourtsResult(
                    found=False,
                    source="unavailable",
                    error=(
                        f"{hc_config['name']} portal requires CAPTCHA verification. "
                        "Please enter the hearing details manually below."
                    ),
                    cnrNumber=cnr or None,
                )

            if "case not found" in html_lower or "invalid cino" in html_lower or "no record" in html_lower:
                return EcourtsResult(
                    found=False,
                    source="not_found",
                    error=f"No case found on {hc_config['name']} portal.",
                    cnrNumber=cnr or None,
                )

            parsed = _try_parse_html(resp.text, cnr or body.case_number or "")
            if parsed:
                parsed.courtName = parsed.courtName or hc_config["name"]
                return parsed

            return EcourtsResult(
                found=False,
                source="unavailable",
                error=(
                    f"{hc_config['name']} portal returned an unexpected response. "
                    "Please enter the hearing details manually below."
                ),
                cnrNumber=cnr or None,
            )

    except (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError):
        return EcourtsResult(
            found=False,
            source="unavailable",
            error=(
                f"{hc_config['name']} portal is temporarily unavailable. "
                "Please enter the hearing details manually below."
            ),
            cnrNumber=cnr or None,
        )
    except Exception as exc:
        logger.exception("High Court lookup failed for %s: %s", hc_code, exc)
        return EcourtsResult(
            found=False,
            source="unavailable",
            error=(
                f"{hc_config['name']} portal is temporarily unavailable. "
                "Please enter the hearing details manually below."
            ),
            cnrNumber=cnr or None,
        )


def _parse_date_to_ts(date_str: str) -> Optional[int]:
    """Parse common Indian court date formats → Unix timestamp (ms, midnight)."""
    if not date_str:
        return None
    date_str = date_str.strip().split(" ")[0]  # strip time part if any
    for fmt in [
        "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d",
        "%d %b %Y", "%d-%b-%Y", "%d %B %Y", "%d.%m.%Y",
    ]:
        try:
            dt = datetime.strptime(date_str, fmt).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    return None
