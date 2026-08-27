import axios, { AxiosInstance, AxiosError } from 'axios'
import { cookieUtils } from './cookie-utils'

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error_code?: string
  timestamp: string
}

export abstract class BaseApiService {
  protected client: AxiosInstance
  private static readonly API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
  private static readonly ACCESS_TOKEN_COOKIE = 'access_token'
  private static readonly REFRESH_TOKEN_COOKIE = 'refresh_token'

  /** Endpoints where a 401 is a form-level result, not an expired session. */
  private static readonly AUTH_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/auth/email-verification',
  ]

  private static isAuthRequest(url?: string): boolean {
    if (!url) return false
    return BaseApiService.AUTH_PATHS.some((path) => url.startsWith(path))
  }

  constructor() {
    this.client = axios.create({
      baseURL: BaseApiService.API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use((config) => {
      const token = this.getAccessToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse>) => {
        // A 401 from an auth request is the answer to the question that was asked —
        // wrong password, unverified email, dead refresh token — and belongs to the
        // form that asked it. Only an expired session on a *protected* request means
        // "log in again"; redirecting on the former reloaded the page out from under
        // the error message the form had just rendered.
        if (error.response?.status === 401 && !BaseApiService.isAuthRequest(error.config?.url)) {
          this.clearTokens()
          if (!window.location.pathname.startsWith('/auth/')) {
            window.location.href = '/auth/login'
          }
        }
        throw error
      }
    )
  }

  public setTokens(accessToken: string, refreshToken: string): void {
    cookieUtils.set(BaseApiService.ACCESS_TOKEN_COOKIE, accessToken, 0.010) // ~15 minutes
    cookieUtils.set(BaseApiService.REFRESH_TOKEN_COOKIE, refreshToken, 7) // 7 days
  }

  public getAccessToken(): string | null {
    return cookieUtils.get(BaseApiService.ACCESS_TOKEN_COOKIE)
  }

  public getRefreshToken(): string | null {
    return cookieUtils.get(BaseApiService.REFRESH_TOKEN_COOKIE)
  }

  public clearTokens(): void {
    cookieUtils.delete(BaseApiService.ACCESS_TOKEN_COOKIE)
    cookieUtils.delete(BaseApiService.REFRESH_TOKEN_COOKIE)
  }

  public isAuthenticated(): boolean {
    return !!this.getAccessToken()
  }
}
