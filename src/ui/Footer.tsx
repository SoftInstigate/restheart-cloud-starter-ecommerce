import { Link } from 'react-router-dom';
import './Footer.css';

/**
 * The shop's footer: who is selling, and the terms they sell under.
 *
 * **Every detail here is a placeholder.** "Acme Corp" is not your company, and
 * an online shop that names the wrong seller, or none at all, is a legal
 * problem rather than a cosmetic one — most jurisdictions require a trader to
 * identify itself, and payment providers ask for it too. Replace all of it
 * before you take a real payment.
 *
 * The two links are app routes, and `ConsentsGate` lets them through while it
 * is blocking everything else: a document you cannot open is a document you
 * cannot agree to.
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-company">
          <p className="site-footer-name">Acme Corp</p>
          <p>
            123 Example Street, 00100 Rome, Italy
            <br />
            VAT IT00000000000 · Company no. 000000
          </p>
          <p>
            <a href="mailto:hello@acme.example">hello@acme.example</a> · +39 06 0000 0000
          </p>
        </div>

        <nav className="site-footer-links" aria-label="Legal">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>
      </div>

      <p className="site-footer-note">
        Placeholder details — replace them with your own before going live.
      </p>
    </footer>
  );
}
