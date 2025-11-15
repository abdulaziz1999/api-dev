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
}