import os
os.environ['SQLITE_MODE'] = 'false'
os.environ['VOCE_DIGITAL_MASTER_KEY'] = 'peNrjJ7xHXBM_FFJy9jTLNj_dGp2hmkoj-tXvIfw9lM='
os.environ['SUPABASE_URL'] = 'postgresql://postgres:Mjm1978*@db.mhdermskrgmqiiabjie.supabase.co:5432/postgres'
os.environ['SUPABASE_KEY'] = 'Mjm1978*'

from fastapi import FastAPI
from app.main import app as fastapi_app

app = FastAPI()

@app.get("/api/health")
async def health_api():
    return {"status": "healthy", "source": "api/index.py"}

@app.get("/health")
async def health_root():
    return {"status": "healthy", "source": "api/index.py"}

@app.get("/api/config")
async def config_debug():
    from app.config import settings, is_sqlite_mode
    return {
        "SQLITE_MODE": settings.SQLITE_MODE,
        "SUPABASE_URL": settings.SUPABASE_URL,
        "SUPABASE_KEY": settings.SUPABASE_KEY,
        "is_sqlite_mode": is_sqlite_mode(),
    }

app.mount("/api", fastapi_app)
