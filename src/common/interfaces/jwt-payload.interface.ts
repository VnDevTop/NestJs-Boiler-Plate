export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  isManager?: boolean;
}
