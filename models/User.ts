import { SheetModel } from '../helpers/SheetModel.js';
import { Department } from '../models/Department.js';

export class User extends SheetModel {
  constructor() {
    super('users'); // Nama sheet di Google Sheets
  }

  // Definisikan relations
  department() {
    return User.belongsTo(Department, 'department_id', 'id');
  }

  // posts() {
  //   return User.hasMany(Post, 'user_id', 'id');
  // }

  // profile() {
  //   return User.hasOne(Profile, 'user_id', 'id');
  // }
}