#!/usr/bin/env python3
"""Resumen de 1 pagina del estudio SOSA 2026 (RevenueCat); paleta DPL."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)

# ---- Paleta DPL (de src/app/globals.css) ----
INK    = colors.HexColor("#1A1A1A")   # foreground
MUTED  = colors.HexColor("#6B6657")   # muted (warm grey)
GOLD   = colors.HexColor("#D18A1F")   # color-gold (acento principal)
GOLD_D = colors.HexColor("#8A5A12")   # oro oscuro p/ texto sobre oro
TERRA  = colors.HexColor("#D97757")   # color-streak (acento secundario)
CREAM  = colors.HexColor("#F6F4EE")   # background
BEIGE  = colors.HexColor("#F1ECE0")   # chip-bg
BORDER = colors.HexColor("#E3DCCB")   # warm border
WHITE  = colors.white

W = 522  # ancho util (pt)

def st(name, **kw):
    base = dict(fontName="Helvetica", fontSize=7.6, leading=9.6, textColor=INK)
    base.update(kw); return ParagraphStyle(name, **base)

s_eyebrow = st("eye", fontName="Helvetica-Bold", fontSize=7.5, leading=8,
               textColor=GOLD, spaceAfter=1)
s_title   = st("title", fontName="Helvetica-Bold", fontSize=19, leading=20, textColor=INK)
s_sub     = st("sub", fontSize=7.6, leading=9.6, textColor=MUTED)
s_sec     = st("sec", fontName="Helvetica-Bold", fontSize=10.5, leading=11, textColor=INK)
s_body    = st("body", fontSize=7.7, leading=9.8)
s_lead    = st("lead", fontSize=7.7, leading=9.8)   # con <b> en oro via markup
s_bignum  = st("bignum", fontName="Helvetica-Bold", fontSize=17, leading=16, textColor=TERRA)
s_insl    = st("insl", fontName="Helvetica-Bold", fontSize=8.2, leading=9.4, textColor=INK)
s_insd    = st("insd", fontSize=7.0, leading=8.6, textColor=MUTED)
s_th      = st("th", fontName="Helvetica-Bold", fontSize=7.1, leading=8.4, textColor=GOLD_D)
s_td      = st("td", fontSize=7.3, leading=8.8, textColor=INK)
s_tdb     = st("tdb", fontName="Helvetica-Bold", fontSize=7.3, leading=8.8, textColor=INK)
s_foot    = st("foot", fontSize=6.3, leading=7.8, textColor=MUTED)

story = []

# ===== CABECERA =====
story.append(Paragraph("INFORME DE REFERENCIA &nbsp;·&nbsp; 2026", s_eyebrow))
story.append(Paragraph("State of Subscription Apps", s_title))
story.append(Spacer(1, 2.5))
story.append(Paragraph(
    "RevenueCat &nbsp;·&nbsp; Resumen ejecutivo &nbsp;·&nbsp; Base: +115.000 apps, +16 mil M USD "
    "en ingresos y +1.000 M de transacciones (datos 2025; iOS / Android / web).", s_sub))
story.append(Spacer(1, 6))
story.append(Table([[""]], colWidths=[W], style=TableStyle(
    [("LINEBELOW",(0,0),(-1,-1),2, GOLD),("TOPPADDING",(0,0),(-1,-1),0),
     ("BOTTOMPADDING",(0,0),(-1,-1),0)])))
story.append(Spacer(1, 9))

# ===== helper: encabezado de seccion (tick terracota + label) =====
def section(label):
    return Table(
        [[ "", Paragraph(label, s_sec) ]],
        colWidths=[7, W-7],
        style=TableStyle([
            ("BACKGROUND",(0,0),(0,0), TERRA),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("LEFTPADDING",(0,0),(0,0),0),("RIGHTPADDING",(0,0),(0,0),0),
            ("LEFTPADDING",(1,0),(1,0),7),("RIGHTPADDING",(1,0),(1,0),0),
            ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
        ]))

# ===== NIVEL 1: 6 IDEAS CLAVE =====
story.append(section("Las 6 ideas clave"))
story.append(Spacer(1, 6))

def insight(num, label, detail):
    return Table(
        [[Paragraph(num, s_bignum)],
         [Spacer(1,1)],
         [Paragraph(label, s_insl)],
         [Paragraph(detail, s_insd)]],
        colWidths=[156],
        style=TableStyle([("LEFTPADDING",(0,0),(-1,-1),9),("RIGHTPADDING",(0,0),(-1,-1),9),
                          ("TOPPADDING",(0,0),(0,0),7),("BOTTOMPADDING",(0,0),(0,0),0),
                          ("TOPPADDING",(0,2),(-1,-1),0),("BOTTOMPADDING",(0,3),(-1,-1),7)]))

ins = [
    ("80%+", "La brecha se acelera", "El 25% top crecio 80% interanual; el 25% inferior se contrajo 33%. Mercado winner-take-more."),
    ("5x", "Hard paywall convierte mas", "Pedir pago al inicio convierte 5x mejor (10,7% vs 2,1%), pero al ano la retencion se iguala."),
    ("55%", "La ventana se cierra", "El 55% de las cancelaciones de trials de 3 dias ocurren el Dia 0. El usuario se gana en la 1.a sesion."),
    ("31%", "Fuga de Google Play", "Casi 1/3 de las cancelaciones en Play son fallos de cobro involuntarios; mas del doble que App Store (14%)."),
    ("41%", "La IA vende, no fideliza", "Las apps con IA generan 41% mas ingreso por pagador, pero churnean 30% mas rapido."),
    ("70%", "Trials cada vez mas cortos", "Los trials de 17+ dias convierten 70% mejor (42,5% vs 25,5%), pero casi la mitad usa trials de <=4 dias."),
]
# acentos correctos
acc = {
 "crecio":"creció","ano":"año","retencion":"retención","Dia":"Día","sesion":"sesión",
 "mas":"más","churnean":"churnean","dias":"días","interanual":"interanual",
}
def fix(t):
    for k,v in acc.items(): t=t.replace(k,v)
    return t
ins = [(n, fix(l), fix(d)) for (n,l,d) in ins]

grid = Table(
    [[insight(*ins[0]), insight(*ins[1]), insight(*ins[2])],
     [insight(*ins[3]), insight(*ins[4]), insight(*ins[5])]],
    colWidths=[174,174,174])
grid.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,-1), BEIGE),
    ("LINEBELOW",(0,0),(-1,0), 4, WHITE),
    ("LINEAFTER",(0,0),(-2,-1), 4, WHITE),
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
    ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
    # franja superior de color por tarjeta
    ("LINEABOVE",(0,0),(-1,0),2.5, GOLD),
    ("LINEABOVE",(0,1),(-1,1),2.5, GOLD),
]))
story.append(grid)
story.append(Spacer(1, 11))

# ===== NIVEL 2: DATOS (dos columnas) =====
def htable(header, data, col_w):
    rows = [[Paragraph(h, s_th) for h in header]]
    for r in data:
        rows.append([Paragraph(str(c), s_tdb if j==0 else s_td) for j,c in enumerate(r)])
    tb = Table(rows, colWidths=col_w)
    tb.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), GOLD),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, CREAM]),
        ("LINEBELOW",(0,0),(-1,0),0,GOLD),
        ("LINEBELOW",(0,1),(-1,-2),0.4, BORDER),
        ("BOX",(0,0),(-1,-1),0.6, BORDER),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),5),
    ]))
    return tb

def lead(txt):  # parrafo con lead-in en oro
    return Paragraph(txt, s_lead)

price_tbl = htable(
    ["DURACION", "Comun", "Mediana", "Q3", "P90"],
    [["Semanal", "$5,00", "$5,90", "$8,10", "$10,0"],
     ["Mensual", "$10,00", "$8,00", "$13,50", "$22,70"],
     ["Anual",   "$30,00", "$34,80", "$58,10", "$90,0"]],
    [60, 40, 44, 42, 40])

left_col = [
    section("Precios por duracion") if False else None,
    price_tbl,
    Spacer(1, 4),
    lead("<font color='#D18A1F'><b>Mezcla de venta:</b></font> 42% mensual, 34% anual. Anclas "
         "psicológicas pegajosas ($5 / $10 / $30); el suelo de precio sube en todas las duraciones."),
    Spacer(1, 3),
    lead("<font color='#D18A1F'><b>Trials:</b></font> el 46,5% usa &le;4 días (en alza) pese a que los "
         "largos convierten mejor."),
    Spacer(1, 3),
    lead("<font color='#D18A1F'><b>Reverse trial</b></font> (premium temporal al cerrar el paywall, sin "
         "tarjeta): subió la conversión freemium de 0,4% a 4,5%."),
]
left_col = [x for x in left_col if x is not None]

edu_tbl = htable(
    ["EDUCATION", "Sem.", "Mens.", "Anual"],
    [["Mediana", "$6,26", "$9,99", "$44,99"],
     ["Q3 / P90", "$9,99", "$24,99", "$80 / $117"]],
    [62, 40, 44, 60])

right_col = [
    edu_tbl,
    Spacer(1, 4),
    lead("<font color='#D18A1F'><b>La que más cobra:</b></font> mediana anual $44,99, la más alta de las "
         "11 categorías (2,2x Travel). Education ‘commands premium pricing’."),
    Spacer(1, 3),
    lead("<font color='#D18A1F'><b>Vende anual:</b></font> 54-74% de las unidades son planes anuales; "
         "semanal solo 5-8%."),
    Spacer(1, 3),
    lead("<font color='#D18A1F'><b>Conversión con techo:</b></font> D35 download-to-paid 0,7% (IN/SEA) a "
         "2,7% (Norteamérica); trial-to-paid 18-37%. RLTV año-1/pagador $18 a $39 (top $91)."),
    Spacer(1, 3),
    lead("<font color='#D18A1F'><b>Conversión bimodal:</b></font> picos en Día 0 y en semana 6+. Muchos "
         "pagan tarde, tras el ‘aha’."),
]

# encabezados de las dos columnas alineados
col_heads = Table([[Paragraph("Precios por duración (mediana global, USD)", s_sec),
                     Paragraph("Foco: categoría Education", s_sec)]],
                  colWidths=[256, 266],
                  style=TableStyle([("LEFTPADDING",(0,0),(0,0),0),("RIGHTPADDING",(0,0),(0,0),12),
                                    ("LEFTPADDING",(1,0),(1,0),14),("RIGHTPADDING",(1,0),(1,0),0),
                                    ("BOTTOMPADDING",(0,0),(-1,-1),5),("TOPPADDING",(0,0),(-1,-1),0)]))
story.append(section("Datos para fijar precio"))
story.append(Spacer(1, 6))
story.append(col_heads)

two = Table([[left_col, right_col]], colWidths=[256, 266])
two.setStyle(TableStyle([
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(0,0),0),("RIGHTPADDING",(0,0),(0,0),12),
    ("LEFTPADDING",(1,0),(1,0),14),("RIGHTPADDING",(1,0),(1,0),0),
    ("LINEBEFORE",(1,0),(1,0),0.6, BORDER),
]))
story.append(two)
story.append(Spacer(1, 11))

# ===== NIVEL 3: CONCLUSIONES (banda crema) =====
pats = [
    "<font color='#8A5A12'><b>No infravalores:</b></font> un precio base más alto abre espacio a descuentos agresivos que convierten mejor y financian el CAC (que sube con ~15.000 apps nuevas/mes).",
    "<font color='#8A5A12'><b>El anual es el motor:</b></font> retiene 44% a 12 meses vs 17% mensual y 3,4% semanal; en Education es el 54-74% de la venta.",
    "<font color='#8A5A12'><b>Localización (PPP):</b></font> el experimento de mayor ROI medido (+62% LTV); IN/SEA paga ~50% de los mercados top y Europa 29-39% más que Norteamérica.",
    "<font color='#8A5A12'><b>Hard paywall vs freemium:</b></font> hard convierte 5x al inicio, pero la ventaja se evapora al año; freemium gana con conversión tardía y reverse trials.",
]
pat_items = []
for p in pats:
    pat_items.append(Paragraph("<font color='#D97757'><b>&rarr;</b></font>&nbsp;&nbsp;" + p, s_body))
    pat_items.append(Spacer(1, 3))

band_inner = [Paragraph("Patrones para fijar precio", s_sec), Spacer(1, 5)] + pat_items[:-1]
band = Table([[band_inner]], colWidths=[W],
             style=TableStyle([
                 ("BACKGROUND",(0,0),(-1,-1), CREAM),
                 ("LINEABOVE",(0,0),(-1,-1),2.5, TERRA),
                 ("LEFTPADDING",(0,0),(-1,-1),14),("RIGHTPADDING",(0,0),(-1,-1),14),
                 ("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),10),
             ]))
story.append(band)
story.append(Spacer(1, 7))

# ===== PIE =====
story.append(Paragraph(
    "Fuente: RevenueCat, <i>State of Subscription Apps 2026</i> (caps. Key insights, Pricing &amp; "
    "packaging, Funnel performance, Paywalls &amp; offers y Category breakout: Education; pp. 6, 73-85, "
    "187-193). Cifras en USD; medianas salvo indicación. Resumen interno.", s_foot))

# ==================================================================
# ===============  PAGINA 2; ANALISIS PROPIO (DPL)  ===============
# ==================================================================
story.append(PageBreak())

s_pll = st("pll", fontName="Helvetica-Bold", fontSize=7.3, leading=8.8, textColor=GOLD_D)
s_cap = st("cap", fontSize=7.5, leading=9.6, textColor=INK)
s_num = st("num", fontName="Helvetica-Bold", fontSize=10, leading=11, textColor=WHITE)

# ----- Cabecera p2 -----
story.append(Paragraph("ANALISIS PROPIO &nbsp;·&nbsp; APLICADO A DPL".replace("ANALISIS","ANÁLISIS"), s_eyebrow))
story.append(Paragraph("Qué significa para Digital Polyglot Library", s_title))
story.append(Spacer(1, 2.5))
story.append(Paragraph(
    "Cruce del estudio con el mercado de apps de idiomas y con el plan actual de DPL "
    "(Free &nbsp;/&nbsp; €149 año &nbsp;/&nbsp; €14,99 mes &nbsp;/&nbsp; trial 14 días &nbsp;/&nbsp; freemium).",
    s_sub))
story.append(Spacer(1, 6))
story.append(Table([[""]], colWidths=[W], style=TableStyle(
    [("LINEBELOW",(0,0),(-1,-1),2, GOLD),("TOPPADDING",(0,0),(-1,-1),0),
     ("BOTTOMPADDING",(0,0),(-1,-1),0)])))
story.append(Spacer(1, 9))

# ----- Mapa competitivo -----
story.append(section("Mapa competitivo; apps de idiomas (2025-26)"))
story.append(Spacer(1, 6))

comp_header = ["APP", "Mensual", "Anual", "Notas"]
comp_rows = [
    ["Duolingo Super", "$12,99", "$59,99", "+ tier IA ‘Max’ $29,99/mes"],
    ["Busuu", "$13,99", "$69,99", "freemium"],
    ["Mondly", "$9,99", "$59,99-89,99", "freemium"],
    ["Drops", "$13,00", "$69,99", "lifetime $159"],
    ["LingQ", "$14,99", "$107,88", "mismo mensual que DPL"],
    ["Babbel", "$13,95", "~$107", "casi sin free; lifetime $299"],
    ["Memrise", "$39,99", "$79,99", "mensual disuasorio; lifetime $329"],
    ["Pimsleur", "~$21", "~$165", "premium, sin free"],
    ["DPL (actual)", "€14,99", "€149", "solo 17% desc. anual"],
]
rows = [[Paragraph(h, s_th) for h in comp_header]]
for r in comp_rows:
    rows.append([Paragraph(str(c), s_tdb if j == 0 else s_td) for j, c in enumerate(r)])
comp_tbl = Table(rows, colWidths=[104, 70, 90, 258])
dpl_i = len(rows) - 1
comp_tbl.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0), GOLD),
    ("ROWBACKGROUNDS",(0,1),(-1,-2),[WHITE, CREAM]),
    ("BOX",(0,0),(-1,-1),0.6, BORDER),
    ("LINEBELOW",(0,1),(-1,-2),0.4, BORDER),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
    ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),5),
    # fila DPL destacada
    ("BACKGROUND",(0,dpl_i),(-1,dpl_i), BEIGE),
    ("LINEABOVE",(0,dpl_i),(-1,dpl_i),1.4, TERRA),
    ("LINEBELOW",(0,dpl_i),(-1,dpl_i),1.4, TERRA),
    ("TEXTCOLOR",(0,dpl_i),(0,dpl_i), TERRA),
]))
story.append(comp_tbl)
story.append(Spacer(1, 4))
story.append(Paragraph(
    "<font color='#D18A1F'><b>Banda del mercado:</b></font> el clúster anual de apps de idiomas vive en "
    "<b>$60-110</b> y el mensual en <b>$10-15</b>. El descuento anual habitual es de <b>50-60%</b> frente al "
    "mensual. <font color='#8A5A12'>(Precios de competidores no verificados en checkout; ver pie.)</font>", s_body))
story.append(Spacer(1, 11))

# ----- Donde cae DPL -----
story.append(section("Dónde cae DPL hoy"))
story.append(Spacer(1, 6))

diag = [
    ("Precio anual por encima del techo", TERRA,
     "€149 (~$160) supera el <b>P90 de Education ($117)</b>: cobras más que el 90% de las apps de la "
     "categoría. Agresivo; solo se sostiene como ancla con descuento, no como precio plano."),
    ("Descuento anual demasiado débil", TERRA,
     "Solo <b>17%</b> vs el <b>50-60%</b> del mercado. Como el anual es el plan que retiene (44% vs 17%) "
     "y el que más se vende en Education (54-74%), un descuento flojo sabotea tu mejor embudo."),
    ("Mensual bien posicionado", GOLD,
     "€14,99 está en banda alta-correcta, idéntico a LingQ. Sin cambios."),
    ("Freemium + conversión tardía", GOLD,
     "Tu tesis ‘primera historia terminada = aha’ encaja con la conversión bimodal de Education (pico en "
     "semana 6+). Apunta a <b>reverse trial</b>, no a hard paywall."),
    ("Sin localización PPP", TERRA,
     "Precio plano en EUR. Pierdes el experimento de mayor ROI medido (+62% LTV) con un público anglo "
     "repartido entre Norteamérica ($39 RLTV) y Europa Occidental ($33)."),
]
def chip(title, color, body):
    head = Table([["", Paragraph("<b>"+title+"</b>", s_cap)]], colWidths=[6, W-6-20],
                 style=TableStyle([("BACKGROUND",(0,0),(0,0),color),
                                   ("LEFTPADDING",(0,0),(0,0),0),("RIGHTPADDING",(0,0),(0,0),0),
                                   ("LEFTPADDING",(1,0),(1,0),7),("RIGHTPADDING",(1,0),(1,0),0),
                                   ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),1),
                                   ("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    return [head, Paragraph(body, s_insd), Spacer(1,5)]

diag_items = []
for t,c,b in diag:
    diag_items += chip(t,c,b)
story.extend(diag_items[:-1])
story.append(Spacer(1, 10))

# ----- Recomendaciones numeradas -----
story.append(section("Recomendaciones (ordenadas por evidencia)"))
story.append(Spacer(1, 6))

recs = [
    ("Reestructura el descuento anual, no bajes el precio base.",
     "Mantén un ancla alta y muestra promo agresiva (p. ej. ‘€149 €89 el primer año’). El estudio avisa: "
     "infravalorar cuesta; un precio base alto abre espacio a descuentos que convierten y financian el CAC."),
    ("Activa un reverse trial sobre el freemium.",
     "Premium temporal al cerrar el paywall, sin tarjeta. Palanca con mayor evidencia para freemium "
     "(0,4% → 4,5% en el estudio) y coherente con tu conversión tardía."),
    ("Implementa precios por país (PPP).",
     "Stripe y Google Play lo soportan. Mayor ROI medido (+62% LTV); ajusta a la baja IN/SEA/LatAm y "
     "sostén Europa/Norteamérica."),
    ("Mantén el trial en 14 días.",
     "Los trials largos convierten mejor (42,5% vs 25,5%); acortarlos solo acelera experimentación."),
    ("Evalúa un tier IA a futuro (~€20-25/mes).",
     "Estilo Duolingo Max. Sube el ingreso por pagador (+41%), pero vigila la retención (churn +30%)."),
]
rec_rows = []
for i,(t,b) in enumerate(recs, 1):
    numcell = Table([[Paragraph(str(i), s_num)]], colWidths=[16], rowHeights=[16],
                    style=TableStyle([("BACKGROUND",(0,0),(-1,-1), GOLD),
                                      ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(0,0),(-1,-1),"CENTER"),
                                      ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
                                      ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
    txt = Paragraph("<font color='#1A1A1A'><b>"+t+"</b></font>  <font color='#6B6657'>"+b+"</font>", s_body)
    rec_rows.append([numcell, txt])
rec_tbl = Table(rec_rows, colWidths=[16, W-16])
rec_tbl.setStyle(TableStyle([
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(0,-1),0),("RIGHTPADDING",(0,0),(0,-1),9),
    ("LEFTPADDING",(1,0),(1,-1),0),("RIGHTPADDING",(1,0),(1,-1),0),
    ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),5),
]))
story.append(rec_tbl)
story.append(Spacer(1, 9))

# ----- Caveats (verificado / no verificado) -----
cav_inner = [
    Paragraph("Alcance y límites de este análisis", s_sec), Spacer(1, 5),
    Paragraph("<font color='#1F8A4C'><b>Verificado:</b></font>  benchmarks de Education y patrones de "
              "precio/trial/retención extraídos directamente del PDF SOSA 2026 (pp. 6, 73-85, 187-193).", s_body),
    Spacer(1, 3),
    Paragraph("<font color='#B23B2E'><b>No verificado:</b></font>  los precios de competidores provienen de "
              "una búsqueda web (no reconfirmados en su checkout y sujetos a promos y a diferencias web vs "
              "store de ~30%); la conversión específica de un ‘tier IA’ en educación no está desglosada en el "
              "informe; los números de DPL son tu configuración actual, no una proyección de ingresos.", s_body),
]
cav = Table([[cav_inner]], colWidths=[W],
            style=TableStyle([("BACKGROUND",(0,0),(-1,-1), CREAM),
                              ("LINEABOVE",(0,0),(-1,-1),2.5, TERRA),
                              ("LEFTPADDING",(0,0),(-1,-1),14),("RIGHTPADDING",(0,0),(-1,-1),14),
                              ("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),10)]))
story.append(cav)

# ---- Documento 1 pagina ----
doc = BaseDocTemplate(OUT := "/Users/alejandrodelcarpio/digital-polyglot-library/SOSA-2026-resumen.pdf",
                      pagesize=A4, leftMargin=18*mm, rightMargin=18*mm,
                      topMargin=14*mm, bottomMargin=12*mm)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f", showBoundary=0)
doc.addPageTemplates([PageTemplate(id="main", frames=[frame])])
doc.build(story)
print("OK ->", OUT)
