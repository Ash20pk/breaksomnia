export interface Cell {
  x: number;
  y: number;
  energy: number;
}

export interface Transaction {
  hash: string;
  x: number;
  y: number;
  energy: number;
  timestamp: number;
}
