import random
import re
import time
from urllib.parse import urlencode, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

JOB_TYPE_CODES = {
    "full-time": "F",
    "part-time": "P",
    "contract": "C",
    "temporary": "T",
    "volunteer": "V",
    "internship": "I",
    "other": "O",
}

EXPERIENCE_CODES = {
    "internship": "1",
    "entry": "2",
    "associate": "3",
    "mid-senior": "4",
    "director": "5",
    "executive": "6",
}

WORKPLACE_CODES = {
    "on-site": "1",
    "remote": "2",
    "hybrid": "3",
}

DATE_POSTED_CODES = {
    "past-24h": "r86400",
    "past-week": "r604800",
    "past-month": "r2592000",
}

COMMON_LINKEDIN_LOCATIONS = {
    "new york": ("New York, New York, United States", "102571732"),
    "new york city": ("New York, New York, United States", "102571732"),
    "nyc": ("New York, New York, United States", "102571732"),
    "new york, ny": ("New York, New York, United States", "102571732"),
    "san jose": ("San Jose, California, United States", "106233382"),
    "san jose, ca": ("San Jose, California, United States", "106233382"),
    "california": ("California, United States", "102095887"),
    "remote": ("United States", "103644278"),
    "united states": ("United States", "103644278"),
}

STATE_ALIASES = {
    "alabama": "al", "alaska": "ak", "arizona": "az", "arkansas": "ar", "california": "ca",
    "colorado": "co", "connecticut": "ct", "delaware": "de", "florida": "fl", "georgia": "ga",
    "hawaii": "hi", "idaho": "id", "illinois": "il", "indiana": "in", "iowa": "ia",
    "kansas": "ks", "kentucky": "ky", "louisiana": "la", "maine": "me", "maryland": "md",
    "massachusetts": "ma", "michigan": "mi", "minnesota": "mn", "mississippi": "ms",
    "missouri": "mo", "montana": "mt", "nebraska": "ne", "nevada": "nv", "new hampshire": "nh",
    "new jersey": "nj", "new mexico": "nm", "new york": "ny", "north carolina": "nc",
    "north dakota": "nd", "ohio": "oh", "oklahoma": "ok", "oregon": "or", "pennsylvania": "pa",
    "rhode island": "ri", "south carolina": "sc", "south dakota": "sd", "tennessee": "tn",
    "texas": "tx", "utah": "ut", "vermont": "vt", "virginia": "va", "washington": "wa",
    "west virginia": "wv", "wisconsin": "wi", "wyoming": "wy",
}

MAX_EMPTY_PAGES = 5
MAX_DUPLICATE_ONLY_PAGES = 3
EMPTY_PAGE_RETRIES = 2

_BROWSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}

_API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.linkedin.com/jobs/search/",
    "Connection": "keep-alive",
}


def _csv_codes(values, mapping):
    codes = [mapping[v] for v in values or [] if v in mapping]
    return ",".join(codes) if codes else None


def _search_params(
    search_term,
    location,
    job_types=None,
    experience_levels=None,
    workplace_types=None,
    date_posted=None,
    easy_apply=False,
):
    params = {
        "keywords": search_term,
        "location": location,
    }
    job_type_codes = _csv_codes(job_types, JOB_TYPE_CODES)
    experience_codes = _csv_codes(experience_levels, EXPERIENCE_CODES)
    workplace_codes = _csv_codes(workplace_types, WORKPLACE_CODES)

    if job_type_codes:
        params["f_JT"] = job_type_codes
    if experience_codes:
        params["f_E"] = experience_codes
    if workplace_codes:
        params["f_WT"] = workplace_codes
    if date_posted in DATE_POSTED_CODES:
        params["f_TPR"] = DATE_POSTED_CODES[date_posted]
    if easy_apply:
        params["f_AL"] = "true"

    return params


def _clean_location_key(location: str) -> str:
    return re.sub(r"\s+", " ", location.strip().lower())


