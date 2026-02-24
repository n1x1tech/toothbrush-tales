import { useMemo, useState } from 'react'
import { clearTelemetryEvents, getTelemetryEvents } from '../lib/telemetry'
import styles from './TelemetryPage.module.css'

interface TelemetryDoc {
  id: string
  eventName: string
  payload?: Record<string, unknown>
}

function asSessionId(doc: TelemetryDoc): string {
  const fromPayload = doc.payload?.sessionId
  return typeof fromPayload === 'string' && fromPayload ? fromPayload : doc.id
}

function percent(value: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

export default function TelemetryPage() {
  const [events, setEvents] = useState<TelemetryDoc[]>(() =>
    getTelemetryEvents().map((event) => ({
      id: event.id,
      eventName: event.eventName,
      payload: event.payload,
    }))
  )

  const metrics = useMemo(() => {
    const eventCounts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventName] = (acc[event.eventName] || 0) + 1
      return acc
    }, {})

    const starts = eventCounts.session_start || 0
    const pauses = eventCounts.session_pause || 0
    const resumes = eventCounts.session_resume || 0
    const stops = eventCounts.session_stop || 0

    const pauseResumeRatio = resumes > 0 ? (pauses / resumes).toFixed(2) : 'N/A'
    const stopRate = starts > 0 ? percent(stops, starts) : 'N/A'

    const startedSessions = new Set<string>()
    const pausedSessions = new Set<string>()
    const resumedSessions = new Set<string>()
    const stoppedSessions = new Set<string>()
    const completedSessions = new Set<string>()

    for (const event of events) {
      const sessionId = asSessionId(event)
      if (event.eventName === 'session_start') startedSessions.add(sessionId)
      if (event.eventName === 'session_pause') pausedSessions.add(sessionId)
      if (event.eventName === 'session_resume') resumedSessions.add(sessionId)
      if (event.eventName === 'session_stop') stoppedSessions.add(sessionId)
      if (event.eventName === 'session_complete') completedSessions.add(sessionId)
    }

    const startedCount = startedSessions.size
    const pausedCount = [...pausedSessions].filter((id) => startedSessions.has(id)).length
    const resumedCount = [...resumedSessions].filter((id) => startedSessions.has(id)).length
    const stoppedCount = [...stoppedSessions].filter((id) => startedSessions.has(id)).length
    const completedCount = [...completedSessions].filter((id) => startedSessions.has(id)).length

    return {
      eventCounts,
      pauseResumeRatio,
      stopRate,
      funnel: {
        started: startedCount,
        paused: pausedCount,
        resumed: resumedCount,
        completed: completedCount,
        stopped: stoppedCount,
      },
    }
  }, [events])

  const handleClearTelemetry = () => {
    clearTelemetryEvents()
    setEvents([])
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Telemetry Dashboard</h1>
        <button className={styles.clearButton} onClick={handleClearTelemetry}>
          Clear
        </button>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Event Counts</h2>
        {Object.keys(metrics.eventCounts).length === 0 ? (
          <p className={styles.muted}>No telemetry events recorded yet.</p>
        ) : (
          <div className={styles.grid}>
            {Object.entries(metrics.eventCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <div className={styles.card} key={name}>
                  <div className={styles.metricLabel}>{name}</div>
                  <div className={styles.metricValue}>{count}</div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ratios</h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.metricLabel}>Pause/Resume Ratio</div>
            <div className={styles.metricValue}>{metrics.pauseResumeRatio}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.metricLabel}>Stop Rate (stops / starts)</div>
            <div className={styles.metricValue}>{metrics.stopRate}</div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Session Completion Funnel</h2>
        <div className={styles.funnel}>
          <div className={styles.funnelRow}>
            <span>Started</span>
            <strong>{metrics.funnel.started}</strong>
          </div>
          <div className={styles.funnelRow}>
            <span>Paused at least once</span>
            <strong>{metrics.funnel.paused} ({percent(metrics.funnel.paused, metrics.funnel.started)})</strong>
          </div>
          <div className={styles.funnelRow}>
            <span>Resumed at least once</span>
            <strong>{metrics.funnel.resumed} ({percent(metrics.funnel.resumed, metrics.funnel.started)})</strong>
          </div>
          <div className={styles.funnelRow}>
            <span>Completed</span>
            <strong>{metrics.funnel.completed} ({percent(metrics.funnel.completed, metrics.funnel.started)})</strong>
          </div>
          <div className={styles.funnelRow}>
            <span>Stopped</span>
            <strong>{metrics.funnel.stopped} ({percent(metrics.funnel.stopped, metrics.funnel.started)})</strong>
          </div>
        </div>
      </section>
    </div>
  )
}
