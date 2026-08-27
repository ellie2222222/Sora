import { BaseApiService, ApiResponse } from './base-api.service'

export class WorkspaceApiService extends BaseApiService {
  async createWorkspace(
    name: string,
    description?: string,
    currency: string = 'USD'
  ): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/v1/workspaces', {
      name,
      description,
      currency,
    })
    return response.data
  }

  async listWorkspaces(): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>('/api/v1/workspaces')
    return response.data
  }

  async getWorkspace(workspaceId: number): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}`
    )
    return response.data
  }

  async updateWorkspace(
    workspaceId: number,
    name?: string,
    description?: string,
    currency?: string
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}`,
      {
        name,
        description,
        currency,
      }
    )
    return response.data
  }

  async deleteWorkspace(workspaceId: number): Promise<ApiResponse> {
    const response = await this.client.delete<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}`
    )
    return response.data
  }

  async inviteMember(
    workspaceId: number,
    email: string,
    role: string
  ): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/members/invite`,
      { email, role }
    )
    return response.data
  }

  async acceptInvitation(token: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      '/api/v1/invitations/accept',
      { token }
    )
    return response.data
  }

  async updateMemberRole(
    workspaceId: number,
    memberUserId: number,
    role: string
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/members/${memberUserId}/role`,
      { role }
    )
    return response.data
  }

  async removeMember(
    workspaceId: number,
    memberUserId: number
  ): Promise<ApiResponse> {
    const response = await this.client.delete<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/members/${memberUserId}`
    )
    return response.data
  }
}

export const workspaceApiService = new WorkspaceApiService()
