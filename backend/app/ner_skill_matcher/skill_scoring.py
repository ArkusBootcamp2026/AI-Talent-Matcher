"""Skill scoring utilities"""

from collections import Counter


def compute_skill_weights(job_skills: list[str]) -> dict[str, float]:
    """
    Simple frequency-based weighting.
    """
    total = len(job_skills)
    counts = Counter(job_skills)

    return {
        skill: count / total
        for skill, count in counts.items()
    }
