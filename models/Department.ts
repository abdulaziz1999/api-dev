import { SheetModel } from '../helpers/SheetModel.js';
import { User } from '../models/User.js';

export class Department extends SheetModel {
  constructor() {
    super('departments');
  }

  // Relation: Department has many Users
  users() {
    return Department.hasMany(User, 'department_id', 'id');
  }
}