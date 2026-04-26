import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar.jsx';
import { Navbar } from './Navbar.jsx';

export function Layout() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: '#111417' }}>
      {/* Ambient background glows */}
      <div
        className="glow-primary"
        style={{ top: '-10%', left: '-10%', width: '40%', height: '40%' }}
      />
      <div
        className="glow-secondary"
        style={{ bottom: '-10%', right: '-10%', width: '30%', height: '30%' }}
      />

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <div style={{ width: 256, flexShrink: 0 }} className="hidden lg:block">
        <Sidebar />
      </div>

      {/* ── Mobile Sidebar overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {mobileNav && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileNav(false)}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 26 }}
              className="absolute left-0 top-0 bottom-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar mobile onNavigate={() => setMobileNav(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onMenu={() => setMobileNav(true)} />
        <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