def _resolve_linkedin_location(location: str, session: requests.Session) -> tuple[str, str | None]:
    key = _clean_location_key(location)
    if key in COMMON_LINKEDIN_LOCATIONS:
        return COMMON_LINKEDIN_LOCATIONS[key]

    queries = [location]
    if "united states" not in key and not re.search(r"\b[a-z]{2}\b", key):
        queries.append(f"{location} United States")

    for query in queries:
        try:
            response = session.get(
                "https://www.linkedin.com/jobs-guest/api/typeaheadHits",
                params={"query": query, "typeaheadType": "GEO"},
                headers=_API_HEADERS,
                timeout=10,
            )
            if response.status_code != 200:
                continue
            hits = response.json()
        except (requests.RequestException, ValueError):
            continue

        geo_hits = [
            hit for hit in hits
            if hit.get("type") == "GEO" and hit.get("id") and hit.get("displayName")
        ]
        if geo_hits:
            first = geo_hits[0]
            return first["displayName"], first["id"]

    return location, None


def _location_tokens(value: str) -> list[str]:
    return [token for token in re.split(r"[^a-z0-9]+", value.lower()) if token]


def _location_aliases(requested_location: str, linkedin_location: str) -> list[str]:
    aliases = []
    for value in (requested_location, linkedin_location):
        first_part = value.split(",", 1)[0].strip().lower()
        if first_part and first_part not in aliases:
            aliases.append(first_part)

    if "nyc" in aliases:
        aliases.extend(["new york", "new york city"])
    if "new york" in aliases:
        aliases.extend(["new york city", "nyc"])

    return aliases


def _is_state_or_country_search(location: str) -> bool:
    key = _clean_location_key(location)
    if key.endswith(" state"):
        key = key[:-6].strip()
    return key in STATE_ALIASES or key in {"united states", "usa", "us", "remote"}


def _is_broad_location_search(requested_location: str, linkedin_location: str) -> bool:
    key = _clean_location_key(requested_location)
    if key in {"united states", "usa", "us", "remote"}:
        return True
    if key.endswith(" state"):
        return True
    if key not in STATE_ALIASES:
        return False

    # Some inputs are both a state and a city name. If LinkedIn resolved the
    # query to a city geoId, keep our post-filter city-specific too.
    resolved_parts = [part.strip().lower() for part in linkedin_location.split(",")]
    return len(resolved_parts) <= 2


def _matches_requested_location(
    job_location: str | None,
    requested_location: str,
    linkedin_location: str,
    workplace_types=None,
) -> bool:
    if not job_location or _is_broad_location_search(requested_location, linkedin_location):
        return True

    job_tokens = set(_location_tokens(job_location))
    if "remote" in job_tokens and "remote" in (workplace_types or []):
        return True

    for alias in _location_aliases(requested_location, linkedin_location):
        alias_tokens = set(_location_tokens(alias))
        if alias_tokens and alias_tokens.issubset(job_tokens):
            return True

    return False


def _is_blocked(response) -> bool:
    if len(response.text) < 200:
        return False
    text = response.text
    return (
        "authwall" in text
        or "uas/login" in text
        or ("Sign in" in text and "base-search-card" not in text)
    )


def _canonical_job_id(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"/jobs/view/(?:[^/?#]+-)?(\d+)", url)
    return match.group(1) if match else None


def _canonical_job_url(url: str | None) -> str | None:
    if not url:
        return None

    job_id = _canonical_job_id(url)
    if job_id:
        return f"https://www.linkedin.com/jobs/view/{job_id}/"

    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def _company_logo_url(card) -> str | None:
    parent = card.find_parent("div", class_="base-card") or card.find_parent("li")
    if not parent:
        return None

    image = parent.select_one("img")
    if not image:
        return None

    for attr in ("data-delayed-url", "data-ghost-url", "src"):
        value = image.get(attr)
        if value and value.startswith("http"):
            return value.strip()

    return None


def _warmup_session(session: requests.Session, params: dict) -> None:
    warmup_url = "https://www.linkedin.com/jobs/search/?" + urlencode(params)
    try:
        session.get(warmup_url, headers=_BROWSE_HEADERS, timeout=15)
        time.sleep(random.uniform(1.5, 2.5))
    except requests.RequestException:
        pass


def _fetch_with_retry(
    session: requests.Session,
    url: str,
    max_retries: int = 3,
) -> requests.Response | None:
    delay = 5.0
    for attempt in range(max_retries):
        try:
            response = session.get(url, headers=_API_HEADERS, timeout=15)
        except requests.RequestException as exc:
            print(f"  Request failed ({exc.__class__.__name__}). Waiting {delay:.0f}s before retry {attempt + 1}/{max_retries}...")
            time.sleep(delay)
            delay *= 2
            continue

        if response.status_code == 429:
            print(f"  Rate limited (429). Waiting {delay:.0f}s before retry {attempt + 1}/{max_retries}...")
            time.sleep(delay)
            delay *= 2
            continue
        if response.status_code in (400, 404):
            return None
        response.raise_for_status()
        return response
    return None


