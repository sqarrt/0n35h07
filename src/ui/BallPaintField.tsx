import { useRef, useEffect, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { BALL_ART_SIZE, cellInDisc } from '../game/ballArt'

// Круглое поле рисования 32×32: canvas в натуральных пикселях, растянутый CSS до FIELD_PX
// (image-rendering: pixelated). Родитель владеет гридом (Uint8Array(1024)); поле лишь рисует его
// и сообщает о покраске клетки. Клетки вне вписанного круга не кликабельны и сливаются с фоном.
const FIELD_PX = 132          // экранный размер поля (фикс — без «прыжков» интерфейса)
const CELL = FIELD_PX / BALL_ART_SIZE
const COL_BG = '#0b1020'      // вне диска / фон
const COL_INK = '#000000'     // закрашенная клетка
const COL_PAPER = '#cdd6f0'   // пустая клетка внутри диска

/** Перерисовать поле целиком из грида. */
function paintCanvas(ctx: CanvasRenderingContext2D, grid: Uint8Array) {
  ctx.fillStyle = COL_BG
  ctx.fillRect(0, 0, FIELD_PX, FIELD_PX)
  for (let cy = 0; cy < BALL_ART_SIZE; cy++) {
    for (let cx = 0; cx < BALL_ART_SIZE; cx++) {
      if (!cellInDisc(cx, cy)) continue
      ctx.fillStyle = grid[cy * BALL_ART_SIZE + cx] ? COL_INK : COL_PAPER
      ctx.fillRect(cx * CELL, cy * CELL, CELL - 1, CELL - 1)
    }
  }
}

interface Props {
  label: string
  grid: Uint8Array
  erasing: boolean
  onPaint: (cx: number, cy: number, value: number) => void
  onClear: () => void
  clearLabel: string
  testid: string
}

export function BallPaintField({ label, grid, erasing, onPaint, onClear, clearLabel, testid }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) paintCanvas(ctx, grid)
  }, [grid])

  const cellFromEvent = useCallback((e: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = Math.floor(((e.clientX - rect.left) / rect.width) * BALL_ART_SIZE)
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * BALL_ART_SIZE)
    return { cx, cy }
  }, [])

  const apply = useCallback((e: ReactPointerEvent) => {
    const { cx, cy } = cellFromEvent(e)
    if (cx < 0 || cy < 0 || cx >= BALL_ART_SIZE || cy >= BALL_ART_SIZE) return
    if (!cellInDisc(cx, cy)) return
    onPaint(cx, cy, erasing ? 0 : 1)
  }, [cellFromEvent, onPaint, erasing])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{ color: '#556', fontSize: '0.6rem', letterSpacing: '0.15em' }}>{label}</div>
      <canvas
        ref={canvasRef}
        width={FIELD_PX}
        height={FIELD_PX}
        data-testid={testid}
        style={{ width: FIELD_PX, height: FIELD_PX, imageRendering: 'pixelated', borderRadius: '50%', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); apply(e) }}
        onPointerMove={(e) => { if (drawing.current) apply(e) }}
        onPointerUp={() => { drawing.current = false }}
        onPointerLeave={() => { drawing.current = false }}
      />
      <button className="seg" data-testid={`${testid}-clear`} onClick={onClear}>{clearLabel}</button>
    </div>
  )
}
