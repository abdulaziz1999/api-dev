import { Request, Response } from 'express';
import { JWT, JwtPayload } from '../helpers/jwt.js';
import { AuthRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { stat } from 'fs';

// In-memory blacklist untuk token yang di-revoke (opsional, untuk logout)
// Dalam production, gunakan Redis atau database external
const tokenBlacklist = new Set<string>();

export class AuthController {
  // POST /auth/register - Register new user
  static async register(req: Request, res: Response) {
    console.log('Register request body:', req.body);
    try {
      const { name, email, password, role = '3', department_id = '2' } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      // Check if user already exists
      const existingUser = await new User()
        .where('email', email)
        .first();

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Create user
      const newUser = await User.createWithPassword({
        name,
        email,
        password,
        role,
        department_id,
        status: 'active'
      });

      // Generate tokens
      const jwtPayload: Omit<JwtPayload, 'type'> = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role
      };

      const accessToken = JWT.generateAccessToken(jwtPayload);
      const refreshToken = JWT.generateRefreshToken(jwtPayload);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userWithoutPassword,
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
            access_token_expires_in: 15 * 60, // 15 minutes in seconds
            refresh_token_expires_in: 7 * 24 * 60 * 60 // 7 days in seconds
          }
        }
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /auth/login - Login user
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user
      const user = await new User()
        .where('email', email)
        .first();

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isValidPassword = await User.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is not active'
        });
      }

      // Update last login
      await User.updateLastLogin(user.id);

      // Generate tokens
      const jwtPayload: Omit<JwtPayload, 'type'> = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = JWT.generateAccessToken(jwtPayload);
      const refreshToken = JWT.generateRefreshToken(jwtPayload);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        token: accessToken,
        statusCode: 200,
        status: 'success',
        data: {
        //   user: userWithoutPassword,
          // tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
            access_token_expires_in: 15 * 60, // 15 minutes in seconds
            refresh_token_expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
            access_token_expires_at: JWT.getTokenExpiration(accessToken),
            refresh_token_expires_at: JWT.getTokenExpiration(refreshToken)
          // }
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        statusCode: 500
      });
    }
  }

  // POST /auth/refresh - Refresh access token
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Check if token is blacklisted
      if (tokenBlacklist.has(refresh_token)) {
        return res.status(403).json({
          success: false,
          message: 'Refresh token has been revoked'
        });
      }

      // Verify refresh token
      const payload = JWT.verifyRefreshToken(refresh_token);
      if (!payload) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      // Verify user still exists and is active
      const user = await new User()
        .where('id', payload.userId)
        .first();

      if (!user || user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'User no longer exists or is inactive'
        });
      }

      // Generate new access token
      const newAccessToken = JWT.generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      });

      // Optional: Generate new refresh token (rotate refresh token)
      let newRefreshToken = refresh_token;
      const shouldRotateRefreshToken = JWT.getTimeUntilExpiration(refresh_token) < (24 * 60 * 60); // Rotate if less than 24 hours left

      if (shouldRotateRefreshToken) {
        newRefreshToken = JWT.generateRefreshToken({
          userId: payload.userId,
          email: payload.email,
          role: payload.role
        });
        // Add old refresh token to blacklist
        tokenBlacklist.add(refresh_token);
      }

      res.json({
        success: true,
        data: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          access_token_expires_in: 15 * 60, // 15 minutes in seconds
          refresh_token_expires_in: shouldRotateRefreshToken ? 7 * 24 * 60 * 60 : JWT.getTimeUntilExpiration(refresh_token),
          token_rotated: shouldRotateRefreshToken
        }
      });
    } catch (error: any) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /auth/logout - Logout user
  static async logout(req: AuthRequest, res: Response) {
    try {
      const { refresh_token } = req.body;
      const accessToken = req.headers['authorization']?.split(' ')[1];

      if (refresh_token) {
        // Add refresh token to blacklist
        tokenBlacklist.add(refresh_token);
      }

      if (accessToken) {
        // Optional: Add access token to blacklist (meskipun sudah expired cepat)
        // Dalam praktiknya, access token expiry pendek jadi tidak perlu blacklist
      }

      // Clean up old blacklisted tokens (optional)
      AuthController.cleanupTokenBlacklist();

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /auth/me - Get current user profile
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const userData = await new User()
        .select(['id', 'name', 'email', 'role_id', 'department_id', 'status'])
        .where('id', user.userId)
        .with(['role'])
        .first();

      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = userData;

      res.json({
        success: true,
        data: userWithoutPassword
      });
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /auth/verify - Verify token validity
//   static async verifyToken(req: Request, res: Response) {
//     try {
//       const { token, token_type = 'access' } = req.body;

//       if (!token) {
//         return res.status(400).json({
//           success: false,
//           message: 'Token is required'
//         });
//       }

//       let payload: JwtPayload | null = null;
//       let isExpired = false;

//       if (token_type === 'access') {
//         payload = JWT.verifyAccessToken(token);
//         isExpired = JWT.isTokenExpired(token, 'access');
//       } else {
//         payload = JWT.verifyRefreshToken(token);
//         isExpired = JWT.isTokenExpired(token, 'refresh');
        
//         // Check if refresh token is blacklisted
//         if (token_type === 'refresh' && tokenBlacklist.has(token)) {
//           return res.json({
//             success: false,
//             valid: false,
//             revoked: true,
//             message: 'Refresh token has been revoked'
//           });
//         }
//       }

//       const expiresAt = JWT.getTokenExpiration(token);
//       const timeUntilExpiration = JWT.getTimeUntilExpiration(token);

//       if (!payload) {
//         return res.json({
//           success: false,
//           valid: false,
//           expired: isExpired,
//           message: 'Invalid token'
//         });
//       }

//       res.json({
//         success: true,
//         valid: !isExpired,
//         expired: isExpired,
//         expires_at: expiresAt,
//         time_until_expiration: timeUntilExpiration,
//         user: {
//           userId: payload.userId,
//           email: payload.email,
//           role: payload.role
//         }
//       });
//     } catch (error: any) {
//       console.error('Token verification error:', error);
//       res.status(500).json({
//         success: false,
//         message: error.message
//       });
//     }
//   }
     // GET /auth/verify - Verify token validity from header
  static async verifyToken(req: Request, res: Response) {
    try {
      // Get token from Authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token is required in Authorization header'
        });
      }

      // Determine token type based on verification
      let payload: JwtPayload | null = null;
      let isExpired = false;
      let tokenType: 'access' | 'refresh' = 'access';
      console.log('Verifying token:', token);
      console.log('Authorization header:', authHeader);
      
      // Try to verify as access token first
      payload = JWT.verifyAccessToken(token);
      console.log('Access token payload:', payload);
      
      if (!payload) {
        // If not access token, try as refresh token
        payload = JWT.verifyRefreshToken(token);
        tokenType = 'refresh';
      }

      if (tokenType === 'access') {
        isExpired = JWT.isTokenExpired(token, 'access');
      } else {
        isExpired = JWT.isTokenExpired(token, 'refresh');
        
        // Check if refresh token is blacklisted
        if (tokenBlacklist.has(token)) {
          return res.json({
            success: true,
            valid: false,
            expired: isExpired,
            revoked: true,
            token_type: tokenType,
            message: 'Refresh token has been revoked'
          });
        }
      }

      const expiresAt = JWT.getTokenExpiration(token);
      const timeUntilExpiration = JWT.getTimeUntilExpiration(token);

      if (!payload) {
        return res.json({
          success: true,
          valid: false,
          expired: isExpired,
          token_type: 'unknown',
          message: 'Invalid token'
        });
      }

      res.json({
        success: true,
        message: 'Token is valid',
        valid: !isExpired,
        expired: isExpired,
        token_type: tokenType,
        expires_at: expiresAt,
        time_until_expiration: timeUntilExpiration,
        // user: {
        //   userId: payload.userId,
        //   email: payload.email,
        //   role: payload.role
        // }
      });
    } catch (error: any) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /auth/change-password - Change user password
  static async changePassword(req: AuthRequest, res: Response) {
    try {
      const user = req.user;
      const { current_password, new_password } = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!current_password || !new_password) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      // Get user with password
      const userData = await new User()
        .where('id', user.userId)
        .first();

      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isValidPassword = await User.verifyPassword(current_password, userData.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      await User.updateWithPassword(user.userId, {
        password: new_password
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Cleanup token blacklist (remove expired tokens)
  private static cleanupTokenBlacklist() {
    // Dalam production, implementasikan logika cleanup yang lebih robust
    // Ini hanya contoh sederhana
    if (tokenBlacklist.size > 1000) {
      // Reset blacklist jika terlalu besar (dalam production gunakan TTL)
      tokenBlacklist.clear();
    }
  }

  // POST /auth/blacklist-status - Check if token is blacklisted (for testing)
  static async checkBlacklistStatus(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token is required'
        });
      }

      const isBlacklisted = tokenBlacklist.has(token);

      res.json({
        success: true,
        data: {
          token,
          blacklisted: isBlacklisted,
          blacklist_size: tokenBlacklist.size
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}