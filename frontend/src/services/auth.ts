import { api } from './api'

export interface User {
  id: number
  name: string
  email: string
  miles: number
  tier: 'BLUE' | 'RED' | 'RAINBOW'
  is_admin: boolean
  created_at: string
}

interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export async function signup(name: string, email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/signup', { name, email, password })
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', { email, password })
}

export async function fetchMe(): Promise<User> {
  return api.get<User>('/auth/me')
}
