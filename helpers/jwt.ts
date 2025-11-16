import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh'; // Tambahkan type untuk membedakan token
}

export class JWT {
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret';
  private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';
  private static readonly ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

  // Generate access token
  static generateAccessToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'access' }, 
      this.ACCESS_TOKEN_SECRET, 
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  // Generate refresh token
  static generateRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'refresh' }, 
      this.REFRESH_TOKEN_SECRET, 
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
  }

  // Verify access token
  static verifyAccessToken(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, this.ACCESS_TOKEN_SECRET) as JwtPayload;
      return payload.type === 'access' ? payload : null;
    } catch (error) {
      return null;
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, this.REFRESH_TOKEN_SECRET) as JwtPayload;
      return payload.type === 'refresh' ? payload : null;
    } catch (error) {
      return null;
    }
  }

  // Decode token tanpa verifikasi (untuk cek expired)
  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  // Check if token is expired
  static isTokenExpired(token: string, tokenType: 'access' | 'refresh' = 'access'): boolean {
    const secret = tokenType === 'access' ? this.ACCESS_TOKEN_SECRET : this.REFRESH_TOKEN_SECRET;
    
    try {
      jwt.verify(token, secret);
      return false;
    } catch (error: any) {
      return error.name === 'TokenExpiredError';
    }
  }

  // Get token expiration date
  static getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !(decoded as any).exp) return null;

    return new Date((decoded as any).exp * 1000);
  }

  // Get time until token expiration in seconds
  static getTimeUntilExpiration(token: string): number {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return 0;

    const now = new Date();
    return Math.max(0, Math.floor((expiration.getTime() - now.getTime()) / 1000));
  }
}