import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import StudySession from './pages/StudySession'
import VoiceCall from './pages/VoiceCall'
import Settings from './pages/Settings'

const tabs = [
  { to: '/', label: '今日', icon: '◐' },
  { to: '/study', label: '背词', icon: '▤' },
  { to: '/voice', label: '口语', icon: '◉' },
  { to: '/settings', label: '设置', icon: '⚙' },
]

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell><Dashboard /></Shell>} />
      <Route path="/study" element={<Shell><StudySession /></Shell>} />
      <Route path="/voice" element={<VoiceCall />} />
      <Route path="/settings" element={<Shell><Settings /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <nav className="tabbar">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => `tabbar-item${isActive ? ' tabbar-item-active' : ''}`}
          >
            <span className="tabbar-icon">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
