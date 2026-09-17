import { z } from "zod";
import { firstPasswordProblem } from "@/lib/password-policy";

/**
 * Email as stored and compared: trimmed and lowercased.
 *
 * Normalising in the schema rather than at each call site means
 * "  Ada@Example.com " and "ada@example.com" cannot become two accounts, and
 * that a lookup by the second finds the first. Sign-in relies on this too:
 * the throttle is keyed on the address, and an attacker who could vary the
 * casing would otherwise get a fresh allowance per spelling.
 */
const emailField = (message = "Enter a valid email") =>
  z.string().trim().toLowerCase().email(message);

/**
 * A password being set for the first time or changed.
 *
 * Checked with superRefine so the message names the one thing that is
 * missing, rather than a single "password is not strong enough" that leaves
 * the user guessing which rule they tripped.
 */
const newPasswordField = () =>
  z.string().superRefine((value, ctx) => {
    const problem = firstPasswordProblem(value);
    if (problem) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }
  });

export const signUpSchema = z.object({
  name: z.string().min(2, "Enter your full name").max(80),
  companyName: z.string().min(2, "Company name is required").max(120),
  email: emailField(),
  password: newPasswordField(),
  country: z.string().min(2).default("Nigeria"),
});

/**
 * Sign-in checks only that something was typed.
 *
 * The strength rules belong on the *setting* of a password, never on the
 * offering of one. A minimum here locks out every existing account whose
 * password is shorter than it - they are told their own correct password is
 * invalid, and the message even tells them the length, which is a free hint
 * to anyone building a wordlist. Rejecting a valid password is also
 * indistinguishable, from the user's side, from the account being broken.
 */
export const signInSchema = z.object({
  email: emailField(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailField(),
});

export const resetPasswordSchema = z.object({
  email: emailField(),
  token: z.string().min(1, "Reset token is required"),
  password: newPasswordField(),
});

export const verifyEmailSchema = z.object({
  email: emailField(),
  token: z.string().min(1, "Verification token is required"),
});

export const deleteAccountSchema = z.object({
  email: z.string().min(1, "Confirm your email address"),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required").max(120),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required").max(120),
});

const currentYear = new Date().getFullYear();

export const updateCompanyProfileSchema = z.object({
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  registrationNumber: z.string().trim().max(80).optional().or(z.literal("")),
  // Coerced because a number input posts a string, and blank has to mean
  // "not set" rather than the year 0.
  foundedYear: z.coerce
    .number()
    .int()
    .min(1800, "Enter a four-digit year")
    .max(currentYear, "That year is in the future")
    .optional()
    .nullable(),
  teamSize: z.string().trim().max(80).optional().or(z.literal("")),
  // Generous limits: these are pasted from an existing capability statement,
  // and truncating a past-performance list loses the strongest evidence a
  // bid has.
  profileSummary: z.string().trim().max(2000).optional().or(z.literal("")),
  capabilities: z.string().trim().max(3000).optional().or(z.literal("")),
  certifications: z.string().trim().max(2000).optional().or(z.literal("")),
  pastPerformance: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const inviteMemberSchema = z.object({
  email: emailField(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});

export const updateMembershipSchema = z.object({
  role: z.enum(["owner", "admin", "member"]),
});

export const createProjectSchema = z.object({
  title: z.string().min(3, "Project title is required").max(160),
  clientName: z.string().min(2, "Issuer or client name is required").max(160),
  opportunityType: z
    .enum(["Tender", "RFP", "Grant", "EOI", "RFQ"])
    .default("Tender"),
  sector: z.string().min(2).max(80).default("General"),
  country: z.string().min(2).max(80).default("Nigeria"),
  authority: z.string().max(160).optional().or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
  budgetRange: z.string().max(120).optional().or(z.literal("")),
  summary: z.string().max(1500).optional().or(z.literal("")),
  // Bid-shaping context. Generous limits on the two that carry the most
  // weight in the prompt - evaluation criteria get pasted straight out of a
  // tender pack, and win themes are where a bid team's actual thinking goes.
  referenceNumber: z.string().max(120).optional().or(z.literal("")),
  evaluationCriteria: z.string().max(2000).optional().or(z.literal("")),
  winThemes: z.string().max(2000).optional().or(z.literal("")),
  contractDuration: z.string().max(160).optional().or(z.literal("")),
  incumbent: z.string().max(160).optional().or(z.literal("")),
  submissionLanguage: z.string().min(2).max(40).default("English"),
});

export const updateRequirementSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  description: z.string().min(1).max(2000).optional(),
  category: z.string().min(2).max(80).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["met", "in_progress", "blocked", "waiver"]).optional(),
  sourceClause: z.string().max(1000).optional().nullable(),
  owner: z.string().max(80).optional().nullable().or(z.literal("")),
  reviewNotes: z.string().max(1000).optional().nullable().or(z.literal("")),
});

// Content only, deliberately. This schema used to accept a status with a
// default of "drafting", and the editor autosaves without sending one - so
// every keystroke's save rewrote the review state. A reviewer marking a
// section "needs work" had the request erased the moment the writer typed.
// Review state is set through the project-scoped section route, by someone
// choosing to set it.
export const updateProposalSectionSchema = z.object({
  content: z.string().min(1),
});

export const generateProposalSchema = z.object({
  sectionId: z.string().cuid().optional(),
  tone: z.enum(["formal", "confident", "technical", "ngo"]).default("formal"),
  customPrompt: z.string().max(1200).optional(),
});

export const exportProposalSchema = z.object({
  format: z.enum(["docx", "pdf"]),
});

export const uploadMetaSchema = z.object({
  projectId: z.string().cuid(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
