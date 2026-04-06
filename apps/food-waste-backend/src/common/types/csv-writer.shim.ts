/**
 * Shim module declaration for csv-writer.
 *
 * csv-writer@1.6.0 ships TypeScript source files (types: "src/index.ts") which
 * contain exactOptionalPropertyTypes-incompatible code. Since skipLibCheck only
 * skips .d.ts files, we shadow the package with this declaration to prevent
 * the compiler from type-checking the upstream .ts sources.
 */
declare module 'csv-writer' {
  export interface ObjectStringifierHeader {
    id: string;
    title: string;
  }

  export interface CsvStringifier<T> {
    getHeaderString(): string;
    stringifyRecords(records: T[]): string;
  }

  export type ObjectCsvStringifier = CsvStringifier<Record<string, unknown>>;
  export type ArrayCsvStringifier = CsvStringifier<unknown[]>;

  export interface CsvWriter<T> {
    writeRecords(records: T[]): Promise<void>;
  }

  export function createObjectCsvWriter(params: {
    path: string;
    header: ObjectStringifierHeader[];
    fieldDelimiter?: string;
    recordDelimiter?: string;
    headerIdDelimiter?: string;
    alwaysQuote?: boolean;
    encoding?: string;
    append?: boolean;
  }): CsvWriter<Record<string, unknown>>;

  export function createArrayCsvWriter(params: {
    path: string;
    header?: string[];
    fieldDelimiter?: string;
    recordDelimiter?: string;
    alwaysQuote?: boolean;
    encoding?: string;
    append?: boolean;
  }): CsvWriter<unknown[]>;

  export function createObjectCsvStringifier(params: {
    header: ObjectStringifierHeader[];
    fieldDelimiter?: string;
    recordDelimiter?: string;
    headerIdDelimiter?: string;
    alwaysQuote?: boolean;
  }): ObjectCsvStringifier;

  export function createArrayCsvStringifier(params: {
    header?: string[];
    fieldDelimiter?: string;
    recordDelimiter?: string;
    alwaysQuote?: boolean;
  }): ArrayCsvStringifier;
}
