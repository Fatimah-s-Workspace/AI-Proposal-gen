import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";

export const metadata = {
  title: "Privacy Policy - TenderFlow AI",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" effectiveDate="27 July 2026">
      <LegalSection heading="1. Overview">
        <p>
          This Privacy Policy explains what information TenderFlow AI
          (&quot;TenderFlow&quot;, &quot;we&quot;, &quot;us&quot;) collects, how we use it, and the
          choices you have. It applies to everyone who creates an account or
          uses the service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>
          <strong>Account information:</strong> your name, email address,
          company name, country, and password (stored as a salted hash, not
          in plain text).
        </p>
        <p>
          <strong>Your Content:</strong> the tender, RFP, or grant documents
          you upload, along with the requirements, clauses, checklist items,
          proposal drafts, and export files derived from them.
        </p>
        <p>
          <strong>Usage data:</strong>{" "}
          how many documents you&apos;ve uploaded,
          AI generations run, and exports created each month, used to show
          your plan usage and enforce plan limits.
        </p>
        <p>
          <strong>Technical data:</strong> IP address and basic request
          metadata, used for rate limiting (preventing abuse) and error
          monitoring.
        </p>
      </LegalSection>

      <LegalSection heading="3. How we use this information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide the core service: parsing documents, tracking compliance, and generating draft content.</li>
          <li>To authenticate you and keep your account secure.</li>
          <li>To send account-related email: password reset links and a welcome message. We don&apos;t send marketing email without your consent.</li>
          <li>To enforce fair-use rate limits and plan usage limits.</li>
          <li>To diagnose and fix errors.</li>
          <li>To comply with legal obligations, if any arise.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. AI processing of your documents">
        <p>
          To extract requirements, explain clauses, and draft proposal
          content, relevant text from your uploaded documents and existing
          drafts is sent to Google&apos;s Gemini API for processing. When a
          Gemini API key isn&apos;t configured, or the service is temporarily
          unavailable, TenderFlow falls back to a local, rule-based
          processor that runs entirely on our own servers - your content
          isn&apos;t sent anywhere in that case.
        </p>
        <p>
          We don&apos;t use your content to train Google&apos;s or any other
          provider&apos;s general-purpose AI models. Google&apos;s handling of data
          sent to the Gemini API is governed by Google&apos;s own terms and
          privacy policies.
        </p>
      </LegalSection>

      <LegalSection heading="5. Third-party service providers">
        <p>We use the following providers to run TenderFlow. Each processes only what&apos;s needed for its purpose:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Google Gemini</strong> - AI-assisted document analysis and drafting (see section 4).</li>
          <li><strong>Supabase</strong> - database hosting and file storage for uploaded documents and exports.</li>
          <li><strong>Upstash</strong> - rate-limit counters (does not store document content).</li>
          <li><strong>Sentry</strong> - error monitoring, to help us find and fix bugs.</li>
          <li><strong>Brevo</strong> - delivery of password-reset and welcome email.</li>
        </ul>
        <p>
          We may introduce a payment provider (such as Paystack or
          Flutterwave) once paid plans launch; we&apos;ll update this policy
          before that happens.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data storage and security">
        <p>
          Your data is stored in a PostgreSQL database and object storage
          hosted by Supabase, accessed over encrypted connections. Passwords
          are hashed with bcrypt and never stored or logged in plain text.
          No system is completely secure, and we can&apos;t guarantee absolute
          security, but we take reasonable, industry-standard measures to
          protect your data.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data retention">
        <p>
          We keep your account and content for as long as your account is
          active. If you delete your account, we delete your personal
          information and Your Content within a reasonable period, except
          where we&apos;re required to retain limited records for legal or
          accounting purposes.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights">
        <p>
          You can access, correct, export, or delete most of your account
          data directly within the app. You can also contact us to request
          access to, correction of, or deletion of your personal data,
          consistent with applicable data protection law, including the
          Nigeria Data Protection Act 2023.
        </p>
      </LegalSection>

      <LegalSection heading="9. Cookies">
        <p>
          We use a single essential session cookie to keep you signed in.
          We don&apos;t use advertising or third-party tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="10. International data transfers">
        <p>
          Our infrastructure providers (Supabase, Google, Upstash, Sentry,
          Brevo) may process or store data outside Nigeria. By using the
          service, you understand your data may be transferred to and
          processed in other countries, which may have different data
          protection laws than your own.
        </p>
      </LegalSection>

      <LegalSection heading="11. Children's privacy">
        <p>
          TenderFlow is intended for business use by adults and is not
          directed at children. We don&apos;t knowingly collect information from
          anyone under 18.
        </p>
      </LegalSection>

      <LegalSection heading="12. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. If we make a
          material change, we&apos;ll update the effective date above and, where
          practical, notify you.
        </p>
      </LegalSection>

      <LegalSection heading="13. Contact">
        <p>
          Questions about this policy, or a request about your data? Reach
          us at{" "}
          <a href="mailto:daviesfatimah97@gmail.com" className="text-primary underline">
            daviesfatimah97@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
