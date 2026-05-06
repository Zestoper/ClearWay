export type FareClass = 'economy' | 'business'

export interface SearchParams {
  from_code: string
  to_code: string
  date: string
  tripType?: 'oneway' | 'roundtrip'
  returnDate?: string
  passengerCount?: number
  childrenCount?: number
  infantCount?: number
}

export interface ReturnFlightInfo {
  flightId: number
  flightNo: string
  from: { city: string; code: string; airport: string; country: string }
  to:   { city: string; code: string; airport: string; country: string }
  date: string
  departTime: string
  arrivalTime: string
  duration: string
  price: number
}

export interface BookingFlight {
  flightId: number
  flightNo: string
  from: { city: string; code: string; airport: string; country: string }
  to:   { city: string; code: string; airport: string; country: string }
  date: string
  departTime: string
  arrivalTime: string
  duration: string
  fareClass: FareClass
  price: number
  returnFlight?: ReturnFlightInfo
  passengerCount?: number
}
