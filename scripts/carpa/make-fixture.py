"""Gera uma folha de cálculo SINTÉTICA (apenas para testes) com a estrutura de dez folhas do Atlas Ibérico da Carpa.

Os valores são fictícios e identificados como tal; servem para testar a importação e a regra de classificação
(três casos de regressão: setores e modalidades da Aguieira, documento da Extremadura sobre achigã, regra que
termina em dezembro de 2026). Não usar como fonte de informação sobre nenhuma água.

Uso: python3 scripts/carpa/make-fixture.py e2e/fixtures/carpa-sintetico.xlsx
"""
import sys
from datetime import date
from openpyxl import Workbook

out = sys.argv[1] if len(sys.argv) > 1 else "e2e/fixtures/carpa-sintetico.xlsx"
wb = Workbook()
wb.remove(wb.active)

def sheet(name, header, rows, title=None):
    ws = wb.create_sheet(name)
    if title:
        ws.append([title])
    ws.append(header)
    for r in rows:
        ws.append(r)

sheet("Leia-me", ["Nota"], [["DADOS SINTÉTICOS — apenas para testes automáticos da Lanceo (designação anterior: Lança Lance)."]])

INV = ["ID registo", "País", "Água", "Setor", "Tipo", "Distrito/Província", "Latitude", "Longitude",
       "Lat A", "Lon A", "Lat B", "Lon B", "Limites do setor", "Presença carpa", "Regime", "Espécie", "Modalidade",
       "Pesca noturna", "Devolução", "Licença", "Época", "Gestor", "Início vigência", "Fim vigência",
       "Organismo", "URL", "Referência documental", "Idioma", "Última verificação", "Acesso margem", "Notas"]
I = []
# 1) Aguieira (SINTÉTICO): dois setores de margem; carpfishing noturno no S1; provas e pesca individual no S2.
I.append(["T-001", "PT", "Albufeira da Aguieira", "Setor S1 (sintético)", "Albufeira", "Coimbra", 40.343, -8.196,
          40.3401, -8.2102, 40.3489, -8.1923, "Entre o ponto A e o ponto B (texto sintético)", "Sim", "Permitida", "Carpa",
          "Carpfishing noturno", "Sim", "Sim", "Licença de pesca desportiva", None, None, date(2026, 1, 1), date(2027, 12, 31),
          "ICNF (sintético)", "https://exemplo.invalid/icnf/edital-1", "Edital sintético 1/2026", "pt", date(2026, 10, 1), "Público (sintético)", "SINTÉTICO"])
I.append(["T-002", "PT", "Albufeira da Aguieira", "Setor S2 (sintético)", "Albufeira", "Coimbra", 40.352, -8.180,
          None, None, None, None, None, "Sim", "Permitida", "Carpa", "Provas organizadas", None, None, None, None, "Federação (sintético)",
          date(2026, 1, 1), date(2027, 12, 31), "ICNF (sintético)", "https://exemplo.invalid/icnf/edital-2", "Edital sintético 2/2026", "pt", date(2026, 10, 1), None, "SINTÉTICO"])
I.append(["T-003", "PT", "Albufeira da Aguieira", "Setor S2 (sintético)", "Albufeira", "Coimbra", 40.352, -8.180,
          None, None, None, None, None, "Sim", "Permitida", "Carpa", "Pesca individual", None, None, None, None, None,
          date(2026, 1, 1), date(2027, 12, 31), "ICNF (sintético)", "https://exemplo.invalid/icnf/edital-2", "Edital sintético 2/2026", "pt", date(2026, 10, 1), None, "SINTÉTICO"])
# 2) Extremadura (SINTÉTICO): documento sobre achigã (black-bass); nada sobre carpa.
I.append(["T-004", "ES", "Embalse de Alcántara", None, "Embalse", "Cáceres", 39.72, -6.46,
          None, None, None, None, None, "Sí", "Permitida", "Achigã", "Pesca individual", None, None, None, None, None,
          date(2026, 3, 1), date(2026, 10, 31), "Junta de Extremadura (sintético)", "https://exemplo.invalid/junta/orden", "Orden sintética", "es", date(2026, 9, 1), None, "SINTÉTICO"])
# 3) Regra que termina em dezembro de 2026 (SINTÉTICO), com vírgula decimal e DMS.
I.append(["T-005", "PT", "Albufeira de Castelo do Bode", "Margem norte (sintético)", "Albufeira", "Santarém", "39,601", "-8,247",
          None, None, None, None, None, "Sim", "Permitida", "Carpa", "Pesca individual", "Não", "Não", None, None, None,
          date(2026, 1, 1), date(2026, 12, 31), "ICNF (sintético)", "https://exemplo.invalid/icnf/edital-3", "Edital sintético 3/2026", "pt", date(2026, 6, 1), None, "SINTÉTICO"])
