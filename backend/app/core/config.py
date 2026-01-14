# Core configuration settings

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    # Supabase Storage
    SUPABASE_CV_BUCKET = "cvs"
    
    # CSV Database Location
    CSV_DB_DIR = Path(__file__).parent.parent / "data" / "db"

settings = Settings()
