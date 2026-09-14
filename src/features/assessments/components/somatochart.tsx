"use client";

import type { SomatotypeResult } from "@/core/anthropometry/somatotype";
import { classifySomatotype } from "@/core/anthropometry/somatotype";

interface SomatochartProps {
  result: SomatotypeResult;
}

/**
 * Somatocarta Heath-Carter
 *
 * Triángulo invertido con tres vértices:
 *   Endomorfia (izquierda), Mesomorfia (arriba), Ectomorfia (derecha)
 *
 * El punto se ubica con:
 *   X = Ectomorfia − Endomorfia
 *   Y = 2 × Mesomorfia − (Endomorfia + Ectomorfia)
 *
 * Escala estándar: −8 a +8 en X, −10 a +16 en Y
 */
export function Somatochart({ result }: SomatochartProps) {
  const { endomorphy, mesomorphy, ectomorphy, x, y } = result;
  const classification = classifySomatotype(result);

  // SVG dimensions
  const width = 360;
  const height = 340;
  const cx = width / 2;
  const cy = 175;

  // Escala: mapear rango real a píxeles
  const scaleX = 18; // px por unidad
  const scaleY = 12; // px por unidad

  // Punto del somatotipo en coordenadas SVG
  const px = cx + x * scaleX;
  const py = cy - y * scaleY;

  // Triángulo de la somatocarta (invertido)
  // Vértices: Mesomorfia arriba, Endomorfia abajo-izquierda, Ectomorfia abajo-derecha
  const triPoints = [
    `${cx},${cy - 14 * scaleY}`,          // Mesomorfia (arriba)
    `${cx - 8 * scaleX},${cy + 6 * scaleY}`, // Endomorfia (abajo izquierda)
    `${cx + 8 * scaleX},${cy + 6 * scaleY}`, // Ectomorfia (abajo derecha)
  ].join(" ");

  // Líneas de cuadrícula radiales desde el centro
  const gridLines = [
    { x1: cx, y1: cy - 14 * scaleY, label: "MESO" },
    { x1: cx - 8 * scaleX, y1: cy + 6 * scaleY, label: "ENDO" },
    { x1: cx + 8 * scaleX, y1: cy + 6 * scaleY, label: "ECTO" },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-text">Somatocarta</h4>
        <span className="text-xs px-2 py-1 rounded-full bg-primary-light text-primary font-medium">
          {classification}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-w-[360px] mx-auto">
        {/* Fondo */}
        <rect width={width} height={height} fill="transparent" />

        {/* Triángulo principal */}
        <polygon
          points={triPoints}
          fill="none"
          stroke="var(--color-border, #e2e8f0)"
          strokeWidth="1.5"
        />

        {/* Líneas radiales desde el centro */}
        {gridLines.map((line, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={line.x1}
            y2={line.y1}
            stroke="var(--color-border, #e2e8f0)"
            strokeWidth="0.5"
            strokeDasharray="4,4"
          />
        ))}

        {/* Círculos concéntricos de referencia */}
        {[2, 4, 6].map((r) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r * scaleX * 0.7}
            fill="none"
            stroke="var(--color-border, #e2e8f0)"
            strokeWidth="0.5"
            strokeDasharray="2,3"
          />
        ))}

        {/* Cruz central */}
        <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke="var(--color-muted, #94a3b8)" strokeWidth="0.5" />
        <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke="var(--color-muted, #94a3b8)" strokeWidth="0.5" />

        {/* Etiquetas de vértices */}
        <text x={cx} y={cy - 14 * scaleY - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-primary, #2a9d8f)">
          MESO
        </text>
        <text x={cx - 8 * scaleX - 4} y={cy + 6 * scaleY + 14} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-accent, #f4a261)">
          ENDO
        </text>
        <text x={cx + 8 * scaleX + 4} y={cy + 6 * scaleY + 14} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-secondary, #457b9d)">
          ECTO
        </text>

        {/* Punto del somatotipo */}
        <circle cx={px} cy={py} r="6" fill="var(--color-primary, #2a9d8f)" opacity="0.2" />
        <circle cx={px} cy={py} r="3.5" fill="var(--color-primary, #2a9d8f)" />

        {/* Etiqueta del punto */}
        <text
          x={px + 10}
          y={py - 8}
          fontSize="9"
          fontWeight="600"
          fill="var(--color-text, #264653)"
        >
          {endomorphy}-{mesomorphy}-{ectomorphy}
        </text>
      </svg>

      {/* Valores numéricos debajo */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="rounded-lg bg-accent-light p-2">
          <p className="text-xs text-muted">Endomorfia</p>
          <p className="text-lg font-bold text-accent">{endomorphy}</p>
        </div>
        <div className="rounded-lg bg-primary-light p-2">
          <p className="text-xs text-muted">Mesomorfia</p>
          <p className="text-lg font-bold text-primary">{mesomorphy}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-2">
          <p className="text-xs text-muted">Ectomorfia</p>
          <p className="text-lg font-bold text-secondary">{ectomorphy}</p>
        </div>
      </div>

      <p className="text-xs text-muted text-center mt-2">
        Coordenadas: X={x}, Y={y}
      </p>
    </div>
  );
}
