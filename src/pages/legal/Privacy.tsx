import { Link } from 'react-router-dom';
import { PP_VERSION } from '../../legal-versions';
import './Legal.css';

/** **Placeholder text.** Replace it before you go anywhere near production. */
export default function Privacy() {
  return (
    <div className="legal-page">
      <h1>Privacy Policy</h1>
      <p className="legal-version muted">Version {PP_VERSION}</p>

      <p className="legal-placeholder">
        <strong>Placeholder.</strong> Replace this page with your own policy before you go
        anywhere near production — it is <code>src/pages/legal/Privacy.tsx</code>. The version
        above comes from <code>src/legal-versions.ts</code>, which the setup file reads too.
      </p>

      <h2>Who we are</h2>
      <p>
        Acme Corp, 123 Example Street, 00100 Rome, Italy. VAT IT00000000000, company no. 000000.
        Contact: <a href="mailto:hello@acme.example">hello@acme.example</a>.{' '}
        <em>Placeholder — the same details as the site footer, and both need replacing.</em>
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — your email address, name and the password you set, or
          the profile your identity provider returns if you sign in with Google or GitHub.
        </li>
        <li>
          <strong>Consent records</strong> — which version of these documents you accepted, and
          when. Kept as a history, not overwritten.
        </li>
        <li>
          <strong>Order data</strong> — what you bought, what it cost, and the reference Stripe
          gives us. Card details never reach us: they are entered on Stripe's own pages.
        </li>
      </ul>

      <h2>2. Why we collect it</h2>
      <p>
        To run your account, to fulfil and account for your orders, to keep the service secure,
        and to be able to show what you agreed to and when if anyone asks.
      </p>

      <h2>3. Who we share it with</h2>
      <p>
        Our payment provider and our infrastructure providers, and nobody else — we do not sell
        personal data. They act on our instructions and only to operate the service.
      </p>

      <h2>4. How long we keep it</h2>
      <p>
        For as long as your account exists, and afterwards only where the law requires it — order
        records usually must be kept for tax purposes. Consent records are kept for as long as
        they may need to be evidenced.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You can ask for a copy of your data, ask us to correct it, or ask us to delete it. Write
        to the address below and we will respond within the time the law allows.
      </p>

      <h2>6. Contact</h2>
      <p>
        Privacy questions: <a href="mailto:privacy@example.com">privacy@example.com</a>.
      </p>

      <p className="legal-footer">
        See also the <Link to="/terms">Terms of Service</Link>.
      </p>
    </div>
  );
}
