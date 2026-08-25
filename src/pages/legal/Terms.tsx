import { Link } from 'react-router-dom';
import { TOS_VERSION } from '../../legal-versions';
import './Legal.css';

/**
 * **Placeholder text.** Replace it before you go anywhere near production.
 *
 * A page rather than a file in `public/` — it was static HTML so that a user
 * the app is refusing to serve could still read what they are being asked to
 * accept, but that cost it the header, the footer and the theme, and left it
 * duplicating the app's stylesheet by hand. `ConsentsGate` lets this route
 * through instead, which buys the same thing without a second copy of the site.
 */
export default function Terms() {
  return (
    <div className="legal-page">
      <h1>Terms of Service</h1>
      <p className="legal-version muted">Version {TOS_VERSION}</p>

      <p className="legal-placeholder">
        <strong>Placeholder.</strong> Replace this page with your own terms before you go
        anywhere near production — it is <code>src/pages/legal/Terms.tsx</code>. The version
        above comes from <code>src/legal-versions.ts</code>, which the setup file reads too, so
        the document and the rule that enforces it cannot drift apart.
      </p>

      <h2>Who we are</h2>
      <p>
        Acme Corp, 123 Example Street, 00100 Rome, Italy. VAT IT00000000000, company no. 000000.
        Contact: <a href="mailto:hello@acme.example">hello@acme.example</a>.{' '}
        <em>Placeholder — the same details as the site footer, and both need replacing.</em>
      </p>

      <h2>1. Agreement</h2>
      <p>
        By creating an account or using this service you agree to these terms. If you do not
        agree, do not use the service.
      </p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for what happens under your account and for keeping your credentials
        to yourself. Tell us promptly if you believe your account has been compromised.
      </p>

      <h2>3. Acceptable use</h2>
      <p>
        Do not use the service to break the law, to infringe someone else's rights, or to disrupt
        the service for other people. We may suspend accounts that do.
      </p>

      <h2>4. Your content</h2>
      <p>
        What you store stays yours. You grant us only the permissions we need to operate the
        service on your behalf — storing, processing and transmitting your content.
      </p>

      <h2>5. Availability and changes</h2>
      <p>
        We aim to keep the service available but do not guarantee uninterrupted access. We may
        change these terms; when we do, we publish a new version and ask you to accept it before
        you continue using the service.
      </p>

      <h2>6. Termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or close accounts that breach
        these terms.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:legal@example.com">legal@example.com</a>.
      </p>

      <p className="legal-footer">
        See also the <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
