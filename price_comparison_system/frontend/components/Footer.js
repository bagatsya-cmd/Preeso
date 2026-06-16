import Link from 'next/link';

/* ── Inline SVG Social Icons ──────────────────────────────────────────────── */
function InstagramIcon({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function LinkedInIcon({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function EmailIcon({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-inner">
        <div className="footer-top">
          {/* Left Side: Brand Name/Logo + Tagline */}
          <div className="brand-column">
            <Link href="/" passHref legacyBehavior>
              <a className="logo-link">
                <img src="/preeso-icon.png" alt="P" className="logo-icon" />
                <span
                  style={{
                    fontSize: '2.1rem',
                    fontWeight: 800,
                    letterSpacing: '-0.04em',
                    paddingRight: '0.05em',
                    background: 'linear-gradient(135deg, #ffffff 30%, #60a5fa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    transition: 'filter 0.3s ease',
                  }}
                  className="logo-text"
                >
                  Preeso
                </span>
              </a>
            </Link>
            <p className="brand-tagline">
              Helping users compare smarter and save more.
            </p>
          </div>

          {/* Right Side: Connect + Socials */}
          <div className="connect-column">
            <h4 className="connect-heading">Connect</h4>
            <div className="socials-row">
              <a
                href="https://www.instagram.com/preeso.official?igsh=aG85a3JsZ2Y2aGsw"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="Instagram"
              >
                <InstagramIcon size={20} />
              </a>
              <a
                href="https://www.facebook.com/share/1D8chLrx2r/"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="Facebook"
              >
                <FacebookIcon size={20} />
              </a>
              <a
                href="https://www.linkedin.com/company/preeso/"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="LinkedIn"
              >
                <LinkedInIcon size={20} />
              </a>
              <a
                href="mailto:preeso.support@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="Email"
              >
                <EmailIcon size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* Divider line */}
        <hr className="footer-divider" />

        {/* Bottom Section */}
        <div className="footer-bottom">
          <div className="footer-links">
            <Link href="/privacy" passHref legacyBehavior>
              <a className="footer-link">Privacy Policy</a>
            </Link>
            <Link href="/terms" passHref legacyBehavior>
              <a className="footer-link">Terms & Conditions</a>
            </Link>
            <Link href="/contact" passHref legacyBehavior>
              <a className="footer-link">Contact Us</a>
            </Link>
          </div>
          <p className="copyright-text">
            © 2026 Preeso. All rights reserved.
          </p>
        </div>
      </div>

      <style jsx>{`
        .footer-container {
          position: relative;
          background: transparent;
          border-top: none;
          width: 100%;
          color: var(--text-primary, #f0f4ff);
          font-family: 'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow: hidden;
          z-index: 10;
        }



        .footer-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 80px 40px 40px;
          position: relative;
          z-index: 2;
        }

        .footer-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 40px;
          margin-bottom: 40px;
        }

        .brand-column {
          flex: 1;
          min-width: 280px;
        }

        .logo-link {
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          color: var(--text-primary, #f0f4ff);
        }

        .logo-icon {
          height: 32px;
          width: 32px;
          border-radius: 8px;
        }

        .logo-text {
          font-size: 2.1rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          background: linear-gradient(135deg, #ffffff 30%, #60a5fa 100%);
          WebkitBackgroundClip: text;
          WebkitTextFillColor: transparent;
          background-clip: text;
          transition: filter 0.3s ease;
        }

        .logo-link:hover .logo-text {
          filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.4));
        }

        .brand-tagline {
          color: var(--text-secondary, #94a3b8);
          font-size: 0.95rem;
          line-height: 1.6;
          max-width: 320px;
          font-weight: 300;
          letter-spacing: 0.01em;
        }

        .connect-column {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 200px;
        }

        .connect-heading {
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: var(--text-primary, #f0f4ff);
          margin-bottom: 20px;
          opacity: 0.95;
        }

        .socials-row {
          display: flex;
          gap: 14px;
        }

        .social-icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary, #94a3b8);
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        .social-icon-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 0;
          border-radius: 50%;
        }

        .social-icon-btn :global(svg) {
          position: relative;
          z-index: 1;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .social-icon-btn:hover {
          color: #ffffff;
          transform: translateY(-5px);
          border-color: rgba(96, 165, 250, 0.4);
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.45);
        }

        .social-icon-btn:hover::before {
          opacity: 1;
        }

        .social-icon-btn:hover :global(svg) {
          transform: scale(1.1);
        }

        .footer-divider {
          border: none;
          height: 1px;
          background: transparent;
          margin: 40px 0 30px;
        }

        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap-reverse;
          gap: 20px;
        }

        .footer-links {
          display: flex;
          gap: 32px;
          flex-wrap: wrap;
        }

        .footer-link {
          color: var(--text-secondary, #94a3b8);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 400;
          transition: color 0.2s ease, text-shadow 0.2s ease;
          position: relative;
          padding: 4px 0;
        }

        .footer-link::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 1.5px;
          background-color: var(--brand-electric, #3b82f6);
          transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .footer-link:hover {
          color: #ffffff;
        }

        .footer-link:hover::after {
          width: 100%;
        }

        .copyright-text {
          color: var(--text-muted, #4a5568);
          font-size: 0.85rem;
          font-weight: 400;
          letter-spacing: 0.01em;
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .footer-inner {
            padding: 60px 24px 30px;
          }

          .footer-top {
            flex-direction: column;
            align-items: flex-start;
            gap: 32px;
          }

          .connect-column {
            align-items: flex-start;
            width: 100%;
          }

          .connect-heading {
            margin-bottom: 16px;
          }

          .footer-bottom {
            flex-direction: column;
            align-items: flex-start;
            gap: 24px;
          }

          .footer-links {
            flex-direction: column;
            gap: 16px;
            width: 100%;
          }
          
          .copyright-text {
            width: 100%;
          }
        }
      `}</style>
    </footer>
  );
}
