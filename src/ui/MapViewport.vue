<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Point } from './maps'

// Une carte qu'on fait glisser (doigt ou souris) et qu'on zoome (molette, pincement ou boutons).
// Le dessin lui-même est fourni par le composant parent, en unités de la carte.
const props = defineProps<{
  /** Taille du monde dessiné, en unités de la carte. */
  width: number
  height: number
  /** Le point montré au centre au départ, et quand on recentre. */
  center: Point
  /** Largeur du monde visible au départ, en unités de la carte. */
  span: number
  /** Nom de la carte, pour les lecteurs d'écran. */
  label: string
}>()

const MAX_SCALE = 2.5
const host = ref<HTMLDivElement | null>(null)
const view = reactive({ x: 0, y: 0, scale: 1 })
const grabbing = ref(false)
let box = { width: 1, height: 1 }

/** On ne peut pas dézoomer au point de voir le bord du monde. */
function minScale() {
  return Math.max(box.width / props.width, box.height / props.height)
}

function clamp() {
  view.scale = Math.min(MAX_SCALE, Math.max(minScale(), view.scale))
  view.x = Math.min(0, Math.max(box.width - props.width * view.scale, view.x))
  view.y = Math.min(0, Math.max(box.height - props.height * view.scale, view.y))
}

/** Montre un point du monde au milieu de la carte. */
function centerOn(point: Point) {
  view.x = box.width / 2 - point.x * view.scale
  view.y = box.height / 2 - point.y * view.scale
  clamp()
}

/** Zoome en gardant immobile le point de l'écran (px, py). */
function zoomAt(px: number, py: number, factor: number) {
  const worldX = (px - view.x) / view.scale
  const worldY = (py - view.y) / view.scale
  view.scale = Math.min(MAX_SCALE, Math.max(minScale(), view.scale * factor))
  view.x = px - worldX * view.scale
  view.y = py - worldY * view.scale
  clamp()
}

function zoom(factor: number) {
  zoomAt(box.width / 2, box.height / 2, factor)
}

/** Revient à la vue de départ : jamais plus zoomée que la taille réelle du dessin. */
function recenter() {
  view.scale = Math.min(box.width / props.span, 1)
  centerOn(props.center)
}

// --- Glisser et pincer, avec les « pointer events » (souris, doigt, stylet) ---

const pointers = new Map<number, Point>()
let start: Point = { x: 0, y: 0 }
let dragged = false

function local(e: PointerEvent | WheelEvent): Point {
  const rect = host.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerDown(e: PointerEvent) {
  pointers.set(e.pointerId, local(e))
  if (pointers.size === 1) {
    start = local(e)
    dragged = false
  }
}

function onPointerMove(e: PointerEvent) {
  const previous = pointers.get(e.pointerId)
  if (!previous) return
  const point = local(e)
  if (pointers.size === 1) {
    // Un vrai glissement commence au-delà de quelques pixels : en dessous, c'est un simple toucher.
    if (!dragged && Math.hypot(point.x - start.x, point.y - start.y) > 6) {
      dragged = true
      grabbing.value = true
      host.value?.setPointerCapture(e.pointerId)
    }
    if (dragged) {
      view.x += point.x - previous.x
      view.y += point.y - previous.y
      clamp()
    }
  } else if (pointers.size === 2) {
    // Deux doigts : on zoome autour du point entre les deux.
    dragged = true
    const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1]
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(point.x - other.x, point.y - other.y)
      if (before > 0) zoomAt((point.x + other.x) / 2, (point.y + other.y) / 2, after / before)
    }
  }
  pointers.set(e.pointerId, point)
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size === 0) grabbing.value = false
}

/** Après un glissement, le « clic » qui suit ne doit pas sélectionner ce qui est sous le doigt. */
function onClickCapture(e: MouseEvent) {
  if (!dragged) return
  e.stopPropagation()
  e.preventDefault()
  dragged = false
}

function onWheel(e: WheelEvent) {
  const point = local(e)
  zoomAt(point.x, point.y, Math.exp(-e.deltaY * 0.0015))
}

function onKeydown(e: KeyboardEvent) {
  const step = 60
  const moves: Record<string, Point> = {
    ArrowLeft: { x: step, y: 0 },
    ArrowRight: { x: -step, y: 0 },
    ArrowUp: { x: 0, y: step },
    ArrowDown: { x: 0, y: -step },
  }
  const move = moves[e.key]
  if (move) {
    view.x += move.x
    view.y += move.y
    clamp()
  } else if (e.key === '+' || e.key === '=') zoom(1.25)
  else if (e.key === '-') zoom(0.8)
  else return
  e.preventDefault()
}

let observer: ResizeObserver | null = null
onMounted(() => {
  const el = host.value
  if (!el) return
  box = { width: el.clientWidth, height: el.clientHeight }
  recenter()
  observer = new ResizeObserver(() => {
    box = { width: el.clientWidth, height: el.clientHeight }
    clamp()
  })
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

defineExpose({ centerOn })
</script>

<template>
  <div
    ref="host"
    class="viewport"
    :class="{ grabbing }"
    tabindex="0"
    role="region"
    :aria-label="`${label}. Glisse pour te déplacer, et utilise les boutons pour zoomer.`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click.capture="onClickCapture"
    @wheel.prevent="onWheel"
    @keydown="onKeydown"
  >
    <svg class="map" width="100%" height="100%">
      <g :transform="`translate(${view.x} ${view.y}) scale(${view.scale})`">
        <slot />
      </g>
    </svg>
    <div class="map-controls">
      <button type="button" aria-label="Zoomer" @click="zoom(1.3)">+</button>
      <button type="button" aria-label="Dézoomer" @click="zoom(1 / 1.3)">−</button>
      <button type="button" aria-label="Recentrer la carte" @click="recenter">⌖</button>
    </div>
  </div>
</template>

<style scoped>
.viewport {
  position: relative;
  height: clamp(320px, 58vh, 540px);
  overflow: hidden;
  background: var(--map-ground);
  border: 1px solid var(--seam);
  border-radius: var(--radius);
  cursor: grab;
  /* Le navigateur ne doit ni faire défiler la page ni zoomer quand on glisse sur la carte. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.viewport.grabbing {
  cursor: grabbing;
}

.viewport:focus-visible {
  outline: 2px solid var(--parchment);
  outline-offset: 2px;
}

.map {
  display: block;
}

.map-controls {
  position: absolute;
  right: 0.6rem;
  bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.map-controls button {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--seam);
  border-radius: 6px;
  background: var(--stone-raised);
  color: var(--parchment);
  font: 700 1.2rem/1 var(--font-body);
  cursor: pointer;
}

.map-controls button:hover {
  border-color: var(--gilt);
}
</style>
