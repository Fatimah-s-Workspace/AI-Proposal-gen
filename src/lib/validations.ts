import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(2, "Enter your full name").max(80),
  companyName: z.string().min(2, "Company name is required").max(120),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  country: z.string().min(2).default("Nigeria")
});

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required")
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email")
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Use at least 8 characters")
});

export const verifyEmailSchema = z.object({
  email: z.string().email("Enter a valid email"),
  token: z.string().min(1, "Verification token is required")
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required").max(120)
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required").max(120)
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["admin", "member"]).default("member")
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required")
});

export const updateMembershipSchema = z.object({
  role: z.enum(["owner", "admin", "member"])
});

export const createProjectSchema = z.object({
  title: z.string().min(3, "Project title is required").max(160),
  clientName: z.string().min(2, "Issuer or client name is required").max(160),
  opportunityType: z.enum(["Tender", "RFP", "Grant", "EOI", "RFQ"]).default("Tender"),
  sector: z.string().min(2).max(80).default("General"),
  country: z.string().min(2).max(80).default("Nigeria"),
  authority: z.string().max(160).optional().or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
  budgetRange: z.string().max(120).optional().or(z.literal("")),
  summary: z.string().max(1500).optional().or(z.literal(""))
});

export const updateRequirementSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  description: z.string().min(1).max(2000).optional(),
  category: z.string().min(2).max(80).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["met", "in_progress", "blocked", "waiver"]).optional(),
  sourceClause: z.string().max(1000).optional().nullable(),
  owner: z.string().max(80).optional().nullable().or(z.literal("")),
  reviewNotes: z.string().max(1000).optional().nullable().or(z.literal(""))
});

export const updateProposalSectionSchema = z.object({
  content: z.string().min(1),
  status: z.enum(["not_started", "drafting", "review", "approved"]).default("drafting")
});

export const generateProposalSchema = z.object({
  sectionId: z.string().cuid().optional(),
  tone: z.enum(["formal", "confident", "technical", "ngo"]).default("formal"),
  customPrompt: z.string().max(1200).optional()
});

export const exportProposalSchema = z.object({
  format: z.enum(["docx", "pdf"])
});

export const uploadMetaSchema = z.object({
  projectId: z.string().cuid()
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
