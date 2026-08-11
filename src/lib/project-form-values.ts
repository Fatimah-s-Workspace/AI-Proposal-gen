export type ProjectFormValues = {
  id: string;
  title: string;
  clientName: string;
  opportunityType: string;
  sector: string;
  country: string;
  authority: string | null;
  deadline: string | null;
  budgetRange: string | null;
  summary: string | null;
  referenceNumber: string | null;
  evaluationCriteria: string | null;
  winThemes: string | null;
  contractDuration: string | null;
  incumbent: string | null;
  submissionLanguage: string | null;
};

type ProjectRow = Omit<ProjectFormValues, "deadline"> & {
  deadline: Date | null;
};

/**
 * Narrows a Project row to what the edit form needs.
 *
 * Server components hold Prisma rows with Date objects; the form is a client
 * component, so the date has to cross as a string. Doing it in one place
 * keeps every call site from repeating the conversion - and from accidentally
 * passing the whole row, which would ship fields the form never uses.
 */
export function toProjectFormValues(project: ProjectRow): ProjectFormValues {
  return {
    id: project.id,
    title: project.title,
    clientName: project.clientName,
    opportunityType: project.opportunityType,
    sector: project.sector,
    country: project.country,
    authority: project.authority,
    deadline: project.deadline ? project.deadline.toISOString() : null,
    budgetRange: project.budgetRange,
    summary: project.summary,
    referenceNumber: project.referenceNumber,
    evaluationCriteria: project.evaluationCriteria,
    winThemes: project.winThemes,
    contractDuration: project.contractDuration,
    incumbent: project.incumbent,
    submissionLanguage: project.submissionLanguage,
  };
}
