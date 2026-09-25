export interface RequestUser {
  id: string;
  email: string;
  role?: string;
  isManager: boolean;
  isActive: boolean;
}