def _parse_applicant_count(text: str | None) -> int | None:
    """Parse LinkedIn applicant text into a number.
    Handles: 'Be among the first 25 applicants', 'Over 200 applicants', '1,234 applicants'.
    """
    if not text:
        return None
    match = re.search(r"[\d,]+", text)
    if not match:
        return None
    return int(match.group().replace(",", ""))


def _parse_jobs(soup: BeautifulSoup) -> list[dict]:
    jobs = []

    for card in soup.select("div.base-search-card__info"):
        title_tag = card.find("h3", class_="base-search-card__title")
        position = title_tag.get_text(strip=True) if title_tag else ""

        company_tag = card.find("h4", class_="base-search-card__subtitle")
        if company_tag:
            link = company_tag.find("a")
            company = link.get_text(strip=True) if link else company_tag.get_text(strip=True)
        else:
            company = ""

        parent = card.find_parent("div", class_="base-card") or card.find_parent("li")
        link_tag = parent.find("a", class_="base-card__full-link") if parent else None
        url = link_tag.get("href", "").strip() if link_tag else None
        location_tag = card.find("span", class_="job-search-card__location")
        location = location_tag.get_text(strip=True) if location_tag else None
        logo_url = _company_logo_url(card)
        applicant_tag = card.find("span", class_="job-search-card__applicant-count")
        applicant_count = _parse_applicant_count(applicant_tag.get_text(strip=True) if applicant_tag else None)
        salary_tag = card.find("span", class_="job-search-card__salary-info")
        salary = salary_tag.get_text(strip=True) if salary_tag else None
        job_type_tag = card.find("span", class_="job-search-card__job-type")
        job_type = job_type_tag.get_text(strip=True) if job_type_tag else None

        if position or company:
            jobs.append({
                "position": position,
                "company": company,
                "url": _canonical_job_url(url),
                "job_id": _canonical_job_id(url),
                "location": location,
                "logo_url": logo_url,
                "applicant_count": applicant_count,
                "salary": salary,
                "job_type": job_type,
            })

    if not jobs:
        for card in soup.select("li.jobs-search-results__list-item, li[class*='result']"):
            title_tag = card.select_one("h3, [class*='title']")
            company_tag = card.select_one("[class*='company'], [class*='subtitle']")
            link_tag = card.select_one("a[href*='/jobs/view/']")
            if title_tag:
                url = link_tag.get("href", "").strip() if link_tag else None
                location_tag = card.select_one("[class*='location']")
                logo_url = _company_logo_url(card)
                applicant_tag = card.select_one("[class*='applicant']")
                salary_tag = card.select_one("[class*='salary']")
                jobs.append({
                    "position": title_tag.get_text(strip=True),
                    "company": company_tag.get_text(strip=True) if company_tag else "",
                    "url": _canonical_job_url(url),
                    "job_id": _canonical_job_id(url),
                    "location": location_tag.get_text(strip=True) if location_tag else None,
                    "logo_url": logo_url,
                    "applicant_count": _parse_applicant_count(applicant_tag.get_text(strip=True) if applicant_tag else None),
                    "salary": salary_tag.get_text(strip=True) if salary_tag else None,
                })

    return jobs


def _fetch_page_jobs(session: requests.Session, url: str, page: int) -> tuple[list[dict], bool]:
    for attempt in range(EMPTY_PAGE_RETRIES + 1):
        response = _fetch_with_retry(session, url)
        if response is None:
            print(f"  No response or terminal error on page {page + 1}, stopping.")
            return [], False

        if _is_blocked(response):
            print(f"  Blocked by LinkedIn on page {page + 1} (login wall detected). Stopping.")
            return [], True

        soup = BeautifulSoup(response.text, "html.parser")
        raw_jobs = _parse_jobs(soup)
        if raw_jobs:
            return raw_jobs, False

        print(
            f"  Page {page + 1} returned 0 cards "
            f"(response size: {len(response.text)} bytes, retry {attempt}/{EMPTY_PAGE_RETRIES})."
        )
        if attempt < EMPTY_PAGE_RETRIES:
            time.sleep(random.uniform(1.5, 3.5))

    return [], False


