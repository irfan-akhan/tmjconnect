export function Privacy() {
  return (
    <div className="legal-page">
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Effective Date: April 18, 2026 | Version 1.0</p>

      <h2>1. Overview</h2>
      <p>
        AQION TECH ("we", "us", "our") operates TMJConnect, a HIPAA-compliant orofacial pain management
        platform. This Privacy Policy explains how we collect, use, disclose, and protect your personal
        information and Protected Health Information (PHI) when you use our Service.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>2.1 Account Information</h3>
      <ul>
        <li>Email address, name, phone number (at registration)</li>
        <li>Date of birth, gender, city, state (optional profile fields)</li>
        <li>Profile photo (optional)</li>
        <li>Password (stored as a one-way cryptographic hash — we never store or see your actual password)</li>
      </ul>

      <h3>2.2 Health Information (PHI)</h3>
      <ul>
        <li>Pain levels, pain types, body area locations, triggers, and duration</li>
        <li>Jaw mobility measurements</li>
        <li>Medication names and dosages</li>
        <li>Sleep quality, hours slept, bruxism awareness, morning stiffness</li>
        <li>Exercise completion records</li>
        <li>Health reports submitted to providers</li>
        <li>Free-text notes associated with symptom entries or reports</li>
      </ul>

      <h3>2.3 Technical Information</h3>
      <ul>
        <li>Device type, operating system, and app version</li>
        <li>IP address (for security, audit logging, and rate limiting)</li>
        <li>Login timestamps and session metadata</li>
        <li>Push notification tokens (for delivery only — not used for tracking)</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li><strong>Provide the Service:</strong> Display your health data, enable provider communication, deliver exercise programs</li>
        <li><strong>Generate Insights:</strong> Compute pain trends, correlations, and progress analytics from your own data</li>
        <li><strong>Provider Access:</strong> Share your health data with providers you have explicitly linked with</li>
        <li><strong>Notifications:</strong> Send exercise reminders, symptom check-ins, and provider messages via channels you control</li>
        <li><strong>Security:</strong> Detect unauthorized access, prevent abuse, enforce session policies</li>
        <li><strong>Legal Compliance:</strong> Meet HIPAA, data retention, and breach notification obligations</li>
      </ul>

      <h2>4. HIPAA Compliance</h2>
      <p>TMJConnect is designed as a HIPAA-compliant platform. We implement the following safeguards:</p>

      <h3>4.1 Administrative Safeguards</h3>
      <ul>
        <li>Role-based access control (patient, provider, admin) with minimum necessary access</li>
        <li>Mandatory MFA for all healthcare provider accounts</li>
        <li>15-minute inactivity session timeout for provider sessions</li>
        <li>Comprehensive audit logging of all access to PHI</li>
        <li>Documented incident response and breach notification procedures</li>
      </ul>

      <h3>4.2 Technical Safeguards</h3>
      <ul>
        <li>TLS 1.2+ encryption for all data in transit</li>
        <li>AES-256 encryption for data at rest (database, backups, file storage)</li>
        <li>Application-level encryption for MFA secrets and verification codes</li>
        <li>Scoped database queries that prevent cross-patient data access</li>
        <li>Input validation and sanitization on all user-provided data</li>
        <li>Structured logging with PHI redaction</li>
      </ul>

      <h3>4.3 Physical Safeguards</h3>
      <ul>
        <li>Infrastructure hosted on SOC 2 Type II certified platforms</li>
        <li>Encrypted backups with separate key management</li>
        <li>Disk-level encryption on all servers</li>
      </ul>

      <h2>5. Data Sharing</h2>
      <p>We share your health information only in these circumstances:</p>
      <ul>
        <li><strong>With your linked providers:</strong> Only providers you have explicitly connected with via invite code can view your health data</li>
        <li><strong>Service providers:</strong> We use HIPAA-compliant third-party services (email, SMS, cloud hosting) under signed Business Associate Agreements (BAAs)</li>
        <li><strong>Legal requirements:</strong> When required by law, regulation, or valid legal process</li>
        <li><strong>Emergency:</strong> If we believe disclosure is necessary to prevent serious harm</li>
      </ul>
      <p>
        <strong>We never sell your personal information or health data.</strong> We do not use your health
        data for advertising, marketing to third parties, or any purpose beyond providing and improving
        the Service.
      </p>

      <h2>6. Third-Party Services & BAAs</h2>
      <table>
        <thead>
          <tr><th>Service</th><th>Purpose</th><th>BAA Status</th></tr>
        </thead>
        <tbody>
          <tr><td>Resend</td><td>Transactional email delivery</td><td>Required before go-live</td></tr>
          <tr><td>Twilio</td><td>SMS (MFA codes, urgent alerts)</td><td>Required before go-live</td></tr>
          <tr><td>Firebase (Google)</td><td>Push notifications (FCM)</td><td>Google Cloud BAA available</td></tr>
          <tr><td>Sentry</td><td>Error monitoring (with PHI scrubbing)</td><td>Required before go-live</td></tr>
          <tr><td>Hosting Provider</td><td>Infrastructure</td><td>Required before go-live</td></tr>
        </tbody>
      </table>

      <h2>7. Data Retention</h2>
      <ul>
        <li><strong>Active accounts:</strong> Data retained as long as your account is active</li>
        <li><strong>Account deletion:</strong> Upon your request, personally identifiable information is anonymized within 30 days. Anonymized data may be retained.</li>
        <li><strong>Audit logs:</strong> Retained for 6 years minimum per HIPAA requirements, even after account deletion</li>
        <li><strong>Backups:</strong> Encrypted backups retained for 30 days, then automatically purged</li>
      </ul>

      <h2>8. Your Rights</h2>
      <p>Under HIPAA and applicable law, you have the right to:</p>
      <ul>
        <li><strong>Access:</strong> View and export all your health data through the app's data export feature</li>
        <li><strong>Correction:</strong> Request correction of inaccurate health information</li>
        <li><strong>Deletion:</strong> Delete your account and request removal of your personal data</li>
        <li><strong>Restriction:</strong> Request restrictions on how we use or share your information</li>
        <li><strong>Accounting:</strong> Request an accounting of disclosures of your health information</li>
        <li><strong>Portability:</strong> Download your data in a standard format (JSON)</li>
      </ul>

      <h2>9. Security</h2>
      <p>
        We implement industry-standard security measures to protect your data. However, no method of
        electronic storage or transmission is 100% secure. While we strive to use commercially acceptable
        means to protect your information, we cannot guarantee absolute security.
      </p>

      <h2>10. Children's Privacy</h2>
      <p>
        TMJConnect is not intended for use by individuals under 18 years of age. We do not knowingly
        collect personal information from children. If we learn that we have collected information from
        a child under 18, we will delete it promptly.
      </p>

      <h2>11. Breach Notification</h2>
      <p>
        In the event of a breach of unsecured PHI, we will notify affected individuals, the U.S. Department
        of Health and Human Services, and (if applicable) prominent media outlets, in accordance with
        HIPAA Breach Notification Rule requirements (within 60 days of discovery).
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy periodically. Material changes will be communicated through
        the application. Your continued use of the Service after changes constitutes acceptance.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        For privacy-related questions, data access requests, or to report a concern:<br />
        <strong>Privacy Officer:</strong> <a href="mailto:privacy@tmjconnect.com">privacy@tmjconnect.com</a><br />
        <strong>General:</strong> <a href="mailto:hello@tmjconnect.com">hello@tmjconnect.com</a>
      </p>

      <p className="legal-footer">
        <em>This document is a template and should be reviewed by qualified legal counsel and a HIPAA
        compliance officer before use in production.</em>
      </p>
    </div>
  );
}
