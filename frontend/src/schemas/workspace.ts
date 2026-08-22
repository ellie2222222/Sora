import { z } from 'zod'
import { currencySchema } from './currency'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(255),
  description: z.string().optional(),
  // Preferred currency: every summary for the workspace is reported in it (BR-07a).
  currency: currencySchema,
})

export type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(255),
  description: z.string().optional(),
  currency: currencySchema,
})

export type UpdateWorkspaceFormData = z.infer<typeof updateWorkspaceSchema>

/** Workspace roles (SRS §7). Mirrors the backend WorkspaceRole enum — keep in sync (FE-02). */
export const WORKSPACE_ROLES = ['OWNER', 'MEMBER'] as const

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(WORKSPACE_ROLES),
})

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
})

export type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>
