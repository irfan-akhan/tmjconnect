export function App() {
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">TMJ<span className="logo-accent">Connect</span></div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#providers">For Providers</a>
            <a href="#contact" className="btn btn-sm">Get Started</a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="container">
          <div className="hero-badge">HIPAA Compliant</div>
          <h1>Take control of your <span className="text-gold">TMJ journey</span></h1>
          <p className="hero-sub">
            Track symptoms, follow exercise programs, and stay connected with your provider
            — all in one secure app built for orofacial pain management.
          </p>
          <div className="hero-cta">
            <a href="#contact" className="btn btn-primary btn-lg">Request Early Access</a>
            <a href="#how-it-works" className="btn btn-outline btn-lg">See How It Works</a>
          </div>
          <div className="hero-trust">
            <TrustBadge icon="🔒" text="End-to-end encrypted" />
            <TrustBadge icon="🏥" text="Provider-connected" />
            <TrustBadge icon="📱" text="iOS & Android" />
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2>Everything you need to manage TMJ pain</h2>
          <p className="section-sub">Built by healthcare professionals, designed for patients.</p>
          <div className="feature-grid">
            <FeatureCard
              icon="📊"
              title="Smart Pain Tracking"
              desc="Log daily symptoms with our interactive body map, pain slider, and trigger identification. See trends over time with visual insights."
            />
            <FeatureCard
              icon="🏋️"
              title="Guided Exercises"
              desc="Follow video-guided jaw exercises assigned by your provider. Track completion and see how they impact your pain levels."
            />
            <FeatureCard
              icon="📈"
              title="Pain Insights"
              desc="Understand your patterns — which days are worst, what triggers flare-ups, and whether your exercises are helping."
            />
            <FeatureCard
              icon="🔗"
              title="Provider Connection"
              desc="Securely share your progress with your provider. Submit reports, receive feedback, and stay aligned on your treatment plan."
            />
            <FeatureCard
              icon="💊"
              title="Medication & Sleep Tracking"
              desc="Log medications and sleep quality. See correlations between what you take, how you sleep, and your pain levels."
            />
            <FeatureCard
              icon="📄"
              title="Progress Reports"
              desc="Generate PDF summaries of your pain trends, exercise compliance, and trigger analysis to bring to appointments."
            />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2>How it works</h2>
          <div className="steps">
            <Step num="1" title="Sign up & connect" desc="Create your account and link with your provider using a simple invite code." />
            <Step num="2" title="Log daily" desc="Spend 30 seconds each day logging your pain, triggers, and jaw mobility." />
            <Step num="3" title="Follow your plan" desc="Complete provider-assigned exercises with video guidance and track your progress." />
            <Step num="4" title="See results" desc="Watch your pain trends improve over time. Share progress with your provider." />
          </div>
        </div>
      </section>

      <section id="providers" className="providers">
        <div className="container">
          <div className="provider-card">
            <h2>For Providers</h2>
            <p>
              TMJConnect gives you a real-time view of your patients' progress between visits.
              See pain trends, exercise adherence, and symptom patterns — all without extra paperwork.
            </p>
            <ul className="provider-list">
              <li>Patient dashboard with pain trends and exercise adherence</li>
              <li>Custom exercise library with video uploads</li>
              <li>Assign exercises and monitor completion rates</li>
              <li>Receive and respond to patient reports by urgency</li>
              <li>Clinical notes (never visible to patients)</li>
              <li>HIPAA-compliant with full audit trail</li>
            </ul>
            <a href="#contact" className="btn btn-primary">Request Provider Access</a>
          </div>
        </div>
      </section>

      <section id="contact" className="contact">
        <div className="container">
          <h2>Get early access</h2>
          <p className="section-sub">
            TMJConnect is currently in pilot with select providers. Request access to join the program.
          </p>
          <a href="mailto:hello@tmjconnect.com" className="btn btn-primary btn-lg">
            Contact Us — hello@tmjconnect.com
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="logo">TMJ<span className="logo-accent">Connect</span></div>
          <div className="footer-links">
            <a href="/terms">Terms of Service</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="mailto:hello@tmjconnect.com">Contact</a>
          </div>
          <p className="footer-copy">&copy; {new Date().getFullYear()} AQION TECH. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="step">
      <div className="step-num">{num}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function TrustBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="trust-badge">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
