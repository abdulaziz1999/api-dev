import { Request, Response } from 'express';
import { User } from '../models/User.js';

export class UserController {
  // GET /users - Get all users with relations
  static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await User.all();
      
      res.json({
        success: true,
        data: users,
        count: users.length
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /users/with-relations - Get users with eager loading
  static async getUsersWithRelations(req: Request, res: Response) {
    try {
      const users = await new User()
        .with(['department', 'role'])
        .get();

      res.json({
        success: true,
        data: users
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /users/:id - Get single user by ID
  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await User.find(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /users/:id/full - Get user with all relations
  static async getUserFullProfile(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const user = await new User()
        .where('id', id)
        .with([
          'department',
          'posts',
          'profile',
          { 
            'posts': ['comments'] // Nested relation: posts with comments
          }
        ])
        .first();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /users - Create new user
  static async createUser(req: Request, res: Response) {
    try {
      const { name, email, department_id, role } = req.body;

      const user = new User();
      const newUser = await user.create({
        name,
        email,
        department_id,
        role,
        created_at: new Date().toISOString()
      });

      res.status(201).json({
        success: true,
        data: newUser
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // PUT /users/:id - Update user
  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const user = new User();
      const updatedUser = await user.update(id, {
        ...updateData,
        updated_at: new Date().toISOString()
      });

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: updatedUser
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // DELETE /users/:id - Delete user
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = new User();
      const result = await user.delete(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /users/search - Advanced query examples
  static async searchUsers(req: Request, res: Response) {
    try {
      const { 
        name, 
        email, 
        role, 
        department_id,
        sort = 'name',
        order = 'asc',
        page = '1',
        limit = '10'
      } = req.query;

      let query = new User();

      // Apply filters
      if (name) {
        query = query.where('name', 'like', `%${name}%`);
      }

      if (email) {
        query = query.where('email', 'like', `%${email}%`);
      }

      if (role) {
        query = query.where('role', role);
      }

      if (department_id) {
        query = query.where('department_id', department_id);
      }

      // Apply sorting and pagination
      const users = await query
        .with(['department'])
        .orderBy(sort as string, order as 'asc' | 'desc')
        .paginate(parseInt(limit as string), parseInt(page as string));

      res.json({
        success: true,
        ...users
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /users/advanced - More complex queries
  static async advancedQuery(req: Request, res: Response) {
    try {
      // Example 1: Multiple where conditions
      const activeAdmins = await new User()
        .where('role', 'admin')
        .where('status', 'active')
        .with(['department'])
        .get();

      // Example 2: OR conditions
      const specificUsers = await new User()
        .where('role', 'admin')
        .orWhere('role', 'manager')
        .get();

      // Example 3: Select specific columns
      const userEmails = await new User()
        .select(['id', 'name', 'email'])
        .get();

      // Example 4: Limit and offset
      const recentUsers = await new User()
        .orderBy('created_at', 'desc')
        .limit(5)
        .get();

      res.json({
        success: true,
        data: {
          activeAdmins,
          specificUsers,
          userEmails,
          recentUsers
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
