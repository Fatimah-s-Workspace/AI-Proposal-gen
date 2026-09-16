import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";

export const metadata = {
  title: "Data Processing Agreement - TenderFlow AI",
};

/**
 * The contract a business customer's legal team asks for before signing.
 *
 * The sub-processor table is generated from what the code actually does, not
 * from a template - every entry below corresponds to a real outbound call in
 * this repository. A DPA that under-declares is worse than none, because it is
 * a written promise that is already false.
 */
export default function DpaPage() {
  return (
    <LegalPageShell title="Data Processing Agreement" effectiveDate="16 September 2026">
      <LegalSection heading="Before you rely on this">
        <p className="rounded-md border border-amber-600/30 bg-amber-600/10 p-4 text-amber-800 dark:text-amber-300">
          This agreement has not yet been reviewed by a qualified lawyer. It is
          offered as an accurate description of how TenderFlow processes data and
          as a starting point for your own legal review. Do not treat it as legal
          advice, and have your counsel review it before relying on it.
        </p>
      </LegalSection>

      <LegalSection heading="1. Parties and roles">
        <p>
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the{" "}
          <a href="/terms" className="text-primary underline">Terms of Service</a>{" "}
          between TenderFlow AI (&quot;TenderFlow&quot;, &quot;we&quot;) and the
          organisation that has created a workspace (&quot;Customer&quot;, &quot;you&quot;).
        </p>
        <p>
          You are the <strong>data controller</strong>. You decide what documents to
          upload, whose personal data they contain, and what to do with the output.
          TenderFlow is the <strong>data processor</strong>: we process that data
          only to provide the service, and only on your instructions.
        </p>
        <p>
          Where the Nigeria Data Protection Act 2023 applies, these correspond to
          &quot;data controller&quot; and &quot;data processor&quot; as defined in that
          Act. Where the UK or EU GDPR applies, they correspond to Articles 4(7)
          and 4(8).
        </p>
      </LegalSection>

      <LegalSection heading="2. What we process, and why">
        <p>
          <strong>Subject matter and duration.</strong> Processing lasts for as long
          as your workspace exists, and ends on deletion as described in section 8.
        </p>
        <p>
          <strong>Nature and purpose.</strong> To store the documents you upload,
          extract requirements and clauses from them, generate proposal drafts,
          produce export files, and operate your account and billing.
        </p>
        <p><strong>Categories of data subject:</strong></p>
        <ul>
          <li>Your personnel who hold user accounts.</li>
          <li>
            Any individual named in a document you upload. Tender packs commonly
            contain the names, roles and CVs of key personnel, and contact details
            for procurement officers.
          </li>
        </ul>
        <p><strong>Categories of personal data:</strong></p>
        <ul>
          <li>
            <strong>Account data</strong> — name, email address, country, company
            name, and a one-way hash of the password. We never store the password
            itself.
          </li>
          <li>
            <strong>Billing data</strong> — billing address, tax identification
            number, and payment references. Card details are handled entirely by
            our payment provider and never reach our systems.
          </li>
          <li>
            <strong>Document content</strong> — whatever the files you upload
            contain. We do not inspect or restrict this, so you should assume it is
            the widest category here.
          </li>
          <li>
            <strong>Usage records</strong> — an audit log of actions taken in your
            workspace, and counts of uploads, generations and exports.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Our obligations">
        <ul>
          <li>
            We process personal data only on your documented instructions. Using
            the service is such an instruction; anything beyond it is not.
          </li>
          <li>
            <strong>We do not use your documents or drafts to train any AI model</strong>,
            our own or anyone else&apos;s, and we do not permit our sub-processors to.
          </li>
          <li>
            Everyone with access is bound by confidentiality obligations.
          </li>
          <li>
            We maintain the security measures described in section 6 and keep them
            appropriate to the risk.
          </li>
          <li>
            We assist you, so far as we reasonably can, with data subject requests,
            impact assessments and regulator consultations.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Sub-processors">
        <p>
          We use the providers below. Every one corresponds to a real transfer of
          data out of our systems — this list is not aspirational.
        </p>
        <div className="my-4 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-3 font-medium">Provider</th>
                <th className="p-3 font-medium">What it does</th>
                <th className="p-3 font-medium">What it receives</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t">
                <td className="p-3 font-medium">Supabase</td>
                <td className="p-3">Database and file storage</td>
                <td className="p-3">All account data and every uploaded document</td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-medium">Google (Gemini API)</td>
                <td className="p-3">Document analysis and drafting</td>
                <td className="p-3">
                  The text of tender documents you upload, and the project context
                  you enter. Not sent when AI features are unavailable, in which
                  case analysis runs entirely on our own servers.
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-medium">Brevo</td>
                <td className="p-3">Transactional email</td>
                <td className="p-3">
                  Recipient address and message content, including invoices
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-medium">Paystack</td>
                <td className="p-3">Payments</td>
                <td className="p-3">
                  Billing email, amount, and payment reference. Card details go
                  directly to Paystack and never pass through us.
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-medium">Sentry</td>
                <td className="p-3">Error monitoring</td>
                <td className="p-3">
                  Technical error data. Email addresses are redacted to their
                  domain before being sent.
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-medium">Upstash</td>
                <td className="p-3">Rate limiting</td>
                <td className="p-3">
                  A hashed key and a counter. No document content.
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-medium">Have I Been Pwned</td>
                <td className="p-3">Checking passwords against known breaches</td>
                <td className="p-3">
                  The first five characters of a SHA-1 hash of a password. The
                  password itself never leaves our servers and the service cannot
                  determine which password was checked.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          We will give you at least 30 days&apos; notice before adding or replacing a
          sub-processor, and you may object on reasonable data-protection grounds.
          If we cannot resolve your objection, you may terminate and receive a
          pro-rata refund for the unused period.
        </p>
      </LegalSection>

      <LegalSection heading="5. International transfers">
        <p>
          Our providers operate outside Nigeria, so providing the service involves
          transferring personal data abroad. Where the receiving country has not
          been assessed as providing adequate protection, we rely on the
          providers&apos; standard contractual clauses and equivalent safeguards.
        </p>
        <p>
          If data residency within Nigeria is a requirement for you, tell us before
          you subscribe. We cannot currently offer it, and we would rather say so
          than have you discover it during an audit.
        </p>
      </LegalSection>

      <LegalSection heading="6. Security measures">
        <ul>
          <li>Encryption in transit (TLS) for all connections, and encryption at rest by our storage and database providers.</li>
          <li>Passwords stored only as bcrypt hashes; we cannot read them, and never store the original.</li>
          <li>Role-based access within a workspace (owner, admin, member), enforced on the server on every request.</li>
          <li>Workspace isolation: every query is scoped to a workspace the requester belongs to.</li>
          <li>Rate limiting and account throttling on authentication to resist credential attacks.</li>
          <li>New passwords checked against known breach corpora without transmitting the password.</li>
          <li>A tamper-evident audit log of actions taken in your workspace.</li>
          <li>Automated tests and type checking on every change before it reaches production.</li>
        </ul>
        <p>
          We do not currently hold ISO 27001 or SOC 2 certification. If your
          procurement process requires one, we are not yet a fit, and we would
          rather tell you now.
        </p>
      </LegalSection>

      <LegalSection heading="7. Personal data breaches">
        <p>
          We will notify you without undue delay, and in any case{" "}
          <strong>within 48 hours</strong> of becoming aware of a personal data
          breach affecting your data. The notice will describe what happened, the
          categories and approximate volume of data involved, the likely
          consequences, and what we are doing about it.
        </p>
        <p>
          Reporting to a regulator or to affected individuals is your
          responsibility as controller. We will give you the information you need
          to do it.
        </p>
      </LegalSection>

      <LegalSection heading="8. Deletion and return">
        <p>
          You may export your proposals at any time from the service. Deleting a
          project removes its documents, requirements, clauses and drafts.
          Deleting your workspace removes all of it.
        </p>
        <p>
          On termination, we delete your personal data within{" "}
          <strong>30 days</strong>, except where we must keep it for legal
          reasons — principally payment and invoice records, which tax law
          requires us to retain for six years. Those retained records are billing
          data only, and never document content.
        </p>
        <p>
          Backups are overwritten on their own rolling schedule, so deleted data
          may persist in a backup for up to 30 days after deletion.
        </p>
      </LegalSection>

      <LegalSection heading="9. Assistance and audit">
        <p>
          We will help you respond to requests from individuals exercising their
          rights of access, correction, erasure, restriction, portability and
          objection.
        </p>
        <p>
          On reasonable notice and no more than once a year, we will provide the
          information needed to demonstrate compliance with this DPA. We may
          satisfy an audit request by providing documentation rather than granting
          access to systems that hold other customers&apos; data.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>
          Data protection enquiries, breach notifications and data subject requests:{" "}
          <a href="mailto:privacy@tenderflow.ai" className="text-primary underline">
            privacy@tenderflow.ai
          </a>
          .
        </p>
        <p>
          If a term of this DPA conflicts with the Terms of Service, this DPA
          governs, to the extent of the conflict and only as to data protection.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
