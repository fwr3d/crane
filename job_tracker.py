import json
import os
from datetime import datetime
import csv

def export_to_csv():
    jobs = load_jobs()
    if not jobs:
        print("No jobs to export!")
        return
    
    filename = f"jobs_export_{datetime.now().strftime('%Y%m%d')}.csv"
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['company', 'position', 'status', 'date_added', 'date_applied'])
        writer.writeheader()
        writer.writerows(jobs)
    
    print(f"✓ Exported {len(jobs)} jobs to {filename}")

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

# Function to load jobs from file
def load_jobs():
    try:
        with open('jobs.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

# Function to save jobs to file
def save_jobs(jobs):
    with open('jobs.json', 'w') as f:
        json.dump(jobs, f, indent=2)

# Function to add a new job
def add_job():
    company = input("Company name: ")
    position = input("Position: ")
    status = input("Status (Not Applied/Applied/Interview/Offer/Rejected): ")
    
    jobs = load_jobs()
    jobs.append({
        "company": company,
        "position": position,
        "status": status,
        "date_added": datetime.now().strftime("%Y-%m-%d"),
        "date_applied": None
    })
    save_jobs(jobs)
    print("Job added!")
def search_jobs():
    jobs = load_jobs()
    if not jobs:
        print("No jobs to search!")
        return
    
    search_term = input("Search (company or position): ").lower()
    
    results = []
    for job in jobs:
        if search_term in job['company'].lower() or search_term in job['position'].lower():
            results.append(job)
    
    if results:
        print(f"\nFound {len(results)} matching jobs:")
        display_jobs(results)
    else:
        print("No matches found!")

def show_stats():
    jobs = load_jobs()
    if not jobs:
        print("No jobs yet!")
        return
    
    # Count by status
    status_counts = {}
    for job in jobs:
        status = job['status']
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print("\n" + "="*40)
    print("           JOB STATISTICS")
    print("="*40)
    print(f"\nTotal jobs tracked: {len(jobs)}")
    print("\nBy Status:")
    for status, count in status_counts.items():
        print(f"  {status}: {count}")
    
    # Show recent activity
    jobs_with_dates = [j for j in jobs if j.get('date_added')]
    if jobs_with_dates:
        latest = max(jobs_with_dates, key=lambda x: x['date_added'])
        print(f"\nMost recent: {latest['company']} - {latest['position']}")
        print(f"Added on: {latest['date_added']}")
    print("="*40)

# Function to display all jobs
def display_jobs(jobs):
    if not jobs:
        print("\nNo jobs yet!")
        return
    
    print("\n" + "="*70)
    for i, job in enumerate(jobs, 1):
        date_info = f"Added: {job.get('date_added', 'N/A')}"
        if job.get('date_applied'):
            date_info += f" | Applied: {job['date_applied']}"
        
        print(f"\n[{i}] {job['company']} - {job['position']}")
        print(f"    Status: {job['status']} | {date_info}")
        print("-"*70)

def update_status(jobs):
    if not jobs:
        print("No jobs to update!")
        return
    
    display_jobs(jobs)
    updateChoice = input("\nPick job to update status by number: ")

    try:
        num = int(updateChoice) - 1

        if 0 <= num < len(jobs):
            original = jobs[num]['status']
            updateStatus = input("Pick new status: ")
            jobs[num]['status'] = updateStatus
            
            # If changing to "Applied", set date_applied
            if updateStatus.lower() == "applied" and not jobs[num].get('date_applied'):
                jobs[num]['date_applied'] = datetime.now().strftime("%Y-%m-%d")
            
            print(f"Job from {jobs[num]['company']} changed from {original} to {updateStatus}")
        else:
            print("Invalid number")
    except ValueError:
        print("Please enter a number!")

def delete_jobs(jobs):
    if not jobs:
        print("No jobs to delete!")
        return
        
    display_jobs(jobs)
    deleteChoice = input("\nPick job to delete by number: ")
    try:
        num = int(deleteChoice) - 1
        
        if 0 <= num < len(jobs):
            removed = jobs.pop(num)
            print(f"Deleted: {removed['company']} - {removed['position']}")
        else:
            print("Invalid number!")
    except ValueError:
        print("Please enter a number!")

def add_jobs_from_scraper(scraper_jobs):
    """Add multiple jobs from scraper, skip duplicates"""
    jobs = load_jobs()
    
    added = 0
    skipped = 0
    
    for job in scraper_jobs:
        # Check if job already exists
        is_duplicate = False
        for existing in jobs:
            if (existing['company'].lower() == job['company'].lower() and 
                existing['position'].lower() == job['position'].lower()):
                is_duplicate = True
                break
        
        if not is_duplicate:
            jobs.append({
                "company": job['company'],
                "position": job['position'],
                "status": "Not Applied",
                "date_added": datetime.now().strftime("%Y-%m-%d"),
                "date_applied": None
            })
            added += 1
        else:
            skipped += 1
    
    save_jobs(jobs)
    print(f"\n✓ Added {added} new jobs")
    if skipped > 0:
        print(f"⊗ Skipped {skipped} duplicates")

def main():
    print("\n" + "="*40)
    print("       JOB APPLICATION TRACKER")
    print("="*40)
    
    while True:
        print("\n1. Add job")
        print("2. View jobs")
        print("3. Delete job")
        print("4. Update status")
        print("5. Search jobs")
        print("6. Show stats")
        print("7. Export to CSV")
        print("8. Quit\n")
        
        choice = input("Choose option: ")
        
        if choice == "1":
            add_job()
        elif choice == "2":
            jobs = load_jobs()
            display_jobs(jobs)
        elif choice == "3":
            jobs = load_jobs()
            delete_jobs(jobs)
            save_jobs(jobs)
        elif choice == "4":
            jobs = load_jobs()
            update_status(jobs)
            save_jobs(jobs)
        elif choice == "5":
            search_jobs()
        elif choice == "6":
            show_stats()
        elif choice == "7":
            export_to_csv()
        elif choice == "8":
            break

if __name__ == "__main__":
    main()