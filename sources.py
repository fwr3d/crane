import json
import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


def fetch_remoteok(search: str = "") -> list[dict]:
    resp = requests.get(
        "https://remoteok.com/api",
        headers={**HEADERS, 'Accept': 'application/json'},
        timeout=12,
    )
    resp.raise_for_status()
    data = resp.json()
    # First element is a legal notice object, skip it
    jobs = [item for item in data if isinstance(item, dict) and 'position' in item]
    if search:
        words = search.lower().split()
        jobs = [
            j for j in jobs
            if any(
                w in j.get('position', '').lower()
                or w in j.get('company', '').lower()
                or any(w in t.lower() for t in (j.get('tags') or []))
                for w in words
            )
        ]
    return [
        {
            'company': j.get('company', ''),
            'position': j.get('position', ''),
            'url': j.get('url') or f"https://remoteok.com/remote-jobs/{j.get('slug', '')}",
            'location': 'Remote',
        }
        for j in jobs[:150]
    ]


def fetch_greenhouse(company: str) -> list[dict]:
    slug = company.lower().strip()
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    resp = requests.get(url, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    company_name = (data.get('company') or {}).get('name') or company
    return [
        {
            'company': company_name,
            'position': j.get('title', ''),
            'url': j.get('absolute_url', ''),
            'location': (j.get('location') or {}).get('name', '') if isinstance(j.get('location'), dict) else '',
        }
        for j in data.get('jobs', [])
    ]


def fetch_lever(company: str) -> list[dict]:
    slug = company.lower().strip()
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    resp = requests.get(url, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return [
        {
            'company': company,
            'position': j.get('text', ''),
            'url': j.get('hostedUrl', ''),
            'location': (j.get('categories') or {}).get('location', '') or j.get('workplaceType', ''),
        }
        for j in data
    ]


def fetch_yc(search: str = "") -> list[dict]:
    params: dict = {}
    if search:
        params['query'] = search

    resp = requests.get(
        "https://www.workatastartup.com/jobs",
        params=params,
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    # Next.js embeds full page data in __NEXT_DATA__
    script = soup.find('script', id='__NEXT_DATA__')
    if script:
        try:
            page_data = json.loads(script.string or '{}')
            page_props = page_data.get('props', {}).get('pageProps', {})
            jobs_list = page_props.get('jobPostings') or page_props.get('jobs') or []
            results = []
            for j in jobs_list:
                company_info = j.get('company') or {}
                results.append({
                    'company': company_info.get('name', '') if isinstance(company_info, dict) else str(company_info),
                    'position': j.get('title') or j.get('role', ''),
                    'url': f"https://www.workatastartup.com/jobs/{j.get('id', '')}",
                    'location': j.get('jobType') or j.get('location', ''),
                })
            if results:
                return results[:100]
        except Exception:
            pass

    # HTML fallback
    results = []
    for card in soup.select('[class*="JobCard"], [class*="job-card"], article[class*="job"]'):
        title_el = card.select_one('h2, h3, [class*="title"]')
        company_el = card.select_one('[class*="company"], [class*="name"]')
        link_el = card.select_one('a[href]')
        if title_el and company_el:
            href = link_el['href'] if link_el else ''
            if href.startswith('/'):
                href = f"https://www.workatastartup.com{href}"
            results.append({
                'company': company_el.get_text(strip=True),
                'position': title_el.get_text(strip=True),
                'url': href,
                'location': '',
            })
    return results[:100]


def extract_url_metadata(url: str) -> dict:
    resp = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    company = ''
    position = ''

    # 1. JSON-LD (schema.org/JobPosting) — most reliable
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            raw = script.string or ''
            data = json.loads(raw)
            if isinstance(data, list):
                data = next((d for d in data if isinstance(d, dict) and d.get('@type') == 'JobPosting'), {})
            if isinstance(data, dict) and data.get('@type') == 'JobPosting':
                position = data.get('title', '')
                org = data.get('hiringOrganization', {})
                company = org.get('name', '') if isinstance(org, dict) else ''
                if position:
                    break
        except Exception:
            pass

    # 2. OpenGraph tags
    if not position:
        og = soup.find('meta', property='og:title')
        if og:
            position = og.get('content', '')
    if not company:
        og_site = soup.find('meta', property='og:site_name')
        if og_site:
            company = og_site.get('content', '')

    # 3. <title> tag parsing
    if not position:
        title_tag = soup.find('title')
        if title_tag:
            text = title_tag.get_text(strip=True)
            if ' | ' in text:
                parts = [p.strip() for p in text.split(' | ')]
                position = parts[0]
                if not company and len(parts) > 1:
                    company = parts[1]
            elif ' - ' in text:
                parts = [p.strip() for p in text.split(' - ', 1)]
                position = parts[0]
                if not company and len(parts) > 1:
                    company = parts[1]
            elif ' at ' in text.lower():
                idx = text.lower().index(' at ')
                position = text[:idx].strip()
                if not company:
                    company = text[idx + 4:].strip()
            else:
                position = text

    return {
        'company': company.strip(),
        'position': position.strip(),
        'url': str(resp.url),
    }
