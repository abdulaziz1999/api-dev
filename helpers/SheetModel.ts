// 📁 helpers/SheetModel.ts
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const key = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
// const key = JSON.parse(fs.readFileSync('credentials.json', 'utf-8'));
const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// === TYPE DEFINITIONS ===
interface QueryCondition {
  column: string;
  operator: string;
  value: any;
}

interface RelationConfig {
  relation: string;
  nested: any;
}

interface PaginationResult {
  data: any[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

interface FetchWithHeadersResult {
  rows: any[][];
  headers: string[];
}

interface RowData {
  [key: string]: any;
}

// === MAIN CLASS ===
export class SheetModel {
  protected sheetName: string;
  protected rows: RowData[];
  protected query: QueryCondition[];
  protected orQuery: QueryCondition[];
  protected selectedColumns: string[] | null;
  protected sortColumn: string | null;
  protected sortDirection: 'asc' | 'desc';
  protected groupByColumn: string | null;
  protected limitCount: number | null;
  protected offsetCount: number;
  protected isDistinct: boolean;
  protected withRelations: RelationConfig[];
  protected relationStack: string[];

  constructor(sheetName: string | null = null) {
    this.sheetName = sheetName || this.constructor.name.toLowerCase() + 's';
    this.rows = [];
    this.query = [];
    this.orQuery = [];
    this.selectedColumns = null;
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.groupByColumn = null;
    this.limitCount = null;
    this.offsetCount = 0;
    this.isDistinct = false;
    this.withRelations = [];
    this.relationStack = [];
  }

  // === BASIC CRUD OPERATIONS ===
  static async all(this: new () => SheetModel): Promise<RowData[]> {
    const instance = new this();
    return await instance.fetchData();
  }

  static async find(this: new () => SheetModel, id: string): Promise<RowData | null> {
    const instance = new this();
    const rows = await instance.fetchData();
    return rows.find(row => row.id === id) || null;
  }

  async create(data: RowData): Promise<RowData> {
    const rows = await this.fetchData();
    const headers = Object.keys(rows[0] || data);
    const id = uuidv4();

    const newRow = headers.map(h => (h === 'id' ? id : data[h] || ''));
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: this.sheetName,
      valueInputOption: 'RAW',
      requestBody: { values: [newRow] },
    });

    return { id, ...data };
  }

  async update(id: string, data: RowData): Promise<RowData | null> {
    const { rows, headers } = await this.fetchWithHeaders();
    const idIndex = headers.indexOf('id');
    const rowIndex = rows.findIndex(r => r[idIndex] === id);
    if (rowIndex === -1) return null;

    const updatedRow = headers.map(h => {
      if (h === 'id') return id;
      return data[h] ?? rows[rowIndex][headers.indexOf(h)] ?? '';
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${this.sheetName}!A${rowIndex + 2}:Z${rowIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [updatedRow] },
    });

    return { id, ...data };
  }

  async delete(id: string): Promise<boolean> {
    const { rows, headers } = await this.fetchWithHeaders();
    const idIndex = headers.indexOf('id');
    const rowIndex = rows.findIndex(r => r[idIndex] === id);
    if (rowIndex === -1) return false;

    rows.splice(rowIndex, 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: this.sheetName,
      valueInputOption: 'RAW',
      requestBody: { values: [headers, ...rows] },
    });

