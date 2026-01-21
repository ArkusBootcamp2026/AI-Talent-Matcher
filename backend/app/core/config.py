# Core configuration settings

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory (relative to this file)
# This ensures it works regardless of where the server is started from
# Path structure: backend/app/core/config.py
# We need to go up 3 levels: core/ -> app/ -> backend/
_backend_dir = Path(__file__).parent.parent.parent  # Go up from core/ to app/ to backend/
_env_path = _backend_dir / ".env"
load_dotenv(dotenv_path=_env_path)

class Settings:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    # Supabase Storage
    SUPABASE_CV_BUCKET = "cvs"
    
    # CSV Database Location
    # Path structure: backend/app/core/config.py
    # We need to go up 2 levels: core/ -> app/
    # Then to app/data/db/
    CSV_DB_DIR = Path(__file__).parent.parent / "data" / "db"

settings = Settings()
