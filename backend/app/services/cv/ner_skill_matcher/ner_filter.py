import spacy
from typing import List, Set

_nlp = spacy.load("en_core_web_sm")


def extract_explicit_skills(text: str, known_skills: set[str]) -> List[str]:
    """
    Extract explicitly mentioned skills using NER + string matching.
    This is a FILTER, not a discovery mechanism.
    Returns max 20 skills that match known_skills from CSV.
    """
    doc = _nlp(text.lower())
    found = set()

    # Check noun chunks first (multi-word skills)
    for chunk in doc.noun_chunks:
        chunk_text = chunk.text.strip()
        if chunk_text in known_skills:
            found.add(chunk_text)
        # Also check normalized version
        chunk_normalized = chunk_text.replace(" ", "")
        if chunk_normalized in known_skills:
            found.add(chunk_normalized)

    # Check individual tokens
    for token in doc:
        token_text = token.text.strip()
        if token_text in known_skills:
            found.add(token_text)

    # Limit to 20 skills
    return sorted(list(found))[:20]


def match_roles_to_csv_titles(roles: List[str], csv_titles: Set[str]) -> List[str]:
    """
    Match experience roles to CSV job titles using strict NER and word order matching.
    Returns list of matched CSV job titles.
    Requires ALL significant words from role to be present in title.
    """
    matched_titles = []
    
    # Common words to ignore in matching (too generic)
    common_words = {'engineer', 'developer', 'manager', 'specialist', 'analyst', 
                   'consultant', 'architect', 'administrator', 'coordinator', 'director',
                   'lead', 'senior', 'junior', 'entry', 'level', 'principal', 'staff'}
    
    for role in roles:
        if not role:
            continue
        
        role_lower = role.lower().strip()
        
        # Check for exact match first
        if role_lower in csv_titles:
            if role_lower not in matched_titles:
                matched_titles.append(role_lower)
            continue
        
        # Use NER to extract ALL significant words from role (including common words for context)
        doc = _nlp(role_lower)
        all_role_words = [token.text for token in doc 
                         if token.pos_ in ['NOUN', 'PROPN', 'ADJ'] 
                         and len(token.text) > 2]
        
        # Separate into specific words (not common) and common words
        specific_role_words = [w for w in all_role_words if w not in common_words]
        common_role_words = [w for w in all_role_words if w in common_words]
        
        # If no specific words, we need at least 2 common words to match
        if not specific_role_words and len(common_role_words) < 2:
            continue
        
        best_match = None
        best_score = 0
        
        # Try to match with CSV titles
        for title in csv_titles:
            title_lower = title.lower()
            
            # Check if role appears as substring in title (highest priority)
            if role_lower in title_lower:
                # Prefer exact or very close matches
                score = 100.0 - (len(title_lower) - len(role_lower))
                if score > best_score:
                    best_score = score
                    best_match = title
                continue
            
            # Extract words from title
            title_doc = _nlp(title_lower)
            all_title_words = [token.text for token in title_doc 
                              if token.pos_ in ['NOUN', 'PROPN', 'ADJ'] 
                              and len(token.text) > 2]
            
            specific_title_words = [w for w in all_title_words if w not in common_words]
            common_title_words = [w for w in all_title_words if w in common_words]
            
            # If role has specific words, ALL must be in title
            if specific_role_words:
                specific_role_set = set(specific_role_words)
                specific_title_set = set(specific_title_words)
                
                # ALL specific words from role must be in title
                if not specific_role_set.issubset(specific_title_set):
                    continue
                
                # Check word order - specific words should appear in order
                role_word_list = [w for w in all_role_words if w in specific_role_words]
                title_word_list = [w for w in all_title_words if w in specific_title_words]
                
                # Find positions of role words in title
                order_score = 0
                if len(role_word_list) >= 2:
                    try:
                        role_positions = [title_word_list.index(w) for w in role_word_list if w in title_word_list]
                        if len(role_positions) == len(role_word_list):
                            # Check if order is preserved
                            if role_positions == sorted(role_positions):
                                order_score = 20
                    except ValueError:
                        pass
                
                # Calculate score: prefer titles where role words form larger portion
                overlap_ratio = len(specific_role_set) / max(len(specific_title_set), 1)
                length_penalty = max(0, (len(all_title_words) - len(all_role_words)) / max(len(all_role_words), 1))
                
                score = (overlap_ratio * 60) + order_score - (length_penalty * 10)
                
                # Require high score for match (strict)
                if score > best_score and score >= 40.0:
                    best_score = score
                    best_match = title
            else:
                # No specific words, require at least 2 common words to match
                if len(common_role_words) >= 2:
                    common_overlap = len(set(common_role_words) & set(common_title_words))
                    if common_overlap >= 2:
                        score = common_overlap * 15
                        if score > best_score:
                            best_score = score
                            best_match = title
        
        # Only add match if score is above threshold
        if best_match and best_score >= 40.0:
            if best_match not in matched_titles:
                matched_titles.append(best_match)
    
    return matched_titles
