'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with server-side credentials
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Check if Supabase connection is working
 */
export async function checkSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Try a simple query to check if the connection works
    const { data, error } = await supabase
      .from('transaction_queue')
      .select('count(*)', { count: 'exact', head: true });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - checkSupabaseConnection:', error);
    return { success: false, error: error.message };
  }
}

// Transaction types - defined as constants but NOT exported
const TX_TYPE_REACTION = 'reaction';
const TX_TYPE_EXPLOSION = 'explosion';

export interface Cell {
  id: string;     // Added ID field
  x: number;
  y: number;
  energy: number;
  type?: string;  // Optional type field
}

export interface TransactionQueueItem {
  id?: number;    // Database ID for the queue item
  atom_id?: string; // Reference to the atom's ID
  x: number;
  y: number;
  energy: number;
  status: 'pending' | 'sent' | 'failed';
  hash?: string;
  timestamp: number;
  retries: number;
  type?: string;  // Add transaction type
}

/**
 * Add or update a cell in the database
 */
export async function addCell(cell: Cell): Promise<{ success: boolean; error?: string }> {
    try {
      const x = Math.floor(cell.x);
      const y = Math.floor(cell.y);
      
      // First delete any cells with the same ID or at the same coordinates
      const { error: deleteError } = await supabase
        .from('cells')
        .delete()
        .or(`id.eq.${cell.id},and(x.eq.${x},y.eq.${y})`);
      
      if (deleteError) {
        console.error('Error deleting existing cells:', deleteError);
        // Continue anyway
      }
      
      // Insert the new cell after a small delay to ensure deletion completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { error: insertError } = await supabase
        .from('cells')
        .insert({
          id: cell.id,
          x: x,
          y: y,
          energy: cell.energy,
          timestamp: Date.now()
        });
  
      if (insertError) throw insertError;
      return { success: true };
    } catch (error: any) {
      console.error('Server Action Error - addCell:', error);
      return { success: false, error: error.message };
    }
  }

/**
 * Get all cells from the database without filtering by type
 */
export async function getCells(): Promise<{ cells: Cell[]; error?: string }> {
    try {
      console.log('Fetching cells from database...');
      
      // Get all cells without filtering by type since the column doesn't exist
      const { data, error } = await supabase
        .from('cells')
        .select('*')
        .order('timestamp', { ascending: false });
  
      if (error) throw error;
      
      console.log(`Found ${data?.length || 0} cells in database`);
      return { cells: data || [] };
    } catch (error: any) {
      console.error('Server Action Error - getCells:', error);
      return { cells: [], error: error.message };
    }
  }

/**
 * Add a transaction to the queue
 * Now accepts atom ID
 */
export async function addToTransactionQueue(
  cellData: Cell & { type?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Set default type if not provided
    const type = cellData.type || TX_TYPE_REACTION;
    
    const { error } = await supabase
      .from('transaction_queue')
      .insert({
        atom_id: cellData.id, // Store atom ID in transaction
        x: cellData.x,
        y: cellData.y,
        energy: cellData.energy,
        status: 'pending',
        timestamp: Date.now(),
        retries: 0,
        type: type        // Add type field
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
    console.log('getNextPendingTransaction called');
    try {
      console.log('Querying transaction_queue table');
      const { data, error } = await supabase
        .from('transaction_queue')
        .select('*')
        .eq('status', 'pending')
        .order('timestamp', { ascending: true })
        .limit(1)
        .single();
  
      if (error && error.code !== 'PGRST116') {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      console.log('Query successful, returning data:', data ? 'Some data' : 'No data');
      return { transaction: data || null };
    } catch (error: any) {
      if (error.code === 'PGRST116') {
        console.log('No pending transactions found');
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
      .neq('id', null);  // Changed from x to id

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

/**
 * Get explosion count
 */
export async function getExplosionCount(): Promise<{ count: number; error?: string }> {
  try {
    const { data, error, count } = await supabase
      .from('transaction_queue')
      .select('*', { count: 'exact', head: true })
      .eq('type', TX_TYPE_EXPLOSION)
      .eq('status', 'sent');

    if (error) throw error;
    return { count: count || 0 };
  } catch (error: any) {
    console.error('Server Action Error - getExplosionCount:', error);
    return { count: 0, error: error.message };
  }
}

/**
 * Add an explosion to the transaction queue
 * Convenience function for adding explosion records
 */
export async function addExplosionToQueue(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('transaction_queue')
      .insert({
        x: 0, // Not used for explosions
        y: 0, // Not used for explosions
        energy: 0, // Not used for explosions
        status: 'pending',
        timestamp: Date.now(),
        retries: 0,
        type: TX_TYPE_EXPLOSION
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - addExplosionToQueue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get recent transactions
 */
export async function getRecentTransactions(): Promise<{ 
    transactions: TransactionQueueItem[]; 
    error?: string 
  }> {
    try {
      const { data, error } = await supabase
        .from('transaction_queue')
        .select('*')
        .eq('status', 'sent')
        .order('timestamp', { ascending: false })
        .limit(50);
  
      if (error) throw error;
      return { transactions: data || [] };
    } catch (error: any) {
      console.error('Server Action Error - getRecentTransactions:', error);
      return { transactions: [], error: error.message };
    }
  }

/**
 * Delete a cell from the database
 */
export async function deleteCell(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cells')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - deleteCell:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get transaction type constants
 * Helper function to get the transaction types since we can't export constants
 */
export async function getTransactionTypes(): Promise<{ 
  REACTION: string; 
  EXPLOSION: string 
}> {
  return {
    REACTION: TX_TYPE_REACTION,
    EXPLOSION: TX_TYPE_EXPLOSION
  };
}