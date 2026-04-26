import json
import os

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')
# Function to load jobs from file
def load_jobs():
    try:
        with open('jobs.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return []  # Return empty list if file doesn't exist

# Function to save jobs to file
def save_jobs(jobs):
    with open('jobs.json', 'w') as f:
        json.dump(jobs, f, indent=2)

# Function to add a new job
def add_job(jobs):
    company = input("Company name: ")
    position = input("Position: ")
    status = input("Status: ")
    
    new_job = {
        "company": company,
        "position": position,
        "status": status
    }
    
    jobs.append(new_job)

# Function to display all jobs
def display_jobs(jobs):
    if not jobs:
        print("\nNo jobs yet!")
        return
    
    print("\n" + "="*50)
    for i, job in enumerate(jobs, 1):
        print(f"\n[{i}] {job['company']} - {job['position']}")
        print(f"    Status: {job['status']}")
        print("-"*50)

def update_status(jobs):
    display_jobs(jobs)
    updateChoice = input("Pick job to update status by number: ")
    try:
        num = int(updateChoice) - 1
        if 0 <= num < len(jobs):
            original = jobs[num]['status']
            updateStatus = input("Pick new status: ")
            changed = jobs[num]['status']=updateStatus
            print(f"Job from {jobs[num]['company']} changed from {original} to {changed}")
    except ValueError:
        print("Please enter a number!")

def delete_jobs(jobs):
    display_jobs(jobs)
    deleteChoice = input("Pick job to delete by number: ")
    try:
        num = int(deleteChoice) - 1  # Convert to int and adjust for 0-index
        
        if 0 <= num < len(jobs):
            removed = jobs.pop(num)  # Remove and get the job
            print(f"Deleted: {removed['company']} - {removed['position']}")
            
        else:
            print("Invalid number!")
    except ValueError:
        print("Please enter a number!")

def main():
    jobs = load_jobs()
    print("\n" + "="*40)
    
    print("       JOB APPLICATION TRACKER")
    print("="*40)
    while True:
        print("\n1. Add job")
        print("2. View jobs")
        print("3. Delete job")
        print("4. Update status")
        print("5. Quit\n")
        
        
        choice = input("Choose option: ")
        
        if choice == "1":
            add_job(jobs)
            save_jobs(jobs)
        elif choice == "2":
            display_jobs(jobs)
        elif choice == "3":
            delete_jobs(jobs)
        elif choice == "4":
            update_status(jobs)
            save_jobs(jobs)
        elif choice == "5":
            break
    
if __name__ == "__main__":
    main()