import { STOCK_SHEETS } from '../constants';

export interface StockSheet {
  id: string;
  label: string;
  width: number;
  height: number;
  thickness: number;
}

export const stockSheetsForThickness = (thickness: number): StockSheet[] =>
  STOCK_SHEETS.map((sheet) => ({ ...sheet, thickness }));
