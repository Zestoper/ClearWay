import { api } from './api'

export interface BookingRecord {
  booking_ref: string
  fare_class: string
  seat_number: string | null
  passenger_name_ko: string
  passenger_last_name_en: string
  passport_no: string
  email: string
  phone: string
  price: number
  miles_earned: number
  status: string
  created_at: string
  flight: {
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
    is_cancelled: boolean
  }
}

export interface BookingCreatePayload {
  flight_id: number
  fare_class: string
  seat_number?: string
  seat_surcharge?: number
  passenger_name_ko: string
  passenger_last_name_en: string
  passport_no: string
  email: string
  phone: string
}

export async function fetchMyBookings(): Promise<BookingRecord[]> {
  return api.get<BookingRecord[]>('/bookings/me')
}

export async function lookupBooking(booking_ref: string, last_name: string): Promise<BookingRecord> {
  return api.get<BookingRecord>(`/bookings/lookup?booking_ref=${encodeURIComponent(booking_ref)}&last_name=${encodeURIComponent(last_name)}`)
}

export async function claimBooking(booking_ref: string, last_name: string): Promise<BookingRecord> {
  return api.post<BookingRecord>('/bookings/claim', { booking_ref, last_name })
}

export async function createBooking(payload: BookingCreatePayload): Promise<BookingRecord> {
  return api.post<BookingRecord>('/bookings', payload)
}

export async function doCheckin(booking_ref: string): Promise<BookingRecord> {
  return api.post<BookingRecord>(`/bookings/${booking_ref}/checkin`, {})
}

export async function publicCheckin(booking_ref: string, last_name: string): Promise<BookingRecord> {
  return api.post<BookingRecord>(`/bookings/public/${booking_ref}/checkin?last_name=${encodeURIComponent(last_name)}`, {})
}

export interface CancelResult extends BookingRecord {
  _refund_amount: number
  _refund_rate: number
}

export async function cancelBooking(booking_ref: string): Promise<CancelResult> {
  return api.post<CancelResult>(`/bookings/${booking_ref}/cancel`, {})
}
