import { Link, useLocation } from 'react-router-dom'
import styles from './Header.module.css'

export default function Header() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <span className={styles.logoIcon}>{'\uD83E\uDDB7'}</span>
        <span className={styles.logoText}>Toothbrush Tales</span>
      </Link>

      <nav className={styles.nav}>
        <Link
          to="/"
          className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}
        >
          Home
        </Link>
        <Link
          to="/history"
          className={`${styles.navLink} ${isActive('/history') ? styles.active : ''}`}
        >
          History
        </Link>
        <Link
          to="/settings"
          className={`${styles.navLink} ${isActive('/settings') ? styles.active : ''}`}
        >
          Settings
        </Link>
      </nav>
    </header>
  )
}
