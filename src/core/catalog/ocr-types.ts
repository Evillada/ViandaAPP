/** Caja de texto del OCR, en coordenadas relativas a la página con origen arriba a la izquierda. */
export interface OcrBox {
  text: string;
  conf: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Caja del encabezado vertical (leído rotado): sólo importa su posición horizontal. */
export interface HeaderBox {
  text: string;
  conf: number;
  x: number;
  w: number;
}

export interface OcrPage {
  page: number;
  width: number;
  height: number;
  boxes: OcrBox[];
  headerBoxes?: HeaderBox[];
}
