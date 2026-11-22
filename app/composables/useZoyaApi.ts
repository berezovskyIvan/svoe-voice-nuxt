import type {
  AssistantResponse,
  CreateDepositRequest,
  CreateDepositResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  HistoryResponse,
  ResetDemoResponse,
  ZoyaApiErrorPayload,
} from '@/types/zoya'

export class ZoyaApiError extends Error {
  code: string
  details?: ZoyaApiErrorPayload['error']['details']

  constructor(
    code: string,
    message: string,
    details?: ZoyaApiErrorPayload['error']['details'],
  ) {
    super(message)
    this.name = 'ZoyaApiError'
    this.code = code
    this.details = details
  }
}

export function useZoyaApi() {
  const config = useRuntimeConfig()
  const baseURL = config.public.zoyaApiBase

  const nuxtContractHeaders = {
    'X-Zoya-Contract': 'nuxt',
  }

  function normalizeError(err: unknown): never {
    const fetchErr = err as { data?: ZoyaApiErrorPayload }
    if (fetchErr?.data?.error) {
      const { code, message, details } = fetchErr.data.error
      throw new ZoyaApiError(code, message, details)
    }
    throw new ZoyaApiError(
      'NETWORK_ERROR',
      'Не удалось связаться с сервером. Проверьте соединение.',
    )
  }

  function resolveImageUrl(relativePath: string): string {
    if (!relativePath) return ''
    try {
      return new URL(relativePath, baseURL).href
    } catch {
      return relativePath
    }
  }

  async function fetchHistory(): Promise<HistoryResponse> {
    try {
      return await $fetch<HistoryResponse>('/api/actions/history', {
        baseURL,
        headers: nuxtContractHeaders,
      })
    } catch (err) {
      return normalizeError(err)
    }
  }

  async function sendTextCommand(text: string): Promise<AssistantResponse> {
    try {
      return await $fetch<AssistantResponse>('/api/assistant/text', {
        baseURL,
        method: 'POST',
        headers: nuxtContractHeaders,
        body: { text },
      })
    } catch (err) {
      return normalizeError(err)
    }
  }

  async function confirmOrder(
    payload: CreateOrderRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<CreateOrderResponse> {
    try {
      return await $fetch<CreateOrderResponse>('/api/actions/order', {
        baseURL,
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: payload,
        retry: 0,
      })
    } catch (err) {
      return normalizeError(err)
    }
  }

  async function confirmDeposit(
    payload: CreateDepositRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<CreateDepositResponse> {
    try {
      return await $fetch<CreateDepositResponse>('/api/actions/deposit', {
        baseURL,
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: { amount: payload.amount },
        retry: 0,
      })
    } catch (err) {
      return normalizeError(err)
    }
  }

  async function resetDemo(): Promise<ResetDemoResponse> {
    try {
      return await $fetch<ResetDemoResponse>('/api/actions/reset', {
        baseURL,
        method: 'POST',
        retry: 0,
      })
    } catch (err) {
      return normalizeError(err)
    }
  }

  return {
    fetchHistory,
    sendTextCommand,
    confirmOrder,
    confirmDeposit,
    resetDemo,
    resolveImageUrl,
  }
}
