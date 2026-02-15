import { Link, useLocation } from 'react-router-dom'
import styles from './Header.module.css'

export default function Header() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <img src="/icons/header-logo.png" alt="Toothbrush Tales" className={styles.logoIcon} />
          <span className={styles.logoText}>Toothbrush Tales</span>
        </Link>

        <nav className={styles.desktopNav}>
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
            Voice
          </Link>
        </nav>
      </header>

      <nav className={styles.bottomNav}>
        <Link
          to="/"
          className={`${styles.bottomNavLink} ${isActive('/') ? styles.active : ''}`}
        >
          <span className={styles.bottomNavIcon}>{'\uD83C\uDFE0'}</span>
          <span className={styles.bottomNavLabel}>Home</span>
        </Link>
        <Link
          to="/history"
          className={`${styles.bottomNavLink} ${isActive('/history') ? styles.active : ''}`}
        >
          <span className={styles.bottomNavIcon}>{'\uD83D\uDCDA'}</span>
          <span className={styles.bottomNavLabel}>History</span>
        </Link>
        <Link
          to="/settings"
          className={`${styles.bottomNavLink} ${isActive('/settings') ? styles.active : ''}`}
        >
          <span className={styles.bottomNavIcon}>{'\uD83D\uDD0A'}</span>
          <span className={styles.bottomNavLabel}>Voice</span>
        </Link>
      </nav>
    </>
  )
}
