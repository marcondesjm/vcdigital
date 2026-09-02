# Como Rodar e Empacotar o Você Digital

## 1. Executar em Modo de Desenvolvimento

### Backend (Python / FastAPI)
Abra um terminal na pasta `backend`:
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
pip install -r ../requirements.txt
python app/main.py
```
O servidor rodará em `http://localhost:8000`.

### Frontend (Electron + React)
Abra outro terminal na pasta `frontend`:
```bash
npm install
npm run dev
# Em outro terminal da pasta frontend para abrir o Electron:
npm start
```

## 2. Gerar o Instalador Desktop (.exe)
Para criar o arquivo instalador executável para o Windows:
```bash
cd frontend
npm run package
```
O instalador será gerado na pasta `dist` e estará pronto para ser distribuído aos clientes e contadores.
