"""Hojas de revisión: recorta cada fila marcada (proximal completo + sodio, grasa saturada y parte comestible)
junto con lo que leyó el OCR, para corregir a mano en data/catalog/tcac-2018-corrections.csv.

Uso: data/sources/.venv/bin/python scripts/catalog/review_sheets.py [review|sample]
Salida: data/sources/review/sheet-NN.png o sample-NN.png (no versionado).
"""

import json
import sys
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OCR_DIR = ROOT / "data" / "sources" / "ocr"
OUT_DIR = ROOT / "data" / "sources" / "review"
SCALE = 4
ROWS_PER_SHEET = 6
HALF_ROW = 0.0115
FIELDS = ["moisture", "energyKcal", "energyKj", "protein", "fat", "carbsTotal", "carbsAvailable", "fiber", "ash", "sodium", "saturatedFat", "edibleFraction"]
SHORT = ["hum", "kcal", "kJ", "prot", "lip", "ch tot", "ch disp", "fibra", "ceniz", "Na", "g sat", "% com"]


def main():
    kind = sys.argv[1] if len(sys.argv) > 1 else "review"
    items = json.loads((OCR_DIR / f"{kind}.json").read_text())
    prefix = "sheet" if kind == "review" else kind
    pdf = pdfium.PdfDocument(str(ROOT / "data" / "sources" / "tcac_web.pdf"))
    pages = {}

    def render(number):
        if number not in pages:
            pages[number] = pdf[number - 1].render(scale=SCALE).to_pil()
        return pages[number]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(items), ROWS_PER_SHEET):
        tiles = []
        for item in items[start:start + ROWS_PER_SHEET]:
            left, right = render(item["page"]), render(item["page"] + 1)
            w, h = left.size
            y0, y1 = int((item["y"] - HALF_ROW) * h), int((item["y"] + HALF_ROW) * h)
            code = left.crop((int(0.06 * w), y0, int(0.115 * w), y1))
            strip = left.crop((int(0.555 * w), y0, int(0.94 * w), y1))
            pieces = [code, strip]
            for key in ("sodium", "saturatedFat", "edibleFraction"):
                x = item["rightX"].get(key)
                if x is not None:
                    pieces.append(right.crop((int((x - 0.025) * w), y0, int((x + 0.025) * w), y1)))
            row_width = sum(p.width for p in pieces) + 12 * len(pieces)
            values = "  ".join(f"{s}={item['values'][f] if item['values'][f] is not None else '-'}" for s, f in zip(SHORT, FIELDS))
            tile = Image.new("RGB", (row_width, strip.height + 44), "white")
            draw = ImageDraw.Draw(tile)
            draw.text((4, 2), f"{item['code']}  p{item['page']}  {'; '.join(item['issues'])}", fill="red")
            draw.text((4, 16), values, fill="black")
            x = 0
            for piece in pieces:
                tile.paste(piece, (x, 32))
                x += piece.width + 12
            tiles.append(tile)
        width = max(t.width for t in tiles)
        sheet = Image.new("RGB", (width, sum(t.height + 8 for t in tiles)), "white")
        y = 0
        for tile in tiles:
            sheet.paste(tile, (0, y))
            y += tile.height + 8
        sheet.save(OUT_DIR / f"{prefix}-{start // ROWS_PER_SHEET + 1:02d}.png")
    print(f"{len(items)} filas en {(len(items) + ROWS_PER_SHEET - 1) // ROWS_PER_SHEET} hojas")


if __name__ == "__main__":
    main()
