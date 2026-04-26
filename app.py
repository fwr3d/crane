import streamlit as st
from datetime import datetime
from job_tracker import load_jobs, save_jobs
from scraper import scrape_linkedin_jobs

st.set_page_config(page_title="Job Tracker", layout="wide")

# ── Status config ──────────────────────────────────────────────────────────────
STATUS_CONFIG = {
    "Not Applied": {"color": "#6B7280", "bg": "#F3F4F6"},
    "Applied":     {"color": "#2563EB", "bg": "#DBEAFE"},
    "Interview":   {"color": "#D97706", "bg": "#FEF3C7"},
    "Offer":       {"color": "#059669", "bg": "#D1FAE5"},
    "Rejected":    {"color": "#DC2626", "bg": "#FEE2E2"},
}
STATUSES = list(STATUS_CONFIG.keys())


def normalize_status(s):
    for k in STATUS_CONFIG:
        if k.lower() == s.lower():
            return k
    return s


def badge(status):
    cfg = STATUS_CONFIG.get(status, {"color": "#6B7280", "bg": "#F3F4F6"})
    return (
        f'<span style="background:{cfg["bg"]};color:{cfg["color"]};'
        f'padding:3px 10px;border-radius:999px;font-size:0.78em;'
        f'font-weight:600;border:1px solid {cfg["color"]}55;white-space:nowrap;">'
        f'{status}</span>'
    )


