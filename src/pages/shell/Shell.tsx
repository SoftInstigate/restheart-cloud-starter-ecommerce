import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@restheart-cloud/kit-react';
import { isJustSignedUp, setJustSignedUp } from '../../just-signed-up';
import './Shell.css';

const STORAGE_KEY = 'rh-theme';

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return { dark, toggle };
}

export default function Shell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const [justSignedUp, setJustSignedUpState] = useState(isJustSignedUp);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJustSignedUp(false);
  }, []);

  useEffect(() => {
    setNavigating(false);
  }, [location]);

  const initials = (): string => {
    const user = auth.user;
    if (!user) return '?';
    const first = user.profile?.name?.charAt(0) ?? '';
    const last = user.profile?.surname?.charAt(0) ?? '';
    const fallback = user._id?.charAt(0) ?? '?';
    return (first + last || fallback).toUpperCase();
  };

  const displayName = (): string => {
    const user = auth.user;
    if (!user) return '';
    const fn = user.profile?.name;
    const ln = user.profile?.surname;
    if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
    return user._id;
  };

  const email = (): string => {
    return auth.user?._id ?? '';
  };

  const activeTeamName = (): string => {
    const active = auth.teams.find(t => t.active);
    return active?.name ?? '';
  };

  const toggleMenu = () => {
    setMenuOpen(prev => {
      if (!prev) {
        setTimeout(() => firstMenuItemRef.current?.focus(), 0);
      }
      return !prev;
    });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    avatarBtnRef.current?.focus();
  };

  const onMenuKeydown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

  const logout = async () => {
    closeMenu();
    await auth.logout();
    navigate('/auth/login');
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <div className="layout">
        {navigating && (
          <div className="nav-progress" role="progressbar" aria-label="Loading page"></div>
        )}

        <header className="header">
          <Link to="/" className="logo">RESTHeart Cloud</Link>

          <nav className="nav" aria-label="Main">
            <NavLink to="/home" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Home</NavLink>
            <NavLink to="/teams" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Teams</NavLink>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="btn-icon"
              onClick={theme.toggle}
              aria-label={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme.dark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>

            <div className="user-menu" ref={menuRef}>
              <button
                ref={avatarBtnRef}
                type="button"
                className="avatar-btn"
                onClick={toggleMenu}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
              >
                {initials()}
              </button>

              {menuOpen && (
                <div className="dropdown" role="menu" onClick={e => e.stopPropagation()} onKeyDown={onMenuKeydown}>
                  <div className="dropdown-header">
                    <span className="dropdown-name">{displayName()}</span>
                    {email() && email() !== displayName() && (
                      <span className="dropdown-email">{email()}</span>
                    )}
                    {activeTeamName() && (
                      <span className="dropdown-team">Team: {activeTeamName()}</span>
                    )}
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link ref={firstMenuItemRef} to="/account" className="dropdown-item" role="menuitem" onClick={closeMenu}>Account</Link>
                  <div className="dropdown-divider"></div>
                  <button type="button" className="dropdown-item dropdown-item-danger" role="menuitem" onClick={logout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {justSignedUp && (
          <div className="welcome-banner">
            <p>Welcome aboard — your account is ready.</p>
            <button type="button" className="btn-dismiss" onClick={() => setJustSignedUpState(false)}>&#10005;</button>
          </div>
        )}

        <main id="main" className="main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
