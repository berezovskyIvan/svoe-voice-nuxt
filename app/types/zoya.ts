export interface ZoyaProductItem {
  id: number
  name: string
  price: number
  qty: number
  unitLabel: string
  imageUrl: string
}

export interface ZoyaApiErrorPayload {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'PRICE_CHANGED'
      | 'INSUFFICIENT_FUNDS'
      | 'UNSUPPORTED_DELIVERY'
      | string
    message: string
    details?: {
      items: ZoyaProductItem[]
      totalPrice: number
    }
  }
}

export interface ZoyaDeliveryInfo {
  date: string
  slot: string
  address: string
}

export interface FarmerProductsPayload {
  items: ZoyaProductItem[]
  delivery: ZoyaDeliveryInfo | null
  deliveryIssue: 'UNSUPPORTED_DELIVERY' | null
  totalPrice: number
  unmatchedItems: string[]
}

export interface AnalyticsCategory {
  code: string
  name: string
  percent: number
  amount: number
}

export interface DepositDirectPayload {
  depositOffer?: DepositOffer
  rate?: number
  termMonths?: number
  minAmount?: number
  maxAmount?: number
  defaultAmount?: number | null
  accountBalance?: number
  aiAdvice?: string
}

export interface DepositIntentResponse {
  intent: 'deposit'
  recognizedText: string
  payload: DepositDirectPayload
}

export interface DepositOffer {
  accountBalance: number
  currency: 'RUB'
  defaultAmount: number | null
  minAmount: number
  maxAmount: number
  rate: 14
  termMonths: 6
}

export interface AnalyticsPayload {
  period: string
  totalSpent: number
  categories: AnalyticsCategory[]
  aiAdvice: string
  depositOffer: DepositOffer
}

export type AssistantResponse =
  | {
      intent: 'farmer-products'
      recognizedText: string
      payload: FarmerProductsPayload
    }
  | {
      intent: 'analytics'
      recognizedText: string
      payload: AnalyticsPayload
    }
  | {
      intent: 'deposit'
      recognizedText: string
      message: string
    }
  | {
      intent: 'unknown'
      recognizedText: string
      message: string
    }

export interface CreateOrderRequest {
  items: Array<{
    id: number
    qty: number
  }>
  expectedTotalPrice: number
  deliveryDate: string
  deliverySlot: string
}

export interface CreateOrderResponse {
  orderId: number
  totalPrice: number
  newBalance: number
}

export interface CreateDepositRequest {
  amount: number
}

export interface CreateDepositResponse {
  depositId: number
  amount: number
  currency: 'RUB'
  rate: 14
  termMonths: 6
  estimatedInterest: number
  estimatedTotal: number
  newBalance: number
}

export type HistoryItemType = 'analytics' | 'demo' | 'deposit' | 'order'

export interface HistoryItem {
  id: number
  title: string
  subtitle: string
  amount: number | null
  type: HistoryItemType
  createdAt: string
}

export interface HistoryResponse {
  user: {
    name: string
  }
  balance: number
  history: HistoryItem[]
}

export interface ResetDemoResponse {
  status: 'ok'
  message: 'Demo reset completed'
}

export interface WsVoiceStopMessage {
  type: 'stop'
}

export type WsVoiceIncomingMessage =
  | {
      type: 'ready'
    }
  | {
      type: 'partial' | 'transcript'
      text: string
      isFinal?: boolean
    }
  | {
      type: 'result'
      data: AssistantResponse
    }
  | {
      type: 'error'
      message: string
      code?: string
    }

export type ActiveView = 'HOME' | 'MARKET' | 'ANALYTICS'

export type VoiceDockState =
  'IDLE' | 'LISTENING' | 'PAUSED_2S' | 'PROCESSING' | 'ERROR' | 'NO_PERMISSION'
