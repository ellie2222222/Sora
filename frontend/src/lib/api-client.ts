import { authApiService } from './auth-api.service'
import { workspaceApiService } from './workspace-api.service'
import type { ApiResponse } from './base-api.service'

class ApiClient {
  auth = authApiService
  workspace = workspaceApiService

  isAuthenticated(): boolean {
    return authApiService.isAuthenticated()
  }

  getAccessToken(): string | null {
    return authApiService.getAccessToken()
  }

  getRefreshToken(): string | null {
    return authApiService.getRefreshToken()
  }

  clearTokens(): void {
    authApiService.clearTokens()
  }

  // Backward compatibility: delegate to auth service
  async register(email: string, password: string, fullName?: string): Promise<ApiResponse> {
    return this.auth.register(email, password, fullName)
  }

  async login(email: string, password: string): Promise<ApiResponse> {
    return this.auth.login(email, password)
  }

  async verifyEmail(token: string): Promise<ApiResponse> {
    return this.auth.verifyEmail(token)
  }

  async refreshAccessToken(): Promise<ApiResponse> {
    return this.auth.refreshAccessToken()
  }

  async logout(refreshToken: string): Promise<ApiResponse> {
    return this.auth.logout(refreshToken)
  }

  // Backward compatibility: delegate to workspace service
  async createWorkspace(
    name: string,
    description?: string,
    currency?: string
  ): Promise<ApiResponse> {
    return this.workspace.createWorkspace(name, description, currency)
  }

  async listWorkspaces(): Promise<ApiResponse> {
    return this.workspace.listWorkspaces()
  }

  async getWorkspace(workspaceId: number): Promise<ApiResponse> {
    return this.workspace.getWorkspace(workspaceId)
  }

  async updateWorkspace(
    workspaceId: number,
    name?: string,
    description?: string,
    currency?: string
  ): Promise<ApiResponse> {
    return this.workspace.updateWorkspace(workspaceId, name, description, currency)
  }

  async deleteWorkspace(workspaceId: number): Promise<ApiResponse> {
    return this.workspace.deleteWorkspace(workspaceId)
  }

  async inviteMember(
    workspaceId: number,
    email: string,
    role: string
  ): Promise<ApiResponse> {
    return this.workspace.inviteMember(workspaceId, email, role)
  }

  async acceptInvitation(token: string): Promise<ApiResponse> {
    return this.workspace.acceptInvitation(token)
  }

  async updateMemberRole(
    workspaceId: number,
    memberUserId: number,
    role: string
  ): Promise<ApiResponse> {
    return this.workspace.updateMemberRole(workspaceId, memberUserId, role)
  }

  async removeMember(workspaceId: number, memberUserId: number): Promise<ApiResponse> {
    return this.workspace.removeMember(workspaceId, memberUserId)
  }
}

export const apiClient = new ApiClient()
export type { ApiResponse } from './base-api.service'