    return true;
  }

  // === QUERY BUILDER ===
  where(column: string, operatorOrValue: any, value: any = null): this {
    let operator = '=';
    if (value === null) {
      value = operatorOrValue;
    } else {
      operator = operatorOrValue;
    }
    this.query.push({ column, operator, value });
    return this;
  }

  orWhere(column: string, operatorOrValue: any, value: any = null): this {
    let operator = '=';
    if (value === null) {
      value = operatorOrValue;
    } else {
      operator = operatorOrValue;
    }
    this.orQuery.push({ column, operator, value });
    return this;
  }

  whereIn(column: string, values: any[] = []): this {
    this.query.push({ column, operator: 'in', value: values });
    return this;
  }

  select(columns: string | string[]): this {
    this.selectedColumns = Array.isArray(columns) ? columns : [columns];
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.sortColumn = column;
    this.sortDirection = direction.toLowerCase() === 'desc' ? 'desc' : 'asc';
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  offset(count: number): this {
    this.offsetCount = count;
    return this;
  }

  // === RELATION SYSTEM ===
  with(relations: string | string[] | { [key: string]: any }): this {
    if (typeof relations === 'string') {
      this.withRelations.push({ relation: relations, nested: null });
    } else if (Array.isArray(relations)) {
      relations.forEach(rel => {
        if (typeof rel === 'string') {
          this.withRelations.push({ relation: rel, nested: null });
        } else if (typeof rel === 'object') {
          Object.entries(rel).forEach(([relation, nested]) => {
            this.withRelations.push({ relation, nested });
          });
        }
      });
    } else if (typeof relations === 'object') {
      Object.entries(relations).forEach(([relation, nested]) => {
        this.withRelations.push({ relation, nested });
      });
    }
    return this;
  }

  // Dalam class SheetModel - tambahkan method hasOne
  static hasOne(relatedModel: typeof SheetModel, foreignKey: string, localKey: string = 'id') {
    return async (parentData: RowData | RowData[]): Promise<any> => {
      const related = new relatedModel();
      const localKeys = Array.isArray(parentData)
        ? parentData.map(p => p[localKey])
        : [parentData[localKey]];
      
      // Untuk hasOne: cari related record dimana relatedModel[foreignKey] = parent[localKey]
      const results = await related.whereIn(foreignKey, localKeys).get();
      
      // Buat map: key = foreignKey value, value = related record
      const resultsMap = new Map();
      results.forEach(result => {
        resultsMap.set(result[foreignKey], result);
      });
      
      if (Array.isArray(parentData)) {
        return parentData.map(p => resultsMap.get(p[localKey]) || null);
      } else {
        return resultsMap.get(parentData[localKey]) || null;
      }
    };
  }

  static hasMany(relatedModel: typeof SheetModel, foreignKey: string, localKey: string = 'id') {
    return async (parentData: RowData | RowData[]): Promise<any> => {
      const related = new relatedModel();
      const foreignKeys = Array.isArray(parentData) 
        ? parentData.map(p => p[localKey])
        : [parentData[localKey]];
      
      return await related.whereIn(foreignKey, foreignKeys).get();
    };
  }

  static belongsTo(relatedModel: typeof SheetModel, foreignKey: string, ownerKey: string = 'id') {
    return async (parentData: RowData | RowData[]): Promise<any> => {
      const related = new relatedModel();
      const foreignValues = Array.isArray(parentData)
        ? parentData.map(p => p[foreignKey])
        : [parentData[foreignKey]];
      
      const results = await related.whereIn(ownerKey, foreignValues).get();
      const resultsMap = new Map(results.map(r => [r[ownerKey], r]));
      
      if (Array.isArray(parentData)) {
        return parentData.map(p => resultsMap.get(p[foreignKey]) || null);
      } else {
        return resultsMap.get(parentData[foreignKey]) || null;
      }
    };
  }

  // === EAGER LOADING IMPLEMENTATION ===
  async loadRelations(data: RowData | RowData[]): Promise<RowData | RowData[]> {
    if (!this.withRelations.length || !data || (Array.isArray(data) && data.length === 0)) {
      return data;
    }

    const isArray = Array.isArray(data);
    const items = isArray ? data : [data];

    for (const { relation, nested } of this.withRelations) {
      if (this.relationStack.includes(relation)) {
        console.warn(`Circular relation detected: ${relation}`);
        continue;
      }

      this.relationStack.push(relation);
      
      if (!(this as any)[relation]) {
        console.warn(`Relation method not found: ${relation}`);
        this.relationStack.pop();
        continue;
      }

      const relationLoader = (this as any)[relation]();
      let relatedData = await relationLoader(items);

      // Handle nested relations
      if (nested && relatedData) {
        const relatedModel = this.getRelatedModel(relation);
        if (relatedModel) {
          if (Array.isArray(relatedData)) {
            const nestedModel = new relatedModel();
            nestedModel.with(nested);
            relatedData = await nestedModel.loadRelations(relatedData);
          } else if (relatedData && typeof relatedData === 'object') {
            const nestedModel = new relatedModel();
            nestedModel.with(nested);
            relatedData = await nestedModel.loadRelations([relatedData]);
            relatedData = relatedData[0];
          }
        }
      }

      // Attach related data
      if (Array.isArray(relatedData)) {
        const relatedMap = this.buildRelationMap(relation, items, relatedData);
        this.attachRelations(items, relation, relatedMap);
      } else {
        items.forEach(item => {
          item[relation] = relatedData;
        });
      }

      this.relationStack.pop();
    }

    return isArray ? items : items[0];
  }

  buildRelationMap(relation: string, parents: RowData[], children: RowData[]): Map<any, any> {
    const map = new Map();
    
    console.log(`🔍 Building relation map for: ${relation}`);
    console.log(`📊 Parents: ${parents.length}, Children: ${children.length}`);
    
    // Cek tipe relasi berdasarkan children
    const isHasOneRelation = children.length > 0 && 
      !Array.isArray(children[0]) && 
      typeof children[0] === 'object' &&
      children[0] !== null;

    parents.forEach(parent => {
      const parentId = parent.id;
      
      let related: RowData[] = [];
      
      if (isHasOneRelation) {
        // Untuk hasOne: children adalah single objects
        // Cari child yang punya foreign key yang match dengan parent local key
        const matchingChild = children.find(child => {
          // Untuk hasOne, kita perlu tahu foreign key yang digunakan
          const possibleForeignKeys = [
            'id', // Department.id = user.department_id
            `${parent.constructor.name.toLowerCase()}_id`,
            `${this.sheetName.slice(0, -1)}_id`
          ];
          
          for (const key of possibleForeignKeys) {
            if ((child as any)[key] === parent.department_id) { // Special case untuk department
              console.log(`✅ HASONE Match found: ${key} = ${parent.department_id}`);
              return true;
            }
          }
          return false;
        });
        
        if (matchingChild) {
          related = [matchingChild];
        }
      } else {
        // Untuk hasMany: children adalah array of objects
        related = children.filter(child => {
          const possibleForeignKeys = [
            `${this.constructor.name.toLowerCase()}_id`,
            `${this.sheetName.slice(0, -1)}_id`,
            'user_id',
            'author_id',
            'post_id', 
            'department_id',
            'parent_id'
          ];
          
          for (const key of possibleForeignKeys) {
            if ((child as any)[key] === parentId) {
              console.log(`✅ HASMANY Match found: ${key} = ${parentId}`);
              return true;
            }
          }
          
          console.log(`❌ No foreign key match for parent ${parentId}`);
          console.log(`Available keys in child:`, Object.keys(child));
          return false;
        });
      }
      
      // Set hasil ke map
      if (isHasOneRelation && related.length > 0) {
        map.set(parentId, related[0]); // Single object untuk hasOne
      } else {
        map.set(parentId, related); // Array untuk hasMany
      }
      
      console.log(`📦 Parent ${parentId} has ${related.length} related records`);
    });
    
    return map;
  }

  // Tambahkan method untuk debug relations
  async debugRelations(): Promise<this> {
    console.log('🐛 DEBUG RELATIONS:');
    console.log('With Relations:', this.withRelations);
    console.log('Sheet Name:', this.sheetName);
    
    const data = await this.fetchData();
    console.log('Raw Data Sample:', data.slice(0, 2));
    
    if (this.withRelations.length > 0) {
      for (const { relation } of this.withRelations) {
        console.log(`Relation "${relation}":`, (this as any)[relation] ? 'EXISTS' : 'MISSING');
      }
    }
    
    return this;
  }

  attachRelations(items: RowData[], relation: string, relationMap: Map<any, any>): void {
    items.forEach(item => {
      const itemId = item.id;
      item[relation] = relationMap.get(itemId) || [];
    });
  }

  getRelatedModel(relation: string): typeof SheetModel | null {
    // Override di child classes
    return null;
  }

  // === DATA FETCHING ===
  async fetchData(): Promise<RowData[]> {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: this.sheetName,
      });

      const rows = res.data.values || [];
      if (rows.length === 0) return [];

      const headers = rows[0];
      const dataRows = rows.slice(1);
      
      return dataRows.map(row => {
        const obj: RowData = {};
        headers.forEach((h, i) => (obj[h] = row[i] || ''));
        return obj;
      });
    } catch (error: any) {
      console.error(`Error fetching data from ${this.sheetName}:`, error.message);
      return [];
    }
  }

  async fetchWithHeaders(): Promise<FetchWithHeadersResult> {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: this.sheetName,
    });
    const rows = res.data.values || [];
    const headers = rows.shift() || [];
    return { rows, headers };
  }

  static compare(rowValue: any, operator: string, value: any): boolean {
    rowValue = String(rowValue ?? '').toLowerCase();
    value = Array.isArray(value) ? value.map(v => String(v).toLowerCase()) : String(value ?? '').toLowerCase();

    switch (operator) {
      case '=': return rowValue === value;
      case '!=': return rowValue !== value;
      case '>': return parseFloat(rowValue) > parseFloat(value);
      case '<': return parseFloat(rowValue) < parseFloat(value);
      case '>=': return parseFloat(rowValue) >= parseFloat(value);
      case '<=': return parseFloat(rowValue) <= parseFloat(value);
      case 'contains': return rowValue.includes(value);
      case 'like':
        const pattern = value.replace(/%/g, '.*');
        return new RegExp(`^${pattern}$`, 'i').test(rowValue);
      case 'in': return Array.isArray(value) && value.includes(rowValue);
      case 'notin': return Array.isArray(value) && !value.includes(rowValue);
      default: return rowValue === value;
    }
  }

  async get(columns: string | string[] | null = null): Promise<RowData[]> {
    let data = this.rows.length ? this.rows : await this.fetchData();

    // Apply queries
    if (this.query.length) {
      data = data.filter(row =>
        this.query.every(q => (this.constructor as typeof SheetModel).compare(row[q.column], q.operator, q.value))
      );
    }

    if (this.orQuery.length) {
      const all = await this.fetchData();
      const orFiltered = all.filter(row =>
        this.orQuery.some(q => (this.constructor as typeof SheetModel).compare(row[q.column], q.operator, q.value))
      );
      data = [...new Map([...data, ...orFiltered].map(v => [v.id, v])).values()];
    }

    // Sorting
    if (this.sortColumn) {
      data.sort((a, b) => {
        const av = a[this.sortColumn!];
        const bv = b[this.sortColumn!];
        if (av < bv) return this.sortDirection === 'asc' ? -1 : 1;
        if (av > bv) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Pagination
    if (this.offsetCount) {
      data = data.slice(this.offsetCount);
    }

    if (this.limitCount) {
      data = data.slice(0, this.limitCount);
    }

    // Column selection
    const selected = columns || this.selectedColumns;
    if (selected) {
      const selArray = Array.isArray(selected) ? selected : [selected];
      data = data.map(row => {
        const obj: RowData = {};
        selArray.forEach(c => (obj[c] = row[c]));
        return obj;
      });
    }

    // Load relations
    return await this.loadRelations(data) as RowData[];
  }

  async first(): Promise<RowData | null> {
    const results = await this.limit(1).get();
    return results[0] || null;
  }

  async paginate(perPage: number = 10, page: number = 1): Promise<PaginationResult> {
    const all = await this.get();
    const total = all.length;
    const offset = (page - 1) * perPage;
    const data = all.slice(offset, offset + perPage);

    return {
      data,
      total,
      per_page: perPage,
      current_page: page,
      last_page: Math.ceil(total / perPage),
    };
  }

  async count(): Promise<number> {
    const data = await this.get();
    return Array.isArray(data) ? data.length : Object.keys(data).length;
  }
}
