import os
from supabase import create_client, Client

url: str = "https://mhdermskrgmqiiabjie.supabase.co"
# Usamos a service role key ou anon key (no Supabase podemos usar a service role key do dashboard ou inserir na tabela users)
# Como a tabela users pode ter RLS, vamos usar a chave anon ou service role se disponível.
# Mas como criamos via SQL as politicas, vamos inserir via postgrest.

key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZGVybXNrcmdtcWlpYWJqaWUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMDAwMDAwMCwiZXhwIjoyMDUwMDAwMDAwfQ==" # (substitua ou use psycopg2 com utf-8 puro)
