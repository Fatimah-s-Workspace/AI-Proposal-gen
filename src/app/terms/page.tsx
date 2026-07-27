import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";

export const metadata = {
  title: "Terms of Service - TenderFlow AI",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" effectiveDate="27 July 2026">
      <LegalSection heading="1. Acceptance of these terms">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of
          TenderFlow AI (&quot;TenderFlow&quot;, &quot;we&quot;, &quot;us&quot;), a tender, proposal, and
          grant-writing workspace. By creating an account or otherwise using
          the service, you agree to be bound by these Terms and by our{" "}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>
          . If you do not agree, do not use the service.
        </p>
        <p>
          You must be at least 18 years old, or the age of legal majority in
          your jurisdiction, to create an account.
        </p>
      </LegalSection>

      <LegalSection heading="2. What the service does">
        <p>
          TenderFlow lets you upload tender, RFP, RFQ, EOI, or grant
          documents, and provides tools to extract requirements and clauses,
          track compliance, draft proposal content with AI assistance, and
          export the result. It is a drafting and organisation tool, not a
          bid-writing or legal service.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your account">
        <p>
          You&apos;re responsible for the accuracy of the information you
          provide when creating an account, and for keeping your password
          confidential. You&apos;re responsible for all activity that happens
          under your account. Tell us promptly if you believe your account
          has been compromised.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your content">
        <p>
          You retain all ownership rights to the documents you upload and the
          content you create in TenderFlow (&quot;Your Content&quot;). You grant us a
          limited licence to store, process, and display Your Content back to
          you solely to provide and improve the service - including sending
          relevant portions of it to third-party AI providers for analysis
          and drafting assistance, as described in our{" "}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>
          . We don&apos;t claim ownership of Your Content, and we don&apos;t use it to
          train third-party foundation models.
        </p>
        <p>
          You&apos;re responsible for having the right to upload any document you
          submit, and for ensuring it doesn&apos;t violate a third party&apos;s rights
          or any confidentiality obligation you&apos;re under.
        </p>
      </LegalSection>

      <LegalSection heading="5. AI-generated content is a draft, not advice">
        <p>
          Requirement extraction, clause explanations, compliance scores, and
          drafted proposal sections are generated automatically (by an AI
          model where available, or by a local rule-based fallback when it
          isn&apos;t) and are provided as a starting point only. They are{" "}
          <strong>not</strong>{" "}
          legal, financial, or procurement advice, and we
          don&apos;t guarantee their accuracy or completeness.
        </p>
        <p>
          You&apos;re solely responsible for reviewing, verifying, and finalising
          any content before you rely on it or submit it in response to a
          real tender, RFP, or grant application. We are not liable for a
          missed requirement, a compliance error, or a disqualified
          submission that results from content generated through the
          service.
        </p>
      </LegalSection>

      <LegalSection heading="6. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Use the service for anything unlawful or fraudulent.</li>
          <li>
            Upload content you don&apos;t have the right to share, or that
            infringes someone else&apos;s intellectual property.
          </li>
          <li>
            Attempt to disrupt, overload, reverse-engineer, or gain
            unauthorised access to the service or other users&apos; data.
          </li>
          <li>
            Use the service to generate content for a submission you know to
            be materially false or misleading.
          </li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate this section.
        </p>
      </LegalSection>

      <LegalSection heading="7. Plans, usage limits, and payment">
        <p>
          TenderFlow is offered on a free/trial plan with monthly limits on
          document uploads and AI generations, shown in your account&apos;s Usage
          page. Paid plans, when introduced, will state their price, billing
          period, and any renewal or cancellation terms at the point of
          purchase, and payments will be processed through a third-party
          payment provider - we don&apos;t store your card details ourselves.
          We&apos;ll update this section with full billing terms before any paid
          plan launches.
        </p>
      </LegalSection>

      <LegalSection heading="8. Our intellectual property">
        <p>
          The TenderFlow name, branding, and the software itself (excluding
          Your Content) belong to us or our licensors. Nothing in these Terms
          grants you rights to our trademarks or source code beyond what&apos;s
          needed to use the service as intended.
        </p>
      </LegalSection>

      <LegalSection heading="9. Third-party services">
        <p>
          Parts of the service rely on third-party providers - for example,
          AI-assisted analysis and drafting, file storage, and email
          delivery. These providers process data on our behalf under their
          own terms, summarised in our{" "}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>
          . We&apos;re not responsible for outages or issues caused solely by a
          third-party provider, though we design the service to degrade
          gracefully (for example, falling back to local processing) where
          practical.
        </p>
      </LegalSection>

      <LegalSection heading="10. Termination">
        <p>
          You may stop using the service and request deletion of your
          account at any time. We may suspend or terminate your account if
          you materially breach these Terms, including the acceptable-use
          rules above. On termination, your right to access the service
          ends; we handle any remaining data as described in our{" "}
          <a href="/privacy" className="text-primary underline">
            Privacy Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="11. Service provided &quot;as is&quot;">
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis,
          without warranties of any kind, whether express or implied,
          including any warranty of merchantability, fitness for a
          particular purpose, or non-infringement. We don&apos;t guarantee the
          service will be uninterrupted, error-free, or that AI-generated
          output will be accurate.
        </p>
      </LegalSection>

      <LegalSection heading="12. Limitation of liability">
        <p>
          To the fullest extent permitted by law, TenderFlow and its
          operators won&apos;t be liable for any indirect, incidental, special,
          or consequential damages, or for lost profits, lost data, or lost
          business opportunities (including a lost or unsuccessful tender,
          bid, or grant submission), arising from your use of the service.
          Our total liability for any claim relating to the service is
          limited to the amount you paid us, if any, in the 12 months before
          the claim arose.
        </p>
      </LegalSection>

      <LegalSection heading="13. Governing law">
        <p>
          These Terms are governed by the laws of the Federal Republic of
          Nigeria, without regard to conflict-of-law principles. Any dispute
          arising from these Terms or the service will be subject to the
          exclusive jurisdiction of the courts of Nigeria.
        </p>
      </LegalSection>

      <LegalSection heading="14. Changes to these terms">
        <p>
          We may update these Terms from time to time. If we make a material
          change, we&apos;ll update the effective date above and, where
          practical, notify you (for example, by email). Continuing to use
          the service after a change takes effect means you accept the
          updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="15. Contact">
        <p>
          Questions about these Terms? Reach us at{" "}
          <a href="mailto:daviesfatimah97@gmail.com" className="text-primary underline">
            daviesfatimah97@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
