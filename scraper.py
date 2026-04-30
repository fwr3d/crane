import requests
import time
from bs4 import BeautifulSoup
from urllib.parse import urlencode
import re

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


def _csv_codes(values, mapping):
    codes = [mapping[v] for v in values or [] if v in mapping]
    return ",".join(codes) if codes else None


def _clean_location_key(location):
    return re.sub(r"\s+", " ", location.strip().lower())


def _resolve_linkedin_location(location, headers):
    key = _clean_location_key(location)
    if key in COMMON_LINKEDIN_LOCATIONS:
        return COMMON_LINKEDIN_LOCATIONS[key]

    queries = [location]
    if "united states" not in key and not re.search(r"\b[a-z]{2}\b", key):
        queries.append(f"{location} United States")

    for query in queries:
        try:
            response = requests.get(
                "https://www.linkedin.com/jobs-guest/api/typeaheadHits",
                params={"query": query, "typeaheadType": "GEO"},
                headers=headers,
                timeout=10,
            )
            if response.status_code != 200:
                continue
            hits = response.json()
        except (requests.RequestException, ValueError):
            continue

        geo_hits = [hit for hit in hits if hit.get("type") == "GEO" and hit.get("id") and hit.get("displayName")]
        if geo_hits:
            first = geo_hits[0]
            return first["displayName"], first["id"]

    return location, None


def _location_tokens(value):
    return [token for token in re.split(r"[^a-z0-9]+", value.lower()) if token]


def _normalize_location(value):
    tokens = _location_tokens(value)
    expanded = []
    for token in tokens:
        expanded.append(token)
        for state, abbr in STATE_ALIASES.items():
            if token == abbr:
                expanded.extend(state.split())
    return set(expanded)


def _requested_location_parts(location):
    parts = [part.strip().lower() for part in re.split(r"[,/|]", location) if part.strip()]
    if not parts:
        return []

    aliases = [parts[0]]
    if parts[0] == "nyc":
        aliases.extend(["new york", "new york city"])
    if parts[0] == "new york":
        aliases.extend(["new york city", "nyc"])
    return aliases


def _is_state_only_location(location):
    key = _clean_location_key(location).replace(" state", "")
    return key in STATE_ALIASES and key != "new york"


def _matches_requested_location(job_location, requested_location, workplace_types=None):
    if not job_location:
        return True

    normalized_job = _normalize_location(job_location)
    aliases = _requested_location_parts(requested_location)
    if not aliases:
        return True

    if "remote" in (workplace_types or []) and "remote" in normalized_job:
        return True

    basic_job_tokens = set(_location_tokens(job_location))
    for alias in aliases:
        alias_tokens = set(_location_tokens(alias))
        if alias_tokens and alias_tokens.issubset(basic_job_tokens):
            return True

    requested_tokens = _normalize_location(requested_location)
    requested_states = requested_tokens.intersection(set(STATE_ALIASES.values()))
    requested_state_names = {
        state for state, abbr in STATE_ALIASES.items()
        if abbr in requested_states or state in requested_location.lower()
    }
    if requested_state_names and _is_state_only_location(requested_location):
        state_tokens = set()
        for state in requested_state_names:
            state_tokens.update(state.split())
            state_tokens.add(STATE_ALIASES[state])
        if normalized_job.intersection(state_tokens):
            return True

    return False


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


def scrape_linkedin_job_pages(
    search_term,
    location,
    job_types=None,
    experience_levels=None,
    workplace_types=None,
    date_posted=None,
    easy_apply=False,
    max_pages=100,
):
    """
    Yield LinkedIn jobs one result page at a time.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    linkedin_location, geo_id = _resolve_linkedin_location(location, headers)
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
    seen = set()
    max_pages = max(1, int(max_pages or 100))

    for page in range(max_pages):
        page_params = {**params, "start": page * 10}
        url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?{urlencode(page_params)}"

        print(f"Scraping: {url}")

        if page > 0:
            time.sleep(0.75)

        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 429:
            time.sleep(3)
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 429:
                yield {
                    "type": "rate_limited",
                    "page": page + 1,
                    "jobs": [],
                    "message": "LinkedIn slowed the search down. Showing the jobs found so far.",
                }
                break
        if response.status_code in (400, 404):
            break
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        job_cards = soup.select('li div.base-search-card__info, div.base-search-card__info')
        if not job_cards:
            break

        page_jobs = []
        added_this_page = 0
        for card in job_cards:
            title_tag = card.find('h3', class_='base-search-card__title')
            position = title_tag.text.strip() if title_tag else "Unknown"

            company_tag = card.find('h4', class_='base-search-card__subtitle')
            if company_tag:
                company_link = company_tag.find('a')
                company = company_link.text.strip() if company_link else company_tag.text.strip()
            else:
                company = "Unknown"

            location_tag = card.find('span', class_='job-search-card__location')
            job_location = location_tag.text.strip() if location_tag else None
            if not _matches_requested_location(job_location, location, workplace_types):
                continue

            parent = card.find_parent('div', class_='base-card') or card.find_parent('li')
            link_tag = parent.find('a', class_='base-card__full-link') if parent else None
            job_url = link_tag.get('href').strip() if link_tag and link_tag.get('href') else None
            dedupe_key = job_url or f"{company.lower()}::{position.lower()}"
            if dedupe_key in seen:
                continue

            seen.add(dedupe_key)
            added_this_page += 1
            page_jobs.append({
                'company': company,
                'position': position,
                'status': 'Not Applied',
                'url': job_url,
                'location': job_location,
            })

        if page_jobs:
            yield {
                "type": "page",
                "page": page + 1,
                "jobs": page_jobs,
            }

        if added_this_page == 0:
            break


def scrape_linkedin_jobs(
    search_term,
    location,
    job_types=None,
    experience_levels=None,
    workplace_types=None,
    date_posted=None,
    easy_apply=False,
    max_pages=100,
):
    """
    Scrape jobs from LinkedIn
    Returns list of job dictionaries
    """
    jobs = []
    for event in scrape_linkedin_job_pages(
        search_term,
        location,
        job_types=job_types,
        experience_levels=experience_levels,
        workplace_types=workplace_types,
        date_posted=date_posted,
        easy_apply=easy_apply,
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
        if choice.lower() == 'y':
            from job_tracker import add_jobs_from_scraper
            add_jobs_from_scraper(jobs)
    else:
        print("No jobs found")
if __name__ == "__main__":
    main()
