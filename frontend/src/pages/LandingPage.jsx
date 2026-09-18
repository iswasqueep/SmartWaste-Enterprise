import { Link } from "react-router-dom";
import "../styles/landing.css";

const services = [
  {
    icon: "🚛",
    title: "Request Waste Collection",
    description:
      "Book one-time or recurring waste pickups and receive real-time service updates.",
  },
  {
    icon: "♻️",
    title: "Recycling Services",
    description:
      "Separate recyclable materials, locate recycling partners and earn reward points.",
  },
  {
    icon: "💳",
    title: "Secure E-Payments",
    description:
      "Pay collection bills securely using cards, transfers, USSD or digital wallets.",
  },
  {
    icon: "📍",
    title: "Track Collections",
    description:
      "Monitor scheduled collections and follow assigned waste collectors.",
  },
  {
    icon: "📊",
    title: "Environmental Insights",
    description:
      "View waste, recycling and community environmental performance information.",
  },
  {
    icon: "📢",
    title: "Report Waste Problems",
    description:
      "Report missed collections, illegal dumping and overflowing waste bins.",
  },
];

const audiences = [
  {
    icon: "🏠",
    title: "Residents",
    description:
      "Book pickups, make payments, track collections and earn recycling rewards.",
  },
  {
    icon: "🚚",
    title: "Waste Collectors",
    description:
      "Receive jobs, plan routes, update collection status and upload evidence.",
  },
  {
    icon: "🏢",
    title: "Businesses",
    description:
      "Manage recurring commercial waste collection and consolidated billing.",
  },
  {
    icon: "🏛️",
    title: "Environmental Authorities",
    description:
      "Monitor waste operations, compliance, recycling rates and community reports.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create an account",
    description:
      "Register as a resident, business, collector or recycling partner.",
  },
  {
    number: "02",
    title: "Schedule a service",
    description:
      "Choose your waste type, location and preferred collection date.",
  },
  {
    number: "03",
    title: "Pay securely",
    description:
      "Complete payment using your preferred supported payment method.",
  },
  {
    number: "04",
    title: "Track and confirm",
    description:
      "Follow the pickup progress and receive proof when collection is completed.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="public-header">
        <div className="public-container nav-content">
          <Link to="/" className="public-brand">
            <span className="brand-symbol">♻</span>
            <span>SmartWaste</span>
          </Link>

          <nav className="public-nav">
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
            <a href="#users">Who it serves</a>
            <a href="#about">About</a>
          </nav>

          <div className="nav-actions">
            <Link to="/login" className="button button-ghost">
              Staff login
            </Link>

            <Link to="/register" className="button button-primary">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-glow hero-glow-left" />
          <div className="hero-glow hero-glow-right" />

          <div className="public-container hero-grid">
            <div className="hero-content">
              <div className="hero-label">
                <span className="hero-label-dot" />
                Digital waste services for cleaner communities
              </div>

              <h1>
                Waste management made
                <span> smarter, faster and cleaner.</span>
              </h1>

              <p className="hero-description">
                SmartWaste connects residents, businesses, collectors,
                recycling companies and environmental authorities through one
                secure platform.
              </p>

              <div className="hero-actions">
                <Link to="/register" className="button button-primary button-lg">
                  Request a collection
                </Link>

                <a
                  href="#how-it-works"
                  className="button button-secondary button-lg"
                >
                  See how it works
                </a>
              </div>

              <div className="hero-trust">
                <div>
                  <strong>24/7</strong>
                  <span>Online access</span>
                </div>

                <div>
                  <strong>Secure</strong>
                  <span>Digital payments</span>
                </div>

                <div>
                  <strong>Real-time</strong>
                  <span>Collection updates</span>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="dashboard-preview">
                <div className="preview-topbar">
                  <div>
                    <span className="preview-eyebrow">Community dashboard</span>
                    <h3>Cleaner city overview</h3>
                  </div>

                  <span className="live-badge">● Live</span>
                </div>

                <div className="preview-stats">
                  <div className="preview-stat">
                    <span>Collections today</span>
                    <strong>1,248</strong>
                    <small>↑ 12.4% this week</small>
                  </div>

                  <div className="preview-stat">
                    <span>Waste recovered</span>
                    <strong>24.8 t</strong>
                    <small>↑ 8.1% this week</small>
                  </div>

                  <div className="preview-stat">
                    <span>Recycling rate</span>
                    <strong>68%</strong>
                    <small>↑ 5.2% this month</small>
                  </div>
                </div>

                <div className="preview-map">
                  <div className="map-grid" />
                  <span className="map-road road-one" />
                  <span className="map-road road-two" />
                  <span className="map-road road-three" />

                  <span className="map-pin pin-one">🚛</span>
                  <span className="map-pin pin-two">♻️</span>
                  <span className="map-pin pin-three">📍</span>

                  <div className="map-floating-card">
                    <span>Next collection</span>
                    <strong>12:30 PM</strong>
                    <small>Victoria Island route</small>
                  </div>
                </div>

                <div className="preview-progress">
                  <div>
                    <span>Today's route progress</span>
                    <strong>76%</strong>
                  </div>

                  <div className="progress-track">
                    <span />
                  </div>
                </div>
              </div>

              <div className="floating-message">
                <span className="floating-icon">✓</span>
                <div>
                  <strong>Collection completed</strong>
                  <small>Receipt and reward points added</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="section light-section">
          <div className="public-container">
            <div className="section-heading">
              <span className="section-kicker">Our services</span>
              <h2>Everything required to manage waste digitally</h2>
              <p>
                From collection requests to environmental reporting, SmartWaste
                provides a complete waste-management experience.
              </p>
            </div>

            <div className="service-grid">
              {services.map((service) => (
                <article className="service-card" key={service.title}>
                  <span className="service-icon">{service.icon}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <Link to="/register">Explore service →</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section dark-section">
          <div className="public-container">
            <div className="section-heading section-heading-light">
              <span className="section-kicker">Simple process</span>
              <h2>From waste request to successful collection</h2>
              <p>
                SmartWaste removes paperwork and makes every stage visible and
                accountable.
              </p>
            </div>

            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step-card" key={step.number}>
                  <span className="step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="users" className="section light-section">
          <div className="public-container">
            <div className="section-heading">
              <span className="section-kicker">Designed for everyone</span>
              <h2>One platform for the entire waste ecosystem</h2>
              <p>
                Each type of user receives an experience tailored to their
                responsibilities.
              </p>
            </div>

            <div className="audience-grid">
              {audiences.map((audience) => (
                <article className="audience-card" key={audience.title}>
                  <span>{audience.icon}</span>
                  <div>
                    <h3>{audience.title}</h3>
                    <p>{audience.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="impact-section">
          <div className="public-container impact-grid">
            <div className="impact-content">
              <span className="section-kicker">Environmental impact</span>
              <h2>Technology that supports cleaner and healthier cities</h2>
              <p>
                Better collection coordination reduces illegal dumping,
                improves recycling participation and provides reliable data for
                environmental planning.
              </p>

              <ul className="impact-list">
                <li>Improved collection accountability</li>
                <li>Reduced missed waste pickups</li>
                <li>Increased recycling participation</li>
                <li>Transparent digital payment records</li>
              </ul>
            </div>

            <div className="impact-metrics">
              <div>
                <strong>30%</strong>
                <span>Potential improvement in collection efficiency</span>
              </div>

              <div>
                <strong>20%</strong>
                <span>Target improvement in recycling participation</span>
              </div>

              <div>
                <strong>40%</strong>
                <span>Potential reduction in manual processing</span>
              </div>

              <div>
                <strong>100%</strong>
                <span>Traceable digital service transactions</span>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="public-container cta-card">
            <div>
              <span className="section-kicker">Start today</span>
              <h2>Join the move towards smarter waste management</h2>
              <p>
                Create an account, request a pickup and manage your waste
                services from anywhere.
              </p>
            </div>

            <div className="cta-actions">
              <Link to="/register" className="button button-primary button-lg">
                Create an account
              </Link>

              <Link to="/login" className="button button-white button-lg">
                Operations login
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-container footer-grid">
          <div>
            <Link to="/" className="public-brand footer-brand">
              <span className="brand-symbol">♻</span>
              <span>SmartWaste</span>
            </Link>

            <p>
              A digital platform for cleaner communities and sustainable waste
              management.
            </p>
          </div>

          <div>
            <h4>Platform</h4>
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
            <Link to="/register">Create account</Link>
          </div>

          <div>
            <h4>Operations</h4>
            <Link to="/login">Staff login</Link>
            <a href="#about">Environmental impact</a>
            <a href="#users">Stakeholders</a>
          </div>

          <div>
            <h4>Contact</h4>
            <a href="mailto:support@smartwaste.local">
              support@smartwaste.local
            </a>
            <span>Lagos, Nigeria</span>
          </div>
        </div>

        <div className="public-container footer-bottom">
          <span>© 2026 SmartWaste. All rights reserved.</span>
          <span>Smart. Sustainable. Connected.</span>
        </div>
      </footer>
    </div>
  );
}