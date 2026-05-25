import { Outlet, Link } from 'react-router-dom'
import Header from './Header'
import InstallPrompt from '../pwa/InstallPrompt'
import styles from './Layout.module.css'

export default function Layout() {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <Link to="/privacy" className={styles.footerLink}>Privacy Policy</Link>
        <span className={styles.footerSep}>&middot;</span>
        <span className={styles.footerCopy}>&copy; Nixi Technology</span>
      </footer>
      <InstallPrompt />
    </div>
  )
}
