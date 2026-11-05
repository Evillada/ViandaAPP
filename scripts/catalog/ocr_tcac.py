"""Vuelca el OCR de las tablas nutricionales de la TCAC 2018 a JSON.

Sólo extrae cajas de texto con coordenadas relativas a la página (origen arriba a la izquierda).
Toda la interpretación (filas, columnas, números, validación) vive en src/core/catalog/.
Ver scripts/catalog/README.md.

Uso:
  ocr_tcac.py [páginas...]   lectura de página completa (original y en gris)
  ocr_tcac.py --cells        relee una a una las celdas listadas en ocr/recheck.json
"""

import json
import re
import sys
from pathlib import Path

import pypdfium2 as pdfium
from ocrmac import ocrmac
from PIL import ImageOps

ROOT = Path(__file__).resolve().parents[2]
PDF_PATH = ROOT / "data" / "sources" / "tcac_web.pdf"
OUT_DIR = ROOT / "data" / "sources" / "ocr"
FIRST_PAGE, LAST_PAGE = 43, 108
SCALE = 4
CELL_SCALE = 6
CELL_PADDING = 40
HEADER_TOP = 0.05
CODE_PATTERN = re.compile(r"^[A-Z]\d{3}$")


def recognize(image):
    return ocrmac.OCR(image, recognition_level="accurate", language_preference=["es-ES"]).recognize()


def gray(image):
    """El fondo verde oscuro de filas alternas hace que Vision omita cifras; en gris con contraste lee más."""
    return ImageOps.autocontrast(ImageOps.grayscale(image), cutoff=2).convert("RGB")


def page_boxes(image):
    boxes = []
    for text, conf, (x, y, w, h) in recognize(image):
        boxes.append({"text": text, "conf": round(conf, 3), "x": x, "y": 1 - y - h, "w": w, "h": h})
    return boxes


def header_boxes(image, boxes):
    """Los encabezados van en vertical: se rota el recorte para leerlos.

    El recorte termina justo encima de la primera fila de datos, porque las páginas que abren
    sección llevan el título del grupo y el encabezado queda más abajo.
    """
    width, height = image.size
    code_tops = [b["y"] for b in boxes if CODE_PATTERN.match(b["text"].strip())]
    if not code_tops:
        return []
    top, bottom = int(height * HEADER_TOP), int(height * (min(code_tops) - 0.003))
    rotated = image.crop((0, top, width, bottom)).rotate(-90, expand=True)
    boxes = []
    for text, conf, (x, y, w, h) in recognize(rotated):
        # En la imagen rotada, el eje vertical corresponde al eje x original de la página.
        center_x = 1 - y - h / 2
        boxes.append({"text": text, "conf": round(conf, 3), "x": center_x - h / 2, "w": h})
    return boxes


def read_pages(pages):
    pdf = pdfium.PdfDocument(str(PDF_PATH))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for number in pages:
        page = pdf[number - 1]
        width, height = page.get_size()
        image = page.render(scale=SCALE).to_pil()
        data = {"page": number, "width": width, "height": height, "boxes": page_boxes(image)}
        data["boxesGray"] = page_boxes(gray(image))
        data["headerBoxes"] = header_boxes(image, data["boxes"])
        (OUT_DIR / f"page-{number:03d}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
        print(f"page {number}: {len(data['boxes'])} / {len(data['boxesGray'])} cajas")


def read_cells():
    """Recorta cada celda (con margen blanco) y la lee sola: tercer lector para celdas vacías o en conflicto."""
    cells = json.loads((OUT_DIR / "recheck.json").read_text())
    pdf = pdfium.PdfDocument(str(PDF_PATH))
    rendered = {}
    reads = {}
    for cell in cells:
        number = cell["page"]
        if number not in rendered:
            rendered[number] = gray(pdf[number - 1].render(scale=CELL_SCALE).to_pil())
        image = rendered[number]
        width, height = image.size
        crop = image.crop((int(cell["x0"] * width), int(cell["y0"] * height), int(cell["x1"] * width), int(cell["y1"] * height)))
        padded = ImageOps.expand(crop, border=CELL_PADDING, fill="white")
        reads[cell["id"]] = " ".join(text for text, _, _ in recognize(padded)).strip()
    (OUT_DIR / "cell-reads.json").write_text(json.dumps(reads, ensure_ascii=False, indent=1))
    print(f"{len(reads)} celdas leídas")


if __name__ == "__main__":
    if sys.argv[1:] == ["--cells"]:
        read_cells()
    else:
        read_pages([int(arg) for arg in sys.argv[1:]] or list(range(FIRST_PAGE, LAST_PAGE + 1)))
