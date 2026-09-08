import os
import traceback

# Configurações de ambiente (usar variáveis do Vercel)
os.environ['SQLITE_MODE'] = 'false'

from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.get("/api/health")
async def health_api():
    return {"status": "healthy", "source": "api/index.py"}

@app.get("/health")
async def health_root():
    return {"status": "healthy", "source": "api/index.py"}

@app.get("/api/config")
async def config_debug():
    try:
        from app.config import settings, is_sqlite_mode
        return {
            "SQLITE_MODE": settings.SQLITE_MODE,
            "is_sqlite_mode": is_sqlite_mode(),
            "supabase_configured": bool(settings.SUPABASE_URL and settings.SUPABASE_KEY),
            "database_configured": bool(os.getenv("DATABASE_URL")),
            "environment": settings.ENVIRONMENT,
        }
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.get("/api/test-db")
async def test_db():
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        import os as _os
        import urllib.parse as _up

        safe_url = "url_parcial"

        # Tentativa com a URI original, mas com o nome de usuário simplificado
        # e garantindo que o '*' está corretamente escapado
        conn = psycopg2.connect(
            "postgresql://postgres:Mjm1978%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres",
            cursor_factory=RealDictCursor,
            sslmode='require',
            connect_timeout=10
        )

        cur = conn.cursor()
        cur.execute("SELECT 1 as test")
        res = cur.fetchone()
        conn.close()
        return {"status": "success", "result": res, "connected_to": safe_url}
    except Exception as e:
        return {
            "status": "error",
            "error_type": type(e).__name__,
            "error_message": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/api/app-status")
async def app_status():
    """Endpoint para diagnosticar o estado da aplicação principal"""
    try:
        from app.main import app as fastapi_app
        return {
            "status": "success",
            "message": "Aplicação principal carregada com sucesso",
            "routes": [route.path for route in fastapi_app.routes]
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "Erro ao carregar aplicação principal",
            "error_type": type(e).__name__,
            "error_message": str(e),
            "traceback": traceback.format_exc()
        }

try:
    from app.main import app as fastapi_app
    app.mount("/api", fastapi_app)
except Exception as e:
    @app.get("/api/{path:path}")
    async def fallback_route(path: str):
        return {
            "status": "error",
            "message": "Erro ao carregar aplicação principal",
            "error": str(e),
            "traceback": traceback.format_exc()
        }