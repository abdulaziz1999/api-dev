import { SheetModel } from '../helpers/SheetModel.js';
import { User } from '../models/User.js';

export class Role extends SheetModel {
  constructor() {
    super('roles');
  }

  users() {
    return Role.hasMany(User, 'role_id', 'id');
  }
}