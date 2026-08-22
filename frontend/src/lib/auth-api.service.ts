import { BaseApiService, ApiResponse } from './base-api.service'

export class AuthApiService extends BaseApiService {
  async register(email: string, password: string, fullName?: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/v1/auth/register', {
      email,
      password,
      full_name: fullName,
    })
    return response.data
  }

  async login(email: string, password: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/v1/auth/login', {
      email,
      password,
    })

    if (response.data.success && response.data.data) {
      this.setTokens(
        response.data.data.access_token,
        response.data.data.refresh_token
      )
    }

    return response.data
  }

  async verifyEmail(token: string): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>('/api/v1/auth/email-verification', {
      token,
    })
    return response.data
  }

  async refreshAccessToken(): Promise<ApiResponse> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      throw new Error('No refresh token found')
    }

    const response = await this.client.post<ApiResponse>('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    })

    if (response.data.success && response.data.data) {
      this.setTokens(
        response.data.data.access_token,
        response.data.data.refresh_token
      )
    }

    return response.data
  }

  async logout(refreshToken: string): Promise<ApiResponse> {
    try {
      const response = await this.client.post<ApiResponse>('/api/v1/auth/logout', {
        refresh_token: refreshToken,
      })
      return response.data
    } finally {
      this.clearTokens()
    }
  }
}

export const authApiService = new AuthApiService()
