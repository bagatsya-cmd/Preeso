import Head from 'next/head';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

function SupportIcon({ size = 24 }) {
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

function BusinessIcon({ size = 24 }) {
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
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export default function ContactUs() {
  return (
    <>
      <Head>
        <title>Contact Us | Preeso</title>
        <meta name="description" content="Get in touch with the Preeso support and licensing team." />
        <link rel="canonical" href="https://www.preeso.co.in/contact" />
        <meta property="og:title" content="Contact Us | Preeso" />
        <meta property="og:description" content="Get in touch with the Preeso support and licensing team." />
        <meta property="og:url" content="https://www.preeso.co.in/contact" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.preeso.co.in/preeso-icon.png" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <Navbar />
      
      {/* Spacer to push content below sticky navbar */}
      <div style={{ height: 66 }} />

      <main className="contact-page fade-in">
        {/* Glow orbs for premium visual style */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="contact-container">
          <header className="contact-header">
            <h1 className="text-gradient">Contact Us</h1>
            <p className="subtitle">We're here to help. Reach out to us anytime.</p>
          </header>

          <div className="contact-card">
            <div className="contact-item">
              <div className="icon-wrapper">
                <SupportIcon size={24} />
              </div>
              <div className="item-details">
                <h3>Email Support</h3>
                <a href="mailto:preeso.support@gmail.com" className="email-link">
                  preeso.support@gmail.com
                </a>
                <p className="description">
                  For general support, bug reports, feature requests, or questions about using Preeso.
                </p>
              </div>
            </div>

            <div className="contact-item">
              <div className="icon-wrapper">
                <BusinessIcon size={24} />
              </div>
              <div className="item-details">
                <h3>Business & Partnerships</h3>
                <a href="mailto:preeso.official@gmail.com" className="email-link">
                  preeso.official@gmail.com
                </a>
                <p className="description">
                  For partnerships, collaborations, advertising opportunities, and business-related inquiries.
                </p>
              </div>
            </div>

            <div className="response-note">
              <p>We aim to respond to all inquiries as quickly as possible, typically within 1–3 business days.</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .contact-page {
          min-height: calc(100vh - 66px);
          position: relative;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Poppins', 'Inter', sans-serif;
          padding: 80px 24px;
          overflow: hidden;
        }

        .contact-container {
          max-width: 700px;
          margin: 0 auto;
          position: relative;
          z-index: 5;
        }

        .contact-header {
          text-align: center;
          margin-bottom: 48px;
        }

        .contact-header h1 {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 12px;
        }

        .subtitle {
          color: var(--text-secondary);
          font-size: 1.15rem;
          font-weight: 400;
          max-width: 500px;
          margin: 0 auto;
          opacity: 0.9;
          line-height: 1.5;
        }

        .contact-card {
          background: rgba(15, 26, 46, 0.4);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 16px);
          padding: 48px;
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          gap: 36px;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          box-shadow: var(--shadow-card);
        }

        .contact-card:hover {
          border-color: var(--border-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-hover);
        }

        .contact-item {
          display: flex;
          align-items: flex-start;
          gap: 24px;
        }

        .icon-wrapper {
          background: rgba(37, 99, 235, 0.1);
          color: var(--brand-electric, #3b82f6);
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(37, 99, 235, 0.2);
          flex-shrink: 0;
          transition: all 0.22s ease;
        }

        .contact-card:hover .icon-wrapper {
          border-color: rgba(37, 99, 235, 0.4);
          background: rgba(37, 99, 235, 0.15);
          box-shadow: 0 0 12px rgba(37, 99, 235, 0.2);
        }

        .item-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .item-details h3 {
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .email-link {
          color: var(--brand-electric, #3b82f6);
          text-decoration: none;
          font-size: 1.05rem;
          font-weight: 500;
          transition: all 0.2s ease;
          align-self: flex-start;
          word-break: break-all;
          cursor: pointer;
        }

        .email-link:hover {
          color: #ffffff;
          text-decoration: underline;
          text-shadow: 0 0 8px rgba(96, 165, 250, 0.4);
        }

        .description {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 4px 0 0 0;
        }

        .response-note {
          margin-top: 12px;
          padding-top: 28px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
          color: var(--text-muted, #4a5568);
          font-size: 0.88rem;
          line-height: 1.6;
        }

        /* Ambient floating background orbs */
        .orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
        }

        .orb-1 {
          width: 600px;
          height: 600px;
          top: -200px;
          left: -150px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%);
        }

        .orb-2 {
          width: 500px;
          height: 500px;
          bottom: -150px;
          right: -100px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 70%);
        }

        /* Fade-in Animation */
        .fade-in {
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .contact-page {
            padding: 60px 16px;
          }

          .contact-card {
            padding: 32px 24px;
            gap: 28px;
          }

          .contact-item {
            flex-direction: column;
            gap: 16px;
          }

          .icon-wrapper {
            width: 44px;
            height: 44px;
          }
        }
      `}</style>
    </>
  );
}
