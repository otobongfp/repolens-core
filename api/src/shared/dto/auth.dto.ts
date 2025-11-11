export class RegisterDto {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
}

export class LoginDto {
  email: string;
  password: string;
}

export class RefreshTokenDto {
  refreshToken: string;
}

export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserDto;
}

export class UserDto {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  isVerified: boolean;
  role: string;
  tenantId: string;
}

export class OAuthUrlDto {
  authorizationUrl: string;
}

