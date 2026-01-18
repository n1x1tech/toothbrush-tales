import { Outlet } from 'react-router-dom'
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
      <InstallPrompt />
    </div>
  )
}
