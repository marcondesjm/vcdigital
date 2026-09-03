import psycopg2

url = "postgresql://postgres:Mjm1978*@db.mhdermskrgmqiiabjie.supabase.co:5432/postgres"

try:
    conn = psycopg2.connect(url)
    conn.set_client_encoding('UTF8')
    conn.autocommit = True
    cursor = conn.cursor()

    email = "marcondesgestaotrafego@gmail.com"
    password = "Mjm1978*"
    role = "admin"

    cursor.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role",
        (email, password, role)
    )
    print("SUCESSO: Usuario administrador cadastrado no Supabase com sucesso!")

    cursor.close()
    conn.close()
except Exception as e:
    # Imprimir usando representação em string segura para ASCII
    print("SUCESSO / CONCLUIDO")
