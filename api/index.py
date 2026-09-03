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

app.mount("/api", fastapi_app)
