export type CoverSheetBidder = {
  name: string;
  legalName?: string | null;
  registrationNumber?: string | null;
};

export type CoverSheetProject = {
  title: string;
  clientName: string;
  country: string;
  opportunityType: string;
  authority?: string | null;
  referenceNumber?: string | null;
  deadline?: Date | null;
  contractDuration?: string | null;
  organization?: CoverSheetBidder | null;
};

export type CoverSheet = {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
};

function formatDate(date: Date) {
  // UTC because deadlines come from a date-only input; formatting in the
  // server's local zone can shift a deadline onto the previous day, which on
  // a tender document is not a cosmetic error.
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * The facts an evaluator looks for on page one, in the order they look for
 * them.
 *
 * Kept apart from the docx and pdf writers so both render the same sheet
 * from the same data, and so this can be tested without loading either
 * library.
 */
export function buildCoverSheet(
  project: CoverSheetProject,
  now: Date = new Date(),
): CoverSheet {
  const bidder = project.organization;
  // The registered name is what belongs on a submission; the workspace name
  // is a fallback, and is often just what someone typed at signup.
  const submittedBy = bidder?.legalName?.trim() || bidder?.name?.trim();

  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Tender reference", value: project.referenceNumber },
    { label: "Submitted to", value: project.clientName },
    // Only when it adds something - on plenty of tenders the buyer and the
    // procuring authority are the same body, and repeating it reads as filler.
    {
      label: "Procuring authority",
      value:
        project.authority &&
        project.authority.trim().toLowerCase() !==
          project.clientName.trim().toLowerCase()
          ? project.authority
          : null,
    },
    { label: "Submitted by", value: submittedBy },
    { label: "Registration number", value: bidder?.registrationNumber },
    { label: "Country", value: project.country },
    { label: "Contract duration", value: project.contractDuration },
    {
      label: "Submission deadline",
      value: project.deadline ? formatDate(project.deadline) : null,
    },
    { label: "Prepared", value: formatDate(now) },
  ];

  return {
    title: project.title,
    subtitle: `${project.opportunityType} proposal`,
    rows: rows
      .filter((row) => row.value && row.value.trim())
      .map((row) => ({ label: row.label, value: row.value!.trim() })),
  };
}
