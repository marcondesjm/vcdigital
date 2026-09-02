from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def create_pdf(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    c.drawString(100, 750, "VOCO DIGITAL - DOCUMENTO DE TESTE")
    c.drawString(100, 730, "Este e um arquivo PDF gerado automaticamente para testes de assinatura digital.")
    c.drawString(100, 710, "Data: 2024-05-20")
    c.save()

if __name__ == "__main__":
    create_pdf("documento_teste.pdf")
    print("PDF created: documento_teste.pdf")
