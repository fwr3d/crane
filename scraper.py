import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
def scrape_linkedin_jobs(search_term, location):
    """
    Scrape jobs from LinkedIn
    Returns list of job dictionaries
    """
    keywords = quote(search_term)
    loc = quote(location)

    url = f"https://www.linkedin.com/jobs/search/?keywords={keywords}&location={loc}"

    print(f"Scraping: {url}")

    response = requests.get(url)

    soup = BeautifulSoup(response.text,'html.parser')

    job_cards = soup.find_all('div', class_='base-search-card__info')
    jobs = []

    for card in job_cards:
        # Get position title
        title_tag = card.find('h3', class_='base-search-card__title')
        position = title_tag.text.strip() if title_tag else "Unknown"
            # Get company name
        company_tag = card.find('h4', class_='base-search-card__subtitle')
        if company_tag:
            company_link = company_tag.find('a')
            company = company_link.text.strip() if company_link else "Unknown"
        else:
            company = "Unknown"
        
        jobs.append({
            'company': company,
            'position': position,
            'status': 'Found'
        })
    
    return jobs
    # TODO: Build LinkedIn URL
    # TODO: Get the page
    # TODO: Parse jobs
    # TODO: Return list of jobs
    
    

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