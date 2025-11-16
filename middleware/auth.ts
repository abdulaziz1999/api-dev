import { NextFunction, Request, Response } from 'express';
import { JWT, JwtPayload } from '../helpers/jwt.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  console.log('Authorization header:', authHeader);
  console.log('Authenticating token:', token);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  const payload = JWT.verifyAccessToken(token);
  if (!payload) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  req.user = payload;
  next();
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const payload = JWT.verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
};

export const requireRole = (roles: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};