def scrape_linkedin_job_pages(
    search_term,
    location,
    job_types=None,
    experience_levels=None,
    workplace_types=None,
    date_posted=None,
    easy_apply=False,
    start_page=0,
    max_pages=100,
):
    session = requests.Session()
    linkedin_location, geo_id = _resolve_linkedin_location(location, session)
    params = _search_params(
        search_term,
        linkedin_location,
        job_types=job_types,
        experience_levels=experience_levels,
        workplace_types=workplace_types,
        date_posted=date_posted,
        easy_apply=easy_apply,
    )
    if geo_id:
        params["geoId"] = geo_id

    _warmup_session(session, params)

    seen = set()
    max_pages = max(1, int(max_pages or 100))
    consecutive_empty = 0
    duplicate_only_pages = 0

    start_page = max(0, int(start_page or 0))
    for page in range(start_page, start_page + max_pages):
        page_params = {**params, "start": page * 10}
        url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + urlencode(page_params)

        print(f"Scraping page {page + 1}: start={page * 10}")

        if page > 0:
            time.sleep(random.uniform(0.6, 1.4))

        raw_jobs, blocked = _fetch_page_jobs(session, url, page)
        if blocked:
            yield {
                "type": "rate_limited",
                "page": page + 1,
                "jobs": [],
                "message": "LinkedIn blocked the scraper. Showing jobs found so far.",
            }
            break

        if not raw_jobs:
            consecutive_empty += 1
            print(f"  Page {page + 1}: confirmed empty. consecutive_empty={consecutive_empty}")
            if consecutive_empty >= MAX_EMPTY_PAGES:
                break
            continue

        consecutive_empty = 0
        page_jobs = []
        for job in raw_jobs:
            if not _matches_requested_location(job.get("location"), location, linkedin_location, workplace_types):
                continue

            dedupe_key = (
                job.get("job_id")
                or job.get("url")
                or f"{job['company'].lower()}::{job['position'].lower()}::{job.get('location') or ''}"
            )
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            page_jobs.append({
                "company": job["company"],
                "position": job["position"],
                "status": "Not Applied",
                "url": job["url"],
                "location": job.get("location"),
                "job_id": job.get("job_id"),
                "source": "linkedin",
                "logo_url": job.get("logo_url"),
                "applicant_count": job.get("applicant_count"),
                "salary": job.get("salary"),
                "job_type": job.get("job_type"),
            })

        if page_jobs:
            duplicate_only_pages = 0
            yield {
                "type": "page",
                "page": page + 1,
                "jobs": page_jobs,
            }
        else:
            duplicate_only_pages += 1
            print(
                f"  Page {page + 1}: all {len(raw_jobs)} cards were duplicates. "
                f"duplicate_only_pages={duplicate_only_pages}"
            )
            if duplicate_only_pages >= MAX_DUPLICATE_ONLY_PAGES:
                break


def scrape_linkedin_jobs(
    search_term,
    location,
    job_types=None,
    experience_levels=None,
    workplace_types=None,
    date_posted=None,
    easy_apply=False,
    start_page=0,
    max_pages=100,
):
    jobs = []
    for event in scrape_linkedin_job_pages(
        search_term,
        location,
        job_types=job_types,
        experience_levels=experience_levels,
        workplace_types=workplace_types,
        date_posted=date_posted,
        easy_apply=easy_apply,
        start_page=start_page,
        max_pages=max_pages,
    ):
        if event["type"] == "page":
            jobs.extend(event["jobs"])
    return jobs


def main():
    search = input("Job title to search: ")
    location = input("Location: ")

    jobs = scrape_linkedin_jobs(search, location)

    if jobs:
        print(f"\nFound {len(jobs)} jobs!\n")
        for i, job in enumerate(jobs, 1):
            print(f"{i}. {job['company']} - {job['position']}")

        choice = input("\nAdd all these to your tracker? (y/n): ")
        if choice.lower() == "y":
            from job_tracker import add_jobs_from_scraper
            add_jobs_from_scraper(jobs)
    else:
        print("No jobs found")


if __name__ == "__main__":
    main()
