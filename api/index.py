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
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            return {"status": "error", "message": "DATABASE_URL is not set"}

        safe_url = db_url.split("@")[-1] if "@" in db_url else "url_parcial"

        # Conexão direta com parâmetros fixos
        conn = psycopg2.connect(
            host="aws-1-us-west-2.pooler.supabase.com",
            database="postgres",
            user="postgres.mhdermskrgmqoiabjie",
            password="Mjm1978*",
            port=6543,
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