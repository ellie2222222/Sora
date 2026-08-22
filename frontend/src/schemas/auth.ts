import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().optional(),
})

export type RegisterFormData = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export type RefreshTokenFormData = z.infer<typeof refreshTokenSchema>
