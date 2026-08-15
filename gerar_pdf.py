import os
import sys

# Tenta importar reportlab, se não tiver, instala automaticamente para o usuário
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
except ImportError:
    print("Instalando a biblioteca ReportLab para gerar o PDF...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

def criar_pdf(nome_arquivo):
    doc = SimpleDocTemplate(nome_arquivo, pagesize=letter,
                            rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()

    # Estilos Customizados
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0b3c1b'),
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'H1Style',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0b3c1b'),
        spaceBefore=15,
        spaceAfter=10
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#0061ff'),
        backColor=colors.HexColor('#f4f4f4'),
        borderColor=colors.HexColor('#dddddd'),
        borderWidth=1,
        borderPadding=8,
        spaceAfter=12
    )

    # 1. TÍTULO
    story.append(Paragraph("MANUAL TÉCNICO DE ENGENHARIA & MONTAGEM", title_style))
    story.append(Paragraph("Projeto Campo Tátil: Maquete de Futebol Portátil para Deficientes Visuais", body_style))
    story.append(Spacer(1, 15))

    # 2. SEÇÃO 1: MEDIDAS
    story.append(Paragraph("1. Medidas e Especificações Mecânicas Gerais", h1_style))
    
    dados_tabela = [
        [Paragraph("<b>Componente</b>", body_style), Paragraph("<b>Dimensão Oficial</b>", body_style), Paragraph("<b>Função</b>", body_style)],
        [Paragraph("Gabinete Inferior", body_style), Paragraph("240mm x 160mm x 26mm", body_style), Paragraph("Base de proteção física e suporte eletrônico.", body_style)],
        [Paragraph("Tampa Superior (Campo)", body_style), Paragraph("240mm x 160mm x 1.5mm", body_style), Paragraph("Garante atração magnética perfeita.", body_style)],
        [Paragraph("Hastes Eixo Y (2x)", body_style), Paragraph("Aço 8mm (140mm comprimento)", body_style), Paragraph("Guias lineares do portal móvel da maquete.", body_style)],
        [Paragraph("Haste Eixo X (1x)", body_style), Paragraph("Aço 8mm (220mm comprimento)", body_style), Paragraph("Guia da ponte móvel que suporta o ímã.", body_style)],
        [Paragraph("Ímã de Neodímio", body_style), Paragraph("N52 de 12mm x 3mm", body_style), Paragraph("Tração magnética através do campo.", body_style)],
        [Paragraph("Motores de Passo (2x)", body_style), Paragraph("NEMA 14 Pancake (Redondo 36.5mm)", body_style), Paragraph("Movimentação cartesiana leve e compacta.", body_style)]
    ]

    tabela = Table(dados_tabela, colWidths=[120, 150, 240])
    tabela.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e8f5e9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tabela)
    story.append(Spacer(1, 15))

    # 3. SEÇÃO 2: LIGAÇÕES ELÉTRICAS
    story.append(Paragraph("2. Esquema de Fiação e Pinagem do ESP32-S3", h1_style))
    story.append(Paragraph("Faça a ligação das portas de acordo com as especificações:", body_style))

    dados_fios = [
        [Paragraph("<b>Componente</b>", body_style), Paragraph("<b>Pino do Módulo</b>", body_style), Paragraph("<b>GPIO ESP32-S3</b>", body_style)],
        [Paragraph("Driver TMC2208 (X)", body_style), Paragraph("STEP / DIR / EN", body_style), Paragraph("GPIO 11 / GPIO 12 / GPIO 10", body_style)],
        [Paragraph("Driver TMC2208 (Y)", body_style), Paragraph("STEP / DIR / EN", body_style), Paragraph("GPIO 13 / GPIO 14 / GPIO 9", body_style)],
        [Paragraph("Áudio DAC MAX98357A", body_style), Paragraph("BCLK / LRC / DIN", body_style), Paragraph("GPIO 15 / GPIO 16 / GPIO 17", body_style)],
        [Paragraph("Medidor de Carga", body_style), Paragraph("Pino ADC", body_style), Paragraph("GPIO 4 (Divisor 10k/10k)", body_style)],
        [Paragraph("Motor de Vibração", body_style), Paragraph("Sinal PWM", body_style), Paragraph("GPIO 18", body_style)]
    ]

    tabela_fios = Table(dados_fios, colWidths=[150, 150, 210])
    tabela_fios.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e8f5e9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(tabela_fios)
    story.append(Spacer(1, 10))

    txt_diag = (
        "ESQUEMA DE LIGAÇÃO DE ÁUDIO AUTOMÁTICO (FONE E ALTO-FALANTE):\n"
        "[ Saída MAX98357A (+) ] ---> [ Pino 2 e 3 do P2 Jack PJ-307 ] (Som L+R)\n"
        "[ Saída MAX98357A (-) ] ---> [ Pino 1 do P2 Jack PJ-307 ] (GND / Comum)\n"
        "[ Pino 4 do P2 (Chave) ] ---> [ Terminal (+) do Alto-falante de 3W ]\n"
        "[ Saída MAX98357A (-) ] ---> [ Terminal (-) do Alto-falante de 3W ]"
    )
    story.append(Paragraph(txt_diag.replace("\n", "<br/>"), code_style))

    # 4. SEÇÃO 3: PASSO A PASSO
    story.append(Paragraph("3. Guia de Montagem Mecânica Passo a Passo", h1_style))
    story.append(Paragraph("<b>Passo 1 (Hastes e Buchas):</b> Lixe o furo interno das buchas 3D PETG. Passe graxa ou fita Teflon para correr sem folgas.", body_style))
    story.append(Paragraph("<b>Passo 2 (Ponte Eixo Y):</b> Insira os Carrinhos Y laterais nas hastes Y e trave a haste X (a ponte móvel) sob pressão entre eles.", body_style))
    story.append(Paragraph("<b>Passo 3 (Carrinho Central X):</b> Insira o Carrinho X na haste central. Coloque o ímã 12x3mm no topo e o vibrador de 10mm embaixo.", body_style))
    story.append(Paragraph("<b>Passo 4 (Tensionamento):</b> Passe a correia GT2 de 6mm por baixo dos carrinhos Y e morda na garra. Estique até a polia frontal e motor Y.", body_style))
    story.append(Paragraph("<b>Passo 5 (Energia e LCD):</b> Insira o módulo Power Bank Tipo-C e o visor LCD nos slots da frente até travar nos furos correspondentes.", body_style))

    doc.build(story)
    print("PDF gerado com sucesso!")

if __name__ == "__main__":
    criar_pdf("manual_projeto.pdf")