# ── Global CSS ─────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }

    /* Page padding */
    .block-container {
        padding-top: 2rem;
        padding-bottom: 3rem;
        max-width: 960px;
    }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background: #0F172A;
    }
    section[data-testid="stSidebar"] * {
        color: #CBD5E1 !important;
    }
    section[data-testid="stSidebar"] .stRadio label {
        font-size: 0.88em;
        padding: 6px 0;
        letter-spacing: 0.02em;
    }

    /* Page title */
    h1 { font-size: 1.4em !important; font-weight: 600 !important; color: #0F172A !important; }
    h2, h3 { font-size: 1.05em !important; font-weight: 600 !important; color: #1E293B !important; }

    /* Metric tiles */
    div[data-testid="metric-container"] {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        padding: 16px 20px;
    }
    div[data-testid="metric-container"] label {
        font-size: 0.72em !important;
        font-weight: 500 !important;
        color: #64748B !important;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    div[data-testid="metric-container"] [data-testid="stMetricValue"] {
        font-size: 1.8em !important;
        font-weight: 600 !important;
        color: #0F172A !important;
    }

    /* Job cards */
    .job-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        padding: 14px 20px 12px 20px;
        margin-bottom: 6px;
    }
    .job-card:hover { border-color: #94A3B8; }
    .jc-title   { font-size: 0.92em; font-weight: 600; color: #0F172A; margin: 0 0 2px 0; }
    .jc-company { font-size: 0.82em; color: #64748B; margin: 0 0 10px 0; }
    .jc-meta    { font-size: 0.72em; color: #94A3B8; margin-top: 8px; letter-spacing: 0.01em; }

    /* Inputs and buttons */
    .stTextInput input, .stSelectbox select {
        border-radius: 6px !important;
        font-size: 0.88em !important;
    }
    .stButton button {
        border-radius: 6px !important;
        font-size: 0.85em !important;
        font-weight: 500 !important;
    }
    .stAlert { border-radius: 6px; font-size: 0.85em; }
    hr { border-color: #E2E8F0; margin: 1rem 0; }
</style>
""", unsafe_allow_html=True)


# ── Data ───────────────────────────────────────────────────────────────────────
jobs = load_jobs()

# ── Sidebar ────────────────────────────────────────────────────────────────────
st.sidebar.markdown("### Job Tracker")
st.sidebar.divider()
page = st.sidebar.radio(
    "Go to",
    ["Dashboard", "Add Job", "Scrape Jobs", "View All Jobs", "Export"],
    label_visibility="collapsed",
)
st.sidebar.divider()
st.sidebar.caption(f"{len(jobs)} jobs tracked")


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
if page == "Dashboard":
    st.title("Dashboard")

    counts = {s: 0 for s in STATUSES}
    for j in jobs:
        ns = normalize_status(j["status"])
        if ns in counts:
            counts[ns] += 1
        # non-standard statuses just fall off the chart

    total = len(jobs)
    responded = counts["Applied"] + counts["Interview"] + counts["Offer"] + counts["Rejected"]

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total", total)
    c2.metric("Not Applied", counts["Not Applied"])
    c3.metric("Applied", counts["Applied"])
    c4.metric("Interviews", counts["Interview"])
    c5.metric("Offers", counts["Offer"])

    st.divider()

    col_chart, col_stats = st.columns([2, 1])

    with col_chart:
        st.subheader("Pipeline breakdown")
        if any(counts.values()):
            import pandas as pd
            df = pd.DataFrame({"Status": list(counts.keys()), "Count": list(counts.values())})
            df = df[df["Count"] > 0]
            st.bar_chart(df.set_index("Status"))
        else:
            st.info("No jobs yet — add some to see the chart.")

    with col_stats:
        st.subheader("Stats")
        if total:
            rate = round(responded / total * 100)
            st.metric("Response rate", f"{rate}%",
                      help="(Applied + Interview + Offer + Rejected) / Total")
            if counts["Applied"] + counts["Interview"] + counts["Offer"] > 0:
                offer_rate = round(counts["Offer"] / (counts["Applied"] + counts["Interview"] + counts["Offer"]) * 100)
                st.metric("Offer rate", f"{offer_rate}%")
        if counts["Rejected"] > 0:
            st.metric("Rejected", counts["Rejected"])
        recent = [j for j in jobs if j.get("date_added")]
        if recent:
            latest = max(recent, key=lambda x: x["date_added"])
            st.caption(f"Last added: **{latest['company']}** on {latest['date_added']}")


# ══════════════════════════════════════════════════════════════════════════════
# ADD JOB
# ══════════════════════════════════════════════════════════════════════════════
elif page == "Add Job":
    st.title("Add Job")

    with st.form("add_job_form", clear_on_submit=True):
        col1, col2 = st.columns(2)
        with col1:
            company = st.text_input("Company", placeholder="e.g. Acme Corp")
        with col2:
            position = st.text_input("Position", placeholder="e.g. Software Engineer")

        status = st.select_slider(
            "Status",
            options=STATUSES,
            value="Not Applied",
        )

        submitted = st.form_submit_button("Add Job", use_container_width=True, type="primary")

        if submitted:
            if not company or not position:
                st.warning("Please fill in both Company and Position.")
            else:
                new_job = {
                    "company": company,
                    "position": position,
                    "status": status,
                    "date_added": datetime.now().strftime("%Y-%m-%d"),
                    "date_applied": datetime.now().strftime("%Y-%m-%d") if status == "Applied" else None,
                }
                jobs.append(new_job)
                save_jobs(jobs)
                st.success(f"Added **{company}** — {position}")
                st.rerun()


# ══════════════════════════════════════════════════════════════════════════════
# SCRAPE JOBS
# ══════════════════════════════════════════════════════════════════════════════
elif page == "Scrape Jobs":
    st.title("Scrape LinkedIn Jobs")

    col1, col2 = st.columns(2)
    with col1:
        search_term = st.text_input("Job Title", "Software Engineer")
    with col2:
        location = st.text_input("Location", "California")

    if st.button("Search LinkedIn", type="primary"):
        with st.spinner("Scraping LinkedIn..."):
            st.session_state["scraped_jobs"] = scrape_linkedin_jobs(search_term, location)
        st.session_state["scrape_selections"] = {}

    scraped = st.session_state.get("scraped_jobs")

    if scraped is not None:
        if not scraped:
            st.info("No jobs found. Try a different search.")
        else:
            st.success(f"Found {len(scraped)} jobs")
            st.subheader("Select jobs to add")

            selections = st.session_state.get("scrape_selections", {})
            for i, job in enumerate(scraped):
                selections[i] = st.checkbox(
                    f"{job['company']}  —  {job['position']}",
                    value=selections.get(i, False),
                    key=f"scrape_{i}",
                )
            st.session_state["scrape_selections"] = selections

            selected = [scraped[i] for i, v in selections.items() if v]
            if st.button(f"Add {len(selected)} selected job(s)", disabled=len(selected) == 0, type="primary"):
                from job_tracker import add_jobs_from_scraper
                add_jobs_from_scraper(selected)
                st.success(f"Added {len(selected)} job(s)!")
                st.session_state["scraped_jobs"] = None
                st.rerun()


# ══════════════════════════════════════════════════════════════════════════════
# VIEW ALL JOBS
# ══════════════════════════════════════════════════════════════════════════════
elif page == "View All Jobs":
    st.title("All Jobs")

    # ── filters ──
    fc1, fc2, fc3 = st.columns([2, 2, 1])
    with fc1:
        search = st.text_input("Search", placeholder="Company or position…", label_visibility="collapsed")
    with fc2:
        status_filter = st.multiselect(
            "Status",
            STATUSES,
            default=STATUSES,
            label_visibility="collapsed",
            placeholder="Filter by status…",
        )
    with fc3:
        sort_by = st.selectbox("Sort", ["Date Added ↓", "Company A-Z", "Status"], label_visibility="collapsed")

    # ── filter & sort ──
    filtered = list(jobs)
    if search:
        q = search.lower()
        filtered = [j for j in filtered if q in j["company"].lower() or q in j["position"].lower()]

    norm_filter = set(status_filter)
    filtered = [j for j in filtered if normalize_status(j["status"]) in norm_filter]

    if sort_by == "Company A-Z":
        filtered = sorted(filtered, key=lambda j: j["company"].lower())
    elif sort_by == "Status":
        order = {s: i for i, s in enumerate(STATUSES)}
        filtered = sorted(filtered, key=lambda j: order.get(normalize_status(j["status"]), 99))
    else:
        filtered = sorted(filtered, key=lambda j: j.get("date_added", ""), reverse=True)

    st.caption(f"Showing {len(filtered)} of {len(jobs)} jobs")
    st.write("")

    # ── job cards ──
    for orig_idx, job in ((jobs.index(j), j) for j in filtered):
        ns = normalize_status(job["status"])
        date_str = f"Added {job['date_added']}" if job.get("date_added") else ""
        if job.get("date_applied"):
            date_str += f"  ·  Applied {job['date_applied']}"

        with st.container():
            st.markdown(
                f'<div class="job-card">'
                f'<p class="jc-title">{job["position"]}</p>'
                f'<p class="jc-company">{job["company"]}</p>'
                f'{badge(ns)}'
                f'<p class="jc-meta">{date_str}</p>'
                f'</div>',
                unsafe_allow_html=True,
            )

        with st.expander("Edit / Delete"):
            ec1, ec2 = st.columns([3, 1])
            with ec1:
                new_status = st.selectbox(
                    "Status",
                    STATUSES,
                    index=STATUSES.index(ns) if ns in STATUSES else 0,
                    key=f"sel_{orig_idx}",
                )
            with ec2:
                st.write("")
                st.write("")
                if st.button("Save", key=f"save_{orig_idx}", type="primary", use_container_width=True):
                    jobs[orig_idx]["status"] = new_status
                    if new_status == "Applied" and not jobs[orig_idx].get("date_applied"):
                        jobs[orig_idx]["date_applied"] = datetime.now().strftime("%Y-%m-%d")
                    save_jobs(jobs)
                    st.success("Saved")
                    st.rerun()
            if st.button("Remove", key=f"del_{orig_idx}"):
                jobs.pop(orig_idx)
                save_jobs(jobs)
                st.rerun()


# ══════════════════════════════════════════════════════════════════════════════
# EXPORT
# ══════════════════════════════════════════════════════════════════════════════
elif page == "Export":
    st.title("Export")

    st.write(f"Export all **{len(jobs)}** tracked jobs as a CSV file.")

    import csv, io
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["company", "position", "status", "date_added", "date_applied"],
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(jobs)

    st.download_button(
        label="Download as CSV",
        data=output.getvalue(),
        file_name=f"jobs_{datetime.now().strftime('%Y%m%d')}.csv",
        mime="text/csv",
        type="primary",
        use_container_width=False,
    )
