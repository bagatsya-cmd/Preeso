import Head from 'next/head';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy | Preeso</title>
        <meta name="description" content="Privacy Policy for Preeso. Learn how we collect, use, and protect your personal information." />
        <link rel="canonical" href="https://www.preeso.co.in/privacy" />
        <meta property="og:title" content="Privacy Policy | Preeso" />
        <meta property="og:description" content="Privacy Policy for Preeso. Learn how we collect, use, and protect your personal information." />
        <meta property="og:url" content="https://www.preeso.co.in/privacy" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.preeso.co.in/preeso-icon.png" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <Navbar />
      
      {/* Spacer to push content below sticky navbar */}
      <div style={{ height: 66 }} />

      <main className="policy-page fade-in">
        {/* Glow orbs for premium visual style */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="policy-container">
          <header className="policy-header">
            <h1 className="text-gradient">Privacy Policy</h1>
            <p className="last-updated">Last Updated: May 31, 2026</p>
          </header>

          <section className="policy-intro">
            <p>
              At <strong>Preeso</strong>, we value your privacy and are committed to protecting your personal information. This Privacy Policy outlines how we collect, handle, and safeguard your data when using our price comparison and product tracking services. Preeso is a price comparison platform and does not directly sell products. All transactions and purchases occur on external, third-party retailer websites.
            </p>
          </section>

          <div className="policy-content-grid">
            <section className="policy-section">
              <h2>Information We Collect</h2>
              <p>To provide and improve our comparison and tracking services, we collect only the necessary information, which includes:</p>
              <ul>
                <li>Name</li>
                <li>Email address</li>
                <li>Account information</li>
                <li>Wishlist data</li>
                <li>Saved preferences</li>
                <li>Usage analytics, browser information, device information, and cookies</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>How We Use Information</h2>
              <p>The information we collect is used solely to enhance your price-comparison experience, maintain security, and optimize platform performance:</p>
              <ul>
                <li>To customize your shopping experience and save preferences</li>
                <li>To enable wishlist functionality and save user preferences across sessions</li>
                <li>To optimize website search algorithms and interface matching</li>
                <li>To detect, prevent, and address technical issues or unauthorized activities</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>Information Sharing</h2>
              <p>
                We do not sell, rent, or trade users' personal information to third parties. We may share anonymous, aggregated statistical data or integrate with vetted third-party service providers (such as hosting and analytics tools) solely to operate the platform under strict confidentiality standards.
              </p>
            </section>

            <section className="policy-section">
              <h2>Data Retention</h2>
              <p>
                Your personal and account data is retained only for as long as your account remains active and is necessary to provide you with tracking services. Upon request or account deletion, we delete or anonymize your personal information from our active databases, except where retention is required by law.
              </p>
            </section>

            <section className="policy-section">
              <h2>Data Protection</h2>
              <p>
                We employ industry-standard administrative, physical, and technical security measures to protect your personal data from unauthorized access, modification, or disclosure. Passwords are stored securely using industry-standard security practices (such as cryptographic hashing) and are never displayed publicly.
              </p>
            </section>

            <section className="policy-section">
              <h2>Price Accuracy Disclaimer</h2>
              <p>
                Although we strive to maintain accurate and up-to-date information on our comparison platform, product prices, availability, and description details displayed on third-party retailer websites may change at any time. Users are advised to verify all prices and specifications directly with the retailer before making any purchasing decisions.
              </p>
            </section>

            <section className="policy-section">
              <h2>Affiliate Disclosure</h2>
              <p>
                Some links on Preeso may be affiliate links. This means we may earn a commission when users make purchases through certain retailer links. This does not affect the price paid by users and helps support the operation and development of the platform.
              </p>
            </section>

            <section className="policy-section">
              <h2>Cookies</h2>
              <p>
                We use cookies and similar tracking technologies to customize your browsing experience, save preferences, analyze site traffic, and improve platform performance. You can configure your web browser to reject cookies, though this may restrict access to certain interactive wishlist or alert features.
              </p>
            </section>

            <section className="policy-section">
              <h2>Children's Privacy</h2>
              <p>
                Preeso is not intended for children under the age of 13. We do not knowingly collect or solicit personal information from anyone under 13. If we discover that we have inadvertently collected personal data from a child under 13, we will delete that information immediately.
              </p>
            </section>

            <section className="policy-section">
              <h2>User Rights</h2>
              <p>
                You retain full control over your data. You have the right to request access to, correct, update, or permanently delete your personal information. You can manage your preferences directly in your account settings page or by contacting our team.
              </p>
            </section>

            <section className="policy-section">
              <h2>Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Any changes will be posted on this page along with an updated 'Last Updated' date. Continued use of Preeso after such updates constitutes acceptance of the revised policy.
              </p>
            </section>

            <section className="policy-section contact-box">
              <h2>Contact Us</h2>
              <p>
                For privacy-related concerns, data deletion requests, or questions regarding this Privacy Policy, please contact our support team at:
              </p>
              <a href="mailto:preeso.support@gmail.com" className="email-link">
                preeso.support@gmail.com
              </a>
            </section>
          </div>
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .policy-page {
          min-height: calc(100vh - 66px);
          position: relative;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Poppins', 'Inter', sans-serif;
          padding: 80px 24px;
          overflow: hidden;
        }

        .policy-container {
          max-width: 800px;
          margin: 0 auto;
          position: relative;
          z-index: 5;
        }

        .policy-header {
          text-align: center;
          margin-bottom: 50px;
        }

        .policy-header h1 {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 12px;
        }

        .last-updated {
          color: var(--text-secondary);
          font-size: 0.95rem;
          font-weight: 400;
          opacity: 0.8;
        }

        .policy-intro {
          font-size: 1.1rem;
          line-height: 1.8;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg, 16px);
          padding: 24px 30px;
          margin-bottom: 40px;
          backdrop-filter: blur(10px);
        }

        .policy-intro strong {
          color: var(--text-primary);
          font-weight: 600;
        }

        .policy-content-grid {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .policy-section {
          background: rgba(15, 26, 46, 0.4);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 16px);
          padding: 30px;
          backdrop-filter: blur(12px);
          transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .policy-section:hover {
          border-color: var(--border-hover);
          transform: translateY(-2px);
        }

        .policy-section h2 {
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 16px;
          letter-spacing: -0.01em;
        }

        .policy-section p {
          color: var(--text-secondary);
          font-size: 0.98rem;
          line-height: 1.7;
          margin-bottom: 16px;
        }

        .policy-section p:last-child {
          margin-bottom: 0;
        }

        .policy-section ul {
          list-style: none;
          padding-left: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .policy-section ul li {
          position: relative;
          padding-left: 24px;
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .policy-section ul li::before {
          content: '→';
          position: absolute;
          left: 0;
          color: var(--brand-electric);
          font-weight: 700;
        }

        .contact-box {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%);
          border: 1px solid rgba(37, 99, 235, 0.25);
          text-align: center;
        }

        .email-link {
          display: inline-block;
          color: #ffffff;
          background: var(--brand-gradient);
          padding: 12px 32px;
          border-radius: var(--radius-sm, 8px);
          font-weight: 600;
          text-decoration: none;
          margin-top: 10px;
          box-shadow: 0 4px 15px var(--brand-accent-glow);
          transition: all 0.3s ease;
        }

        .email-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
          filter: brightness(1.1);
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

        @media (max-width: 600px) {
          .policy-page {
            padding: 50px 16px;
          }

          .policy-intro {
            padding: 20px;
          }

          .policy-section {
            padding: 20px;
          }
        }
      `}</style>
    </>
  );
}
