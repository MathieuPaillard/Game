<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Point } from './maps'

// Une carte qui remplit tout son cadre. On la fait glisser (doigt ou souris) et on la zoome
// (molette, pincement ou boutons). Le dessin lui-même est fourni par le composant parent, en
// unités de la carte. Toucher la carte ailleurs que sur un repère donne l'endroit touché, en
// unités de la carte (événement `tap`).
const props = defineProps<{
  /** Taille du monde dessiné, en unités de la carte. */
  width: number
  height: number
  /** Le point montré au centre au départ, et quand on recentre. */
  center: Point
  /** Ce qu'on veut voir au départ autour de ce point : une largeur et une hauteur, en unités de la carte. */
  span: number
  spanHeight: number
  /** Nom de la carte, pour les lecteurs d'écran. */
  label: string
}>()
const emit = defineEmits<{ tap: [point: Point] }>()

const MAX_SCALE = 2.5
const host = ref<HTMLDivElement | null>(null)
const view = reactive({ x: 0, y: 0, scale: 1 })
const grabbing = ref(false)
let box = { width: 1, height: 1 }

/** La taille du cadre, mesurée à l'instant : elle change quand un panneau s'ouvre à côté de la carte. */
function measure() {
  const el = host.value
  if (el) box = { width: Math.max(1, el.clientWidth), height: Math.max(1, el.clientHeight) }
}

/** On peut dézoomer jusqu'à voir la carte entière, pas davantage. */
function minScale() {
  return Math.min(box.width / props.width, box.height / props.height)
}

function clamp() {
  view.scale = Math.min(MAX_SCALE, Math.max(minScale(), view.scale))
  const width = props.width * view.scale
  const height = props.height * view.scale
  // Plus petite que le cadre, la carte reste au milieu ; sinon, on ne voit jamais au-delà de son bord.
  view.x = width <= box.width ? (box.width - width) / 2 : Math.min(0, Math.max(box.width - width, view.x))
  view.y = height <= box.height ? (box.height - height) / 2 : Math.min(0, Math.max(box.height - height, view.y))
}

// Un point demandé avant que la carte ait une taille : on le montrera dès qu'elle sera cadrée.
let pending: Point | null = null

/** Montre un point du monde au milieu de la carte. */
function centerOn(point: Point) {
  if (!framed) {
    pending = point
    return
  }
  measure()
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
  measure()
  view.scale = Math.min(box.width / props.span, box.height / props.spanHeight, 1)
  centerOn(props.center)
}

/** L'endroit de la carte qui se trouve sous un point de l'écran. */
function toWorld(clientX: number, clientY: number): Point {
  const rect = host.value!.getBoundingClientRect()
  return { x: (clientX - rect.left - view.x) / view.scale, y: (clientY - rect.top - view.y) / view.scale }
}

// --- Glisser et pincer, avec les « pointer events » (souris, doigt, stylet) ---

const pointers = new Map<number, Point>()
let start: Point = { x: 0, y: 0 }
let dragged = false

function local(e: MouseEvent): Point {
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

/** Un simple toucher (sans glisser) sur le fond de la carte : on donne l'endroit touché. */
function onClick(e: MouseEvent) {
  if (e.target instanceof Element && e.target.closest('.map-controls')) return
  emit('tap', toWorld(e.clientX, e.clientY))
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

// La carte se cadre dès qu'elle a une vraie taille, puis garde sa vue (même quand on la range un moment
// pour regarder l'autre carte).
let framed = false
let observer: ResizeObserver | null = null
onMounted(() => {
  const el = host.value
  if (!el) return
  observer = new ResizeObserver(() => {
    measure()
    if (box.width <= 1 || box.height <= 1) return
    if (framed) return clamp()
    framed = true
    recenter()
    // Ce qu'on avait choisi avant que la carte s'affiche (une alerte touchée depuis l'autre carte…).
    if (pending) centerOn(pending)
    pending = null
  })
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

defineExpose({ centerOn, toWorld })
</script>

<template>
  <div
    ref="host"
    class="viewport"
    :class="{ grabbing }"
    tabindex="0"
    role="region"
    :aria-label="`${label}. Glisse pour te déplacer, pince ou utilise les boutons pour zoomer.`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click.capture="onClickCapture"
    @click="onClick"
    @wheel.prevent="onWheel"
    @keydown="onKeydown"
  >
    <svg class="map" width="100%" height="100%">
      <g :transform="`translate(${view.x} ${view.y}) scale(${view.scale})`">
        <slot />
      </g>
    </svg>
    <div class="map-controls">
      <button type="button" aria-label="Recentrer la carte" @click="recenter">⌖</button>
      <button type="button" class="zoom" aria-label="Zoomer" @click="zoom(1.3)">+</button>
      <button type="button" class="zoom" aria-label="Dézoomer" @click="zoom(1 / 1.3)">−</button>
    </div>
  </div>
</template>

<style scoped>
.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--map-ground);
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
  outline-offset: -2px;
}

.map {
  display: block;
}

/* Les boutons de la carte : l'écran de jeu dit où les poser (voir GameScreen). */
.map-controls {
  position: absolute;
  left: var(--map-controls-left, auto);
  right: var(--map-controls-right, auto);
  bottom: var(--map-controls-bottom, 0.6rem);
  display: flex;
  gap: 0.35rem;
}

.map-controls button {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--seam);
  border-radius: 50%;
  background: var(--hud);
  color: var(--parchment);
  font: 700 1.2rem/1 var(--font-body);
  cursor: pointer;
}

.map-controls button:hover {
  border-color: var(--gilt);
}

/* Au doigt, on zoome en pinçant : les boutons + et − ne servent qu'à la souris. */
@media (pointer: coarse) {
  .map-controls .zoom {
    display: none;
  }
}
</style>
