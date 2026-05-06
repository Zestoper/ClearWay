import { api } from './api'

export interface Flight {
  id: number
  flight_no: string
  from_city: string
  from_code: string
  from_airport: string
  to_city: string
  to_code: string
  to_airport: string
  date: string
  depart_time: string
  arrival_time: string
  duration: string
  economy_price: number
  business_price: number
  economy_seats: number
  business_seats: number
  is_direct: boolean
  via_city: string | null
}

export async function fetchFlights(params?: { from_code?: string; to_code?: string; date?: string }): Promise<Flight[]> {
  const qs = new URLSearchParams()
  if (params?.from_code) qs.set('from_code', params.from_code)
  if (params?.to_code)   qs.set('to_code', params.to_code)
  if (params?.date)      qs.set('date', params.date)
  const query = qs.toString() ? `?${qs}` : ''
  return api.get<Flight[]>(`/flights${query}`)
}
