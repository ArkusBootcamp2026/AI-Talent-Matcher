import pandas as pd
from pathlib import Path
import os

# Resolve data directory relative to this file's location (backend/app/services/cv/ner_skill_matcher/)
# This ensures cross-platform compatibility and works regardless of current working directory
_current_file = Path(__file__).resolve()
_services_cv_dir = _current_file.parent.parent  # Go up from ner_skill_matcher/ to services/cv/
DATA_DIR = _services_cv_dir / "db"  # backend/app/services/cv/db/


def _read_csv_safe(path: Path) -> pd.DataFrame:
    """
    Read CSV with safe encoding fallback.
    Forces fresh read by opening file directly.
    """
    try:
        # Force fresh read by using file handle
        with open(path, 'r', encoding='utf-8', newline='') as f:
            return pd.read_csv(f)
    except UnicodeDecodeError:
        with open(path, 'r', encoding='latin1', newline='') as f:
            return pd.read_csv(f)


def load_all_job_skill_dbs() -> pd.DataFrame:
    """
    Load and merge all *_job_roles_skills.csv files in data/.
    Always reads fresh from disk - no caching.
    """
    csv_files = sorted(DATA_DIR.glob("*_job_roles_skills.csv"))
    
    # Force file system sync by checking modification times
    for path in csv_files:
        os.stat(path)  # Force file system to refresh metadata

    dfs = []
    for path in csv_files:
        df = _read_csv_safe(path)

        # normalize column names
        df.columns = (
            df.columns
            .str.strip()
            .str.lower()
            .str.replace(" ", "_")
        )

        # validate schema
        if "job_title" not in df.columns or "skills" not in df.columns:
            raise ValueError(
                f"Invalid schema in {path.name}. "
                f"Expected columns: job_title, skills. "
                f"Found: {list(df.columns)}"
            )

        # normalize values
        df["job_title"] = df["job_title"].astype(str).str.lower().str.strip()
        df["skills"] = df["skills"].astype(str).str.lower().str.strip()

        dfs.append(df)

    if not dfs:
        raise ValueError("No *_job_roles_skills.csv files found in data/")

    return pd.concat(dfs, ignore_index=True)


def get_skills_for_job(job_role: str) -> set[str]:
    """
    Get skills for a single job role.
    Uses exact matching since job_role should be an exact CSV title from filter_job_positions_in_csv().
    """
    df = load_all_job_skill_dbs()
    job_role = job_role.lower().strip()

    # Exact match only - job_role should be an exact CSV title
    rows = df[df["job_title"] == job_role]

    skills = set()
    for _, row in rows.iterrows():
        skills.update(
            s.strip()
            for s in row["skills"].split(",")
            if s.strip()
        )

    return skills


def get_all_job_titles() -> set[str]:
    """
    Get all available job titles from the CSV database.
    """
    df = load_all_job_skill_dbs()
    return set(df["job_title"].unique())


def get_all_skills() -> set[str]:
    """
    Get all available skills from the CSV database.
    """
    df = load_all_job_skill_dbs()
    all_skills = set()
    for _, row in df.iterrows():
        skills = [s.strip() for s in str(row["skills"]).split(",") if s.strip()]
        all_skills.update(skills)
    return all_skills


def filter_job_positions_in_csv(job_positions: list[str]) -> list[str]:
    """
    Filter job positions to only exact matches in the CSV database.
    Only returns positions that match exactly (case-insensitive).
    This ensures we only get skills for the exact role mentioned.
    """
    available_titles = get_all_job_titles()
    matched_titles = []
    
    for position in job_positions:
        position_lower = position.lower().strip()
        
        # Only exact matches - no substring matching
        for title in available_titles:
            title_lower = title.lower()
            
            # Exact match only
            if position_lower == title_lower:
                if title not in matched_titles:
                    matched_titles.append(title)
                break  # Found exact match, no need to check further
    
    return matched_titles


def get_skills_for_job_positions(job_positions: list[str]) -> set[str]:
    """
    Get all skills for multiple job positions.
    Combines skills from all provided positions.
    Assumes positions have already been validated against CSV database.
    """
    all_skills = set()
    for position in job_positions:
        skills = get_skills_for_job(position)
        all_skills.update(skills)
    return all_skills
