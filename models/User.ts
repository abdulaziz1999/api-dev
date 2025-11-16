import bcrypt from 'bcryptjs';
import { SheetModel } from '../helpers/SheetModel.js';
import { Department } from '../models/Department.js';
import { Role } from '../models/Role.js';

export class User extends SheetModel {
  constructor() {
    super('users'); // Nama sheet di Google Sheets
  }

  // Definisikan relations
  department() {
    return User.belongsTo(Department, 'department_id', 'id');
  }

  role() {
    return User.belongsTo(Role, 'role_id', 'id');
  }

  // profile() {
  //   return User.hasOne(Profile, 'user_id', 'id');
  // }
  // Method untuk hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Method untuk verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Method untuk create user dengan password terhash
  static async createWithPassword(userData: any): Promise<any> {
    const user = new User();
    
    if (userData.password) {
      userData.password = await this.hashPassword(userData.password);
    }

    userData.created_at = new Date().toISOString();
    userData.updated_at = new Date().toISOString();

    return await user.create(userData);
  }

  // Method untuk update user dengan password terhash
  static async updateWithPassword(id: string, userData: any): Promise<any> {
    const user = new User();
    
    if (userData.password) {
      userData.password = await this.hashPassword(userData.password);
    }

    userData.updated_at = new Date().toISOString();

    return await user.update(id, userData);
  }

  // Method untuk update last login
  static async updateLastLogin(id: string): Promise<void> {
    const user = new User();
    await user.update(id, {
      last_login: new Date().toISOString()
    });
  }

}