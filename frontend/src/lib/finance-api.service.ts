import { BaseApiService, ApiResponse } from './base-api.service'
import type { Currency } from '@/schemas/currency'

export interface CategoryPayload {
  name: string
  type: 'INCOME' | 'EXPENSE'
  color?: string
  icon?: string
}

export interface AccountPayload {
  type: string
  name: string
  currency: Currency
  opening_balance: number
  institution?: string
  account_number?: string
}

export interface TransactionPayload {
  account_id: number
  type: string
  amount: number
  date: string
  category_id?: number
  description?: string
  notes?: string
  tags?: string
}

/** Editable account fields — the immutable ones are absent by design. */
export interface AccountUpdatePayload {
  name?: string
  institution?: string
  account_number?: string
}

/** Editable transaction fields (BR-03). */
export interface TransactionUpdatePayload {
  category_id?: number | null
  description?: string
  notes?: string
  tags?: string
}

export interface TransactionFilters {
  account_id?: number
  category_id?: number
  type?: string
  status?: string
  start_date?: string
  end_date?: string
  search?: string
  sort_by?: string
  page?: number
  page_size?: number
}

/**
 * Categories (CAT-US-01), accounts (ACC-US-01…04) and transactions (TXN-US-01…05).
 * All paths are workspace-scoped, matching SDS §6.1.
 */
export class FinanceApiService extends BaseApiService {
  // ---------------------------------------------------------------- categories
  async listCategories(workspaceId: number, type?: string): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/categories`,
      { params: type ? { type } : undefined }
    )
    return response.data
  }

  async createCategory(workspaceId: number, payload: CategoryPayload): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/categories`,
      payload
    )
    return response.data
  }

  async updateCategory(
    workspaceId: number,
    categoryId: number,
    payload: Partial<CategoryPayload>
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/categories/${categoryId}`,
      payload
    )
    return response.data
  }

  async archiveCategory(workspaceId: number, categoryId: number): Promise<ApiResponse> {
    const response = await this.client.delete<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/categories/${categoryId}/archive`
    )
    return response.data
  }

  // ------------------------------------------------------------------ accounts
  async listAccounts(workspaceId: number, status?: string): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/accounts`,
      { params: status ? { status } : undefined }
    )
    return response.data
  }

  async getAccount(workspaceId: number, accountId: number): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/accounts/${accountId}`
    )
    return response.data
  }

  async createAccount(workspaceId: number, payload: AccountPayload): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/accounts`,
      payload
    )
    return response.data
  }

  /**
   * Name, institution and account number only. Type, opening balance and
   * currency are immutable once the account exists (ACC-US-03).
   */
  async updateAccount(
    workspaceId: number,
    accountId: number,
    payload: AccountUpdatePayload
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/accounts/${accountId}`,
      payload
    )
    return response.data
  }

  async archiveAccount(workspaceId: number, accountId: number): Promise<ApiResponse> {
    const response = await this.client.delete<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/accounts/${accountId}/archive`
    )
    return response.data
  }

  // ----------------------------------------------------------------- workspace
  async updateWorkspace(
    workspaceId: number,
    payload: { name?: string; description?: string }
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}`,
      payload
    )
    return response.data
  }

  /**
   * Changes the currency every summary is reported in, re-snapshotting the rate
   * on every account and transaction in the workspace. Owner only.
   */
  async changePreferredCurrency(
    workspaceId: number,
    currency: Currency
  ): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/preferred-currency`,
      { currency }
    )
    return response.data
  }

  // ------------------------------------------------------------ exchange rates
  /**
   * Rate the backend would snapshot right now — read-only, for showing what an
   * amount converts to. Never sent back on a write (BR-07a).
   */
  async getExchangeRate(base: Currency, quote: Currency): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>('/api/v1/exchange-rates', {
      params: { base, quote },
    })
    return response.data
  }

  // ----------------------------------------------------------------- dashboard
  async getDashboard(workspaceId: number): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/dashboard`
    )
    return response.data
  }

  // -------------------------------------------------------------- transactions
  async listTransactions(
    workspaceId: number,
    filters: TransactionFilters = {}
  ): Promise<ApiResponse> {
    const response = await this.client.get<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/transactions`,
      { params: filters }
    )
    return response.data
  }

  async createTransaction(
    workspaceId: number,
    payload: TransactionPayload
  ): Promise<ApiResponse> {
    const response = await this.client.post<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/transactions`,
      payload
    )
    return response.data
  }

  /**
   * Classification and notes only. Amount, account, date and currency are
   * immutable once recorded (BR-03) — correcting one means cancelling and
   * recording a replacement.
   */
  async updateTransaction(
    workspaceId: number,
    transactionId: number,
    payload: TransactionUpdatePayload
  ): Promise<ApiResponse> {
    const response = await this.client.put<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/transactions/${transactionId}`,
      payload
    )
    return response.data
  }

  async cancelTransaction(
    workspaceId: number,
    transactionId: number,
    reason?: string
  ): Promise<ApiResponse> {
    const response = await this.client.delete<ApiResponse>(
      `/api/v1/workspaces/${workspaceId}/transactions/${transactionId}`,
      { data: { reason } }
    )
    return response.data
  }
}

export const financeApiService = new FinanceApiService()
