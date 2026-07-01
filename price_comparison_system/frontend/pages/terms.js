import Head from 'next/head';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function TermsAndConditions() {
  return (
    <>
      <Head>
        <title>Terms & Conditions | Preeso</title>
        <meta name="description" content="Terms and Conditions for using Preeso's price comparison and tracking platform." />
        <link rel="canonical" href="https://www.preeso.co.in/terms" />
        <meta property="og:title" content="Terms & Conditions | Preeso" />
        <meta property="og:description" content="Terms and Conditions for using Preeso's price comparison and tracking platform." />
        <meta property="og:url" content="https://www.preeso.co.in/terms" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.preeso.co.in/preeso-icon.png" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <Navbar />
      
      {/* Spacer to push content below sticky navbar */}
      <div style={{ height: 66 }} />

      <main className="terms-page fade-in">
        {/* Glow orbs for premium visual style */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="terms-container">
          <header className="terms-header">
            <h1 className="text-gradient">Terms & Conditions</h1>
            <p className="last-updated">Last Updated: January 1, 2026</p>
          </header>

          <section className="terms-intro">
            <p>
              Welcome to <strong>Preeso</strong>! These Terms & Conditions govern your access to and use of our price comparison, product tracking, and related services. By accessing or using the platform, you agree to be bound by these terms. If you do not agree, please refrain from using our services.
            </p>
          </section>

          <div className="terms-content-grid">
            <section className="terms-section">
              <h2>Introduction</h2>
              <p>
                These Terms & Conditions ("Terms") govern your use of the website, platform, and services provided by <strong>Preeso</strong>. Please read these terms carefully before browsing, comparing prices, or tracking products on our platform.
              </p>
            </section>

            <section className="terms-section">
              <h2>Use of Website</h2>
              <p>
                Preeso grants you a personal, non-exclusive, non-transferable, revocable, and limited license to access and use our website for personal, non-commercial purposes in accordance with these Terms. You agree to use the service in compliance with all applicable local, national, and international laws, regulations, and industry standards.
              </p>
            </section>

            <section className="terms-section">
              <h2>Price Comparison Disclaimer</h2>
              <p>
                Preeso is a price comparison and product tracking platform and does not sell products directly. We curate and index products from various retailers. All product purchases occur on third-party merchant websites.
              </p>
              <p>
                Although we strive to maintain accurate and up-to-date information, product data may occasionally contain errors, omissions, delays, or inaccuracies due to changes made by third-party retailers.
              </p>
              <ul>
                <li>Product prices, discounts, ratings, availability, images, and descriptions may change without notice.</li>
                <li>Users must verify all information on the retailer's website before making purchasing decisions.</li>
                <li>Preeso does not guarantee the accuracy, completeness, or timeliness of any product listings shown on our website.</li>
              </ul>
            </section>

            <section className="terms-section">
              <h2>Affiliate Disclosure</h2>
              <p>
                To support our operations and keep our comparison tools free for all users, Preeso may participate in affiliate, referral, advertising, sponsorship, or other commercial partnership programs and may receive compensation from participating merchants at no additional cost to users. This relationship does not influence our objective matching algorithms or display rankings.
              </p>
            </section>

            <section className="terms-section">
              <h2>Intellectual Property</h2>
              <p>
                All original content, branding, logos, source code, data matching algorithms, user interface (UI) components, styling assets, text, graphics, and other materials created and owned by Preeso are protected by applicable intellectual property laws. You are strictly prohibited from copying, reproducing, distributing, modifying, or reverse engineering any part of our platform without our prior written consent.
              </p>
            </section>

            <section className="terms-section">
              <h2>User Accounts & Responsibilities</h2>
              <p>
                To access advanced features of our platform, such as custom product wishlists, price drop notifications, and personalized tracking, you may be required to register for a user account. You are entirely responsible for maintaining the confidentiality of your account credentials, including your username and password, and for all activities that occur under your account. You agree to immediately notify us of any unauthorized use of your account.
              </p>
            </section>

            <section className="terms-section">
              <h2>Third-Party Websites & External Links</h2>
              <p>
                Our platform contains direct links and affiliate redirects to external, third-party merchant websites (e.g., Amazon, Flipkart, AJIO, Nykaa). Preeso does not own, control, operate, or endorse these third-party websites. We are not responsible for the availability, content, privacy practices, terms of use, or business operations of any third-party retailer. Any transaction you enter into with a merchant is strictly between you and that merchant.
              </p>
              <p>
                Preeso is not a party to any transaction, agreement, warranty, return, refund, or dispute between users and third-party merchants. Any contractual relationship exists solely between the user and the respective retailer.
              </p>
            </section>

            <section className="terms-section">
              <h2>Disclaimer of Warranties</h2>
              <p>
                The service is provided "as is" and "as available" without warranties of any kind, whether express or implied. To the fullest extent permissible under applicable law, Preeso disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, non-infringement, security, and accuracy. We do not warrant that our platform will be uninterrupted, secure, error-free, or free from server downtime, bugs, or viruses.
              </p>
            </section>

            <section className="terms-section">
              <h2>Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Preeso and its operators shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages or losses.
              </p>
              <ul>
                <li>Preeso is not responsible for losses resulting from inaccurate third-party pricing, retailer actions, product availability changes, or website downtime.</li>
                <li>Preeso is not liable for purchase decisions made based on the information displayed on our platform.</li>
                <li>We do not guarantee uninterrupted system access or lack of temporary server downtime.</li>
              </ul>
            </section>

            <section className="terms-section">
              <h2>Prohibited Activities</h2>
              <p>
                Users must not perform scraping, automated querying, hacking attempts, abuse, reverse engineering, or unauthorized access. Specifically, you agree not to:
              </p>
              <ul>
                <li>Use any robot, spider, scraper, or other automated means to access, monitor, extract, or index data from the website for any purpose.</li>
                <li>Attempt to probe, scan, test, or bypass the vulnerability of our security systems or authentication measures.</li>
                <li>Reverse engineer, decompile, or disassemble any aspect of the platform's codebase or matching algorithms.</li>
                <li>Introduce malicious software, viruses, or run denial-of-service (DoS) attacks against our servers.</li>
                <li>Use the platform to commit fraud, spam, or engage in abusive conduct.</li>
              </ul>
            </section>

            <section className="terms-section">
              <h2>Modifications to Services and Terms</h2>
              <p>
                Preeso reserves the right, at its sole discretion, to modify, suspend, or discontinue the services, platform, or any portion thereof, at any time and without notice. We also reserve the right to revise these Terms & Conditions from time to time. The latest version will always be posted on this page with an updated 'Last updated' date. Your continued use of the website following the posting of changes constitutes your acceptance of the revised Terms.
              </p>
            </section>

            <section className="terms-section">
              <h2>Termination</h2>
              <p>
                Preeso reserves the right, in its sole discretion and without prior notice or liability, to suspend, terminate, or restrict your user account or access to all or part of our website. This action may be taken for users violating these Terms, engaging in prohibited activities, or conducting actions that we deem harmful to other users, our infrastructure, or our brand.
              </p>
            </section>

            <section className="terms-section">
              <h2>Governing Law</h2>
              <p>
                These Terms & Conditions, and any disputes, claims, or controversies arising out of or related to your use of the Preeso platform, shall be governed by, interpreted, and construed in accordance with the laws of India, without regard to its conflict of law principles. You consent to the exclusive jurisdiction of the competent courts located in Delhi, India for the resolution of any such disputes.
              </p>
            </section>

            <section className="terms-section contact-box">
              <h2>Contact Information</h2>
              <p>
                If you have any questions, concerns, or feedback regarding these Terms & Conditions, please contact our support team. We are committed to responding to user inquiries as quickly as possible.
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
        .terms-page {
          min-height: calc(100vh - 66px);
          position: relative;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Poppins', 'Inter', sans-serif;
          padding: 80px 24px;
          overflow: hidden;
        }

        .terms-container {
          max-width: 800px;
          margin: 0 auto;
          position: relative;
          z-index: 5;
        }

        .terms-header {
          text-align: center;
          margin-bottom: 50px;
        }

        .terms-header h1 {
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

        .terms-intro {
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

        .terms-intro strong {
          color: var(--text-primary);
          font-weight: 600;
        }

        .terms-content-grid {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .terms-section {
          background: rgba(15, 26, 46, 0.4);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 16px);
          padding: 30px;
          backdrop-filter: blur(12px);
          transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .terms-section:hover {
          border-color: var(--border-hover);
          transform: translateY(-2px);
        }

        .terms-section h2 {
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 16px;
          letter-spacing: -0.01em;
        }

        .terms-section p {
          color: var(--text-secondary);
          font-size: 0.98rem;
          line-height: 1.7;
          margin-bottom: 16px;
        }

        .terms-section p:last-child {
          margin-bottom: 0;
        }

        .terms-section ul {
          list-style: none;
          padding-left: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .terms-section ul li {
          position: relative;
          padding-left: 24px;
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .terms-section ul li::before {
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
          .terms-page {
            padding: 50px 16px;
          }

          .terms-intro {
            padding: 20px;
          }

          .terms-section {
            padding: 20px;
          }
        }
      `}</style>
    </>
  );
}
