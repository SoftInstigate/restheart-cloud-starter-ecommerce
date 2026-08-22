import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@restheart-cloud/kit-react';
import { environment } from '../../environments/environment';
import './Home.css';

interface StarterFeature {
  name: string;
  description: string;
  enabled: boolean;
  target?: 'team' | 'account';
}

export default function Home() {
  const auth = useAuth();
  const features = environment.features;

  const [demoData, setDemoData] = useState<unknown[] | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  async function fetchDemo() {
    setDemoLoading(true);
    setDemoError(null);
    setDemoData(null);
    try {
      const res = await auth.api('/demo');
      const json = await res.json();
      setDemoData(Array.isArray(json) ? json : []);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setDemoError(e.message ?? `HTTP ${e.status ?? '?'}`);
    } finally {
      setDemoLoading(false);
    }
  }

  const capabilities: StarterFeature[] = [
    {
      name: 'Email sign-up',
      description: 'Registration with an email verification link.',
      enabled: features.emailRegistration,
    },
    {
      name: 'Social login',
      description: `OAuth sign-in via ${features.oauthProviders.join(', ') || 'your provider'}.`,
      enabled: features.oauthLogin,
    },
    {
      name: 'Password reset',
      description: 'Forgot-password email and a reset form.',
      enabled: features.passwordReset,
    },
    {
      name: 'Team invitations',
      description: 'Invite by email — new and existing users both handled.',
      enabled: features.teamInvitations,
      target: 'team',
    },
    {
      name: 'Team management',
      description: 'Members, roles, team switching and settings.',
      enabled: true,
      target: 'team',
    },
    {
      name: 'Account & profile',
      description: 'Update your name and change your password.',
      enabled: true,
      target: 'account',
    },
  ];

  const routeFor = (target: 'team' | 'account'): string => {
    if (target === 'account') return '/account';
    const active = auth.teams.find(t => t.active);
    return active ? `/teams/${active.id.$oid}` : '/teams';
  };

  const firstName = auth.user?.profile?.name?.trim() ?? '';

  return (
    <>
      <section className="card hero">
        <p className="eyebrow">RESTHeart Cloud Starter</p>
        <h1>{firstName ? `Welcome, ${firstName}.` : 'Welcome.'}</h1>
        <p className="hero-pitch">
          Sign-up, login, email verification, password reset, invitations and team
          management are already built and wired up. Now make it yours.
        </p>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>What's already working</h2>
        </div>

        <ul className="feature-grid">
          {capabilities.map(feature => (
            <li key={feature.name} className={`feature${!feature.enabled ? ' feature-off' : ''}`}>
              <div className="feature-head">
                {feature.target ? (
                  <Link to={routeFor(feature.target)} className="feature-name">{feature.name}</Link>
                ) : (
                  <span className="feature-name">{feature.name}</span>
                )}
                <span className="badge">{feature.enabled ? 'on' : 'off'}</span>
              </div>
              <p className="muted">{feature.description}</p>
            </li>
          ))}
        </ul>

        <p className="muted feature-note">
          Toggle these in <code>src/environments/environment.ts</code> to match the
          Features settings of your RESTHeart Cloud service.
        </p>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Make it yours</h2>
        </div>

        <ol className="steps">
          <li className="step step-done">
            <span className="step-mark" aria-hidden="true">&#10003;</span>
            <div className="step-body">
              <span className="step-title">Point the app at your RESTHeart Cloud service</span>
              <p className="muted">
                Done — you're signed in. Configured in{' '}
                <code>src/environments/environment.ts</code>.
              </p>
            </div>
          </li>

          <li className="step">
            <span className="step-mark" aria-hidden="true">2</span>
            <div className="step-body">
              <span className="step-title">Make it yours visually</span>
              <p className="muted">
                Either tweak the default skin — the tokens and skin classes in{' '}
                <code>src/styles.css</code> — or delete that skin entirely and adopt
                Material, Tailwind, Spartan or your own, following the swap map in{' '}
                <code>README.md</code>.
              </p>
            </div>
          </li>

          <li className="step">
            <span className="step-mark" aria-hidden="true">3</span>
            <div className="step-body">
              <span className="step-title">Design your navigation and menu</span>
              <p className="muted">
                The app frame lives in <code>src/pages/shell/</code> — the header
                has a marked slot for your section links.
              </p>
            </div>
          </li>

          <li className="step">
            <span className="step-mark" aria-hidden="true">4</span>
            <div className="step-body">
              <span className="step-title">Replace this page</span>
              <p className="muted">
                Swap <code>src/pages/home/</code> for your app's landing content.
              </p>
            </div>
          </li>

          <li className="step">
            <span className="step-mark" aria-hidden="true">5</span>
            <div className="step-body">
              <span className="step-title">Build your first feature screen</span>
              <p className="muted">
                Add the component under <code>src/pages/</code> and register its
                route inside the authenticated shell in <code>src/routes.tsx</code>.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Fetch your data</h2>
        </div>

        <p className="muted">
          The kit provides <code>auth.api()</code> — an authenticated <code>fetch</code> wrapper
          that attaches the bearer token and handles errors. Here is how to use it.
        </p>

        <h3>1. Create the <code>demo</code> collection</h3>
        <p className="muted">
          In your RESTHeart Cloud dashboard, create a collection called <code>demo</code>
          and add a permission so the signed-in user can read it:
        </p>
        <pre className="code-block">path(/demo) and method(GET)</pre>

        <h3>2. Fetch from your component</h3>
        <pre className="code-block">{`import { useAuth } from '@restheart-cloud/kit-react';

function DemoComponent() {
  const auth = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    auth.api('/demo')
      .then(res => res.json())
      .then(json => setItems(Array.isArray(json) ? json : []));
  }, []);

  return <pre>{JSON.stringify(items, null, 2)}</pre>;
}`}</pre>

        <h3>3. Try it now</h3>
        <p className="muted">
          Press the button to fetch <code>/demo</code> from your service.
        </p>
        <button className="btn btn-primary" onClick={fetchDemo} disabled={demoLoading}>
          {demoLoading ? 'Loading…' : 'Fetch /demo'}
        </button>

        {demoError && <p className="demo-error">{demoError}</p>}
        {demoData && <pre className="code-block">{JSON.stringify(demoData, null, 2)}</pre>}
      </section>
    </>
  );
}