# 4) Evidência independente da mesma água/setor (outra fonte): não duplica, junta proveniência.
I.append(["T-006", "PT", "Albufeira de Castelo do Bode", "Margem norte (sintético)", "Albufeira", "Santarém", None, None,
          None, None, None, None, None, "Sim", None, None, None, None, None, None, None, None,
          None, None, "Clube de pesca (sintético)", "https://exemplo.invalid/clube", None, "pt", None, None, "SINTÉTICO"])
# 5) Água sem coordenadas (pesquisável em lista).
I.append(["T-007", "ES", "Río Tajo", "Tramo urbano (sintético)", "Río", "Toledo", None, None,
          None, None, None, None, "Entre dos puentes (texto sintético)", "Desconocido", None, None, None, None, None, None, None, None,
          None, None, None, None, None, "es", None, None, "SINTÉTICO"])
# 6) Homónimos: mesmo nome, províncias diferentes (para revisão; ficam separados).
I.append(["T-008", "ES", "Embalse de San Juan", None, "Embalse", "Madrid", 40.38, -4.32, None, None, None, None, None, "Sí", None, None, None, None, None, None, None, None, None, None, None, None, None, "es", None, None, "SINTÉTICO"])
I.append(["T-009", "ES", "Embalse de San Juan", None, "Embalse", "Ávila", 40.60, -4.70, None, None, None, None, None, "Sí", None, None, None, None, None, None, None, None, None, None, None, None, None, "es", None, None, "SINTÉTICO"])
# 7) Eixos trocados (lat/lon) → revisão; coordenadas não usadas.
I.append(["T-010", "PT", "Açude de Coimbra (sintético)", None, "Açude", "Coimbra", -8.43, 40.20, None, None, None, None, None, "Sim", None, None, None, None, None, None, None, None, None, None, None, None, None, "pt", None, None, "SINTÉTICO"])
# 8) Proibição expressa (SINTÉTICO).
I.append(["T-011", "ES", "Embalse de Valdecañas", "Zona de baño (sintético)", "Embalse", "Cáceres", 39.81, -5.48, None, None, None, None, None, "Sí", "Prohibida", "Todas", "Todas", None, None, None, None, None,
          date(2026, 1, 1), date(2027, 12, 31), "Confederación Hidrográfica del Tajo (sintético)", "https://exemplo.invalid/cht", "Resolución sintética", "es", date(2026, 10, 15), "Restringido", "SINTÉTICO"])
sheet("Águas e setores", INV, I, title="Inventário — SINTÉTICO")

sheet("Candidatos", ["ID registo", "País", "Água", "Notas"], [
    ["C-001", "PT", "Albufeira do Maranhão", "Candidato sintético"],
    ["C-002", "ES", "Embalse de Alcántara", "Candidato sintético já no inventário (sobreposição)"],
])
sheet("Zonas de pesca lúdica PT", ["ID registo", "Água", "Distrito", "Estado", "Fim vigência", "Organismo"], [
    ["Z-001", "Albufeira da Aguieira", "Coimbra", "Ativa", date(2027, 12, 31), "ICNF (sintético)"],
    ["Z-002", "Albufeira de Castelo do Bode", "Santarém", "Extinta", date(2025, 6, 30), "ICNF (sintético)"],
])
sheet("Exclusões", ["ID registo", "Água", "Motivo"], [["X-001", "Lagoa das Sete Cidades", "Fora do âmbito (Açores)"]])
sheet("Cobertura regional", ["Região", "Registos"], [["Centro", 3], ["Extremadura", 3]])
sheet("Síntese", ["ID registo", "Resumo"], [["T-001", "Aguieira S1"], ["T-999", "Referência a registo inexistente (sintético)"]])
sheet("Novidades", ["ID registo", "Alteração"], [["T-005", "Regra com termo em 2026 (sintético)"]])
sheet("Fontes GIS", ["Organismo", "URL", "Referência documental", "Idioma"], [
    ["SNIRH (sintético)", "https://exemplo.invalid/snirh", "Camada de albufeiras", "pt"],
    ["CEDEX (sintético)", "https://exemplo.invalid/cedex", "Inventario de presas", "es"],
])
sheet("Auditoria", ["Verificação", "Resultado"], [["Totais por país", "OK (sintético)"]])
wb.save(out)
print(f"Escrito {out} ({len(wb.sheetnames)} folhas)")
