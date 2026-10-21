import { useEffect, useRef } from 'react'
import type { Side, Stroke, Tool } from '../../../shared/types'
import { useSanctuaryStore } from '../store/useSanctuaryStore'

export function paintStrokes(canvas: HTMLCanvasElement, strokes: Stroke[], live?: Stroke): void {
  const context = canvas.getContext('2d')!
  context.setTransform(2, 0, 0, 2, 0, 0)
  context.clearRect(0, 0, 600, 800)
  for (const stroke of live ? [...strokes, live] : strokes) {
    context.save()
    context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
    context.globalAlpha = stroke.opacity
    context.strokeStyle = stroke.color
    context.fillStyle = stroke.color
    context.lineWidth = stroke.size * (stroke.tool === 'fountain' ? 0.65 : 1)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    const points = stroke.points
    context.beginPath()
    context.moveTo(...points[0])
    if (points.length === 1) {
      context.arc(points[0][0], points[0][1], context.lineWidth / 2, 0, Math.PI * 2)
      context.fill()
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const middle: [number, number] = [
          (points[i][0] + points[i + 1][0]) / 2,
          (points[i][1] + points[i + 1][1]) / 2,
        ]
        context.quadraticCurveTo(...points[i], ...middle)
      }
      context.lineTo(...points[points.length - 1])
      context.stroke()
    }
    context.restore()
  }
}
export function DrawingCanvas({
  side,
  strokes,
  tool,
  color,
  size,
  onActivate,
}: {
  side: Side
  strokes: Stroke[]
  tool: Tool
  color: string
  size: number
  onActivate: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef<Stroke | null>(null)
  const frame = useRef<number | null>(null)
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes
  const edit = useSanctuaryStore((s) => s.editSpread)
  useEffect(() => {
    paintStrokes(ref.current!, strokes, live.current ?? undefined)
  }, [strokes])
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )
  const point = (event: React.PointerEvent): [number, number] => {
    const bounds = ref.current!.getBoundingClientRect()
    return [
      Math.max(0, Math.min(600, ((event.clientX - bounds.left) * 600) / bounds.width)),
      Math.max(0, Math.min(800, ((event.clientY - bounds.top) * 800) / bounds.height)),
    ]
  }
  function finish(event: React.PointerEvent, commit: boolean) {
    if (!live.current) return
    const stroke = live.current
    live.current = null
    if (ref.current?.hasPointerCapture(event.pointerId))
      ref.current.releasePointerCapture(event.pointerId)
    if (commit)
      edit((d) => {
        ;(side === 'left' ? d.leftStrokes : d.rightStrokes).push(stroke)
      })
    else paintStrokes(ref.current!, strokesRef.current)
  }
  return (
    <canvas
      ref={ref}
      width={1200}
      height={1600}
      className={`drawing-canvas ${tool === 'select' ? 'select-mode' : ''}`}
      aria-label={`Рисунок на ${side === 'left' ? 'левой' : 'правой'} странице`}
      onPointerDown={(event) => {
        if (tool === 'select' || event.button !== 0) return
        event.preventDefault()
        onActivate()
        event.currentTarget.setPointerCapture(event.pointerId)
        live.current = {
          id: crypto.randomUUID(),
          tool,
          color,
          size,
          opacity: tool === 'marker' ? 0.26 : tool === 'pen' ? 0.78 : 1,
          points: [point(event)],
        }
        paintStrokes(event.currentTarget, strokes, live.current)
      }}
      onPointerMove={(event) => {
        if (!live.current) return
        const next = point(event)
        const previous = live.current.points.at(-1)!
        if (Math.hypot(next[0] - previous[0], next[1] - previous[1]) < 1) return
        if (live.current.points.length < 20000) live.current.points.push(next)
        if (frame.current === null)
          frame.current = requestAnimationFrame(() => {
            frame.current = null
            if (ref.current)
              paintStrokes(ref.current, strokesRef.current, live.current ?? undefined)
          })
      }}
      onPointerUp={(event) => finish(event, true)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)}
    />
  )
}
