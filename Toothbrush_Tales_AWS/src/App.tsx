import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'

const HomePage = lazy(() => import('./pages/HomePage'))
const StoryPage = lazy(() => import('./pages/StoryPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TelemetryPage = lazy(() => import('./pages/TelemetryPage'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={<Suspense fallback={<div>Loading...</div>}><HomePage /></Suspense>}
          />
          <Route
            path="story"
            element={<Suspense fallback={<div>Loading...</div>}><StoryPage /></Suspense>}
          />
          <Route
            path="history"
            element={<Suspense fallback={<div>Loading...</div>}><HistoryPage /></Suspense>}
          />
          <Route
            path="settings"
            element={<Suspense fallback={<div>Loading...</div>}><SettingsPage /></Suspense>}
          />
          <Route
            path="telemetry"
            element={<Suspense fallback={<div>Loading...</div>}><TelemetryPage /></Suspense>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
