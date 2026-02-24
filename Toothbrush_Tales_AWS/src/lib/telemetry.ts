export type TelemetryPayload = Record<string, string | number | boolean | null>

export interface TelemetryEvent {
  id: string
  eventName: string
  payload: TelemetryPayload
  createdAt: string
  clientTimestamp: number
  app: string
}

const STORAGE_KEY = 'toothbrush-tales-telemetry'
const MAX_EVENTS = 1000

function readEvents(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((event): event is TelemetryEvent => {
      return Boolean(event && typeof event.eventName === 'string' && typeof event.clientTimestamp === 'number')
    })
  } catch (error) {
    console.warn('[Telemetry] Failed to read events:', error)
    return []
  }
}

function writeEvents(events: TelemetryEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch (error) {
    console.warn('[Telemetry] Failed to write events:', error)
  }
}

export function trackTelemetryEvent(eventName: string, payload: TelemetryPayload = {}): void {
  const nextEvent: TelemetryEvent = {
    id: crypto.randomUUID(),
    eventName,
    payload,
    createdAt: new Date().toISOString(),
    clientTimestamp: Date.now(),
    app: 'toothbrush-tales-aws',
  }

  const events = readEvents()
  events.unshift(nextEvent)
  writeEvents(events)
}

export function getTelemetryEvents(): TelemetryEvent[] {
  return readEvents()
}

export function clearTelemetryEvents(): void {
  localStorage.removeItem(STORAGE_KEY)
}
