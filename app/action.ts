'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with server-side credentials
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface Cell {
  x: number;
  y: number;
  energy: number;
}

export interface TransactionQueueItem {
  id?: number;
  x: number;
  y: number;
  energy: number;
  status: 'pending' | 'sent' | 'failed';
  hash?: string;
  timestamp: number;
  retries: number;
}

/**
 * Add or update a cell in the database
 */
export async function addCell(cell: Cell): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cells')
      .upsert({
        x: cell.x,
        y: cell.y,
        energy: cell.energy,
        timestamp: Date.now()
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - addCell:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all cells from the database
 */
export async function getCells(): Promise<{ cells: Cell[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cells')
      .select('*');

    if (error) throw error;
    return { cells: data || [] };
  } catch (error: any) {
    console.error('Server Action Error - getCells:', error);
    return { cells: [], error: error.message };
  }
}

/**
 * Add a transaction to the queue
 */
export async function addToTransactionQueue(cell: Cell): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('transaction_queue')
      .insert({
        x: cell.x,
        y: cell.y,
        energy: cell.energy,
        status: 'pending',
        timestamp: Date.now(),
        retries: 0
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - addToTransactionQueue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the next pending transaction from the queue
 */
export async function getNextPendingTransaction(): Promise<{ transaction: TransactionQueueItem | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('transaction_queue')
      .select('*')
      .eq('status', 'pending')
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return { transaction: data || null };
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      return { transaction: null }; // No pending transactions
    }
    console.error('Server Action Error - getNextPendingTransaction:', error);
    return { transaction: null, error: error.message };
  }
}

/**
 * Update a transaction status
 */
export async function updateTransactionStatus(
  id: number,
  status: 'sent' | 'failed',
  hash?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First get the current retries count
    const { data: currentTx } = await supabase
      .from('transaction_queue')
      .select('retries')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('transaction_queue')
      .update({
        status,
        hash,
        retries: (currentTx?.retries || 0) + 1
      })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - updateTransactionStatus:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old transactions
 */
export async function cleanupOldTransactions(): Promise<{ success: boolean; error?: string }> {
  try {
    const oneHourAgo = Date.now() - 3600000;
    
    const { error } = await supabase
      .from('transaction_queue')
      .delete()
      .lt('timestamp', oneHourAgo)
      .neq('status', 'pending');

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - cleanupOldTransactions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear all cells
 */
export async function clearAllCells(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cells')
      .delete()
      .neq('x', null);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - clearAllCells:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending transaction count
 */
export async function getPendingTransactionCount(): Promise<{ count: number; error?: string }> {
  try {
    const { data, error, count } = await supabase
      .from('transaction_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;
    return { count: count || 0 };
  } catch (error: any) {
    console.error('Server Action Error - getPendingTransactionCount:', error);
    return { count: 0, error: error.message };
  }
}