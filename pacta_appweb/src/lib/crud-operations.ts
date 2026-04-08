import { getDb } from "./db";

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public code?: string, public statusCode: number = 500) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Type for filter values supporting both simple and advanced operators
 */
type FilterValue = any | { operator: string; value: any };

/**
 * Utility class for common CRUD operations with SQLite
 */
export default class CrudOperations {
  constructor(private tableName: string) {}

  /**
   * Fetches multiple records with optional filtering, sorting, and pagination
   */
  async findMany(
    filters?: Record<string, FilterValue>,
    params?: {
      limit?: number;
      offset?: number;
      orderBy?: {
        column: string;
        direction: "asc" | "desc";
      };
    },
  ) {
    const { limit, offset, orderBy } = params || {};

    let sql = `SELECT * FROM ${this.tableName}`;
    const values: any[] = [];
    const whereClauses: string[] = [];

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && value !== null && 'operator' in value && 'value' in value) {
            const { operator, value: val } = value;
            switch (operator) {
              case 'eq':
                whereClauses.push(`${key} = ?`);
                values.push(val);
                break;
              case 'neq':
                whereClauses.push(`${key} != ?`);
                values.push(val);
                break;
              case 'gt':
                whereClauses.push(`${key} > ?`);
                values.push(val);
                break;
              case 'lt':
                whereClauses.push(`${key} < ?`);
                values.push(val);
                break;
              case 'gte':
                whereClauses.push(`${key} >= ?`);
                values.push(val);
                break;
              case 'lte':
                whereClauses.push(`${key} <= ?`);
                values.push(val);
                break;
              case 'like':
                whereClauses.push(`${key} LIKE ?`);
                values.push(val);
                break;
              case 'ilike':
                whereClauses.push(`LOWER(${key}) LIKE LOWER(?)`);
                values.push(val);
                break;
              case 'in':
                const placeholders = (val as any[]).map(() => '?').join(',');
                whereClauses.push(`${key} IN (${placeholders})`);
                values.push(...val);
                break;
              default:
                throw new ValidationError(`Unsupported filter operator: ${operator}`);
            }
          } else {
            whereClauses.push(`${key} = ?`);
            values.push(value);
          }
        }
      });
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (orderBy) {
      const dir = orderBy.direction === 'asc' ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${orderBy.column} ${dir}`;
    }

    if (limit && offset !== undefined) {
      sql += ` LIMIT ? OFFSET ?`;
      values.push(limit, offset);
    }

    try {
      const db = getDb();
      const rows = db.prepare(sql).all(...values);
      return rows;
    } catch (error: any) {
      console.error(`Database error in findMany for ${this.tableName}: ${error.message}`);
      throw new DatabaseError(`Failed to fetch ${this.tableName}: ${error.message}`, error.code);
    }
  }

  /**
   * Fetches a single record by its ID
   */
  async findById(id: string | number) {
    try {
      const db = getDb();
      const row = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
      return row || null;
    } catch (error: any) {
      console.error(`Database error in findById for ${this.tableName}: ${error.message}`);
      throw new DatabaseError(`Failed to fetch ${this.tableName} by id: ${error.message}`, error.code);
    }
  }

  /**
   * Creates a new record in the table
   */
  async create(data: Record<string, any>) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(',');
    const values = Object.values(data);

    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    try {
      const db = getDb();
      const result = db.prepare(sql).run(...values);
      return db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(result.lastInsertRowid);
    } catch (error: any) {
      console.error(`Database error in create for ${this.tableName}: ${error.message}`);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ValidationError(`Duplicate entry in ${this.tableName}`);
      }
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        throw new ValidationError(`Invalid foreign key reference in ${this.tableName}`);
      }
      throw new DatabaseError(`Failed to create ${this.tableName}: ${error.message}`, error.code);
    }
  }

  /**
   * Updates an existing record by ID
   */
  async update(id: string | number, data: Record<string, any>) {
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(',');
    const values = [...Object.values(data), id];

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;

    try {
      const db = getDb();
      const result = db.prepare(sql).run(...values);

      if (result.changes === 0) {
        return null;
      }

      return db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    } catch (error: any) {
      console.error(`Database error in update for ${this.tableName}: ${error.message}`);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ValidationError(`Duplicate entry in ${this.tableName}`);
      }
      throw new DatabaseError(`Failed to update ${this.tableName}: ${error.message}`, error.code);
    }
  }

  /**
   * Deletes a record by ID
   */
  async delete(id: string | number) {
    try {
      const db = getDb();
      const result = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);

      if (result.changes === 0) {
        return null;
      }

      return { id };
    } catch (error: any) {
      console.error(`Database error in delete for ${this.tableName}: ${error.message}`);
      throw new DatabaseError(`Failed to delete ${this.tableName}: ${error.message}`, error.code);
    }
  }
}
