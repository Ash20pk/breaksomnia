// app/action.ts
'use server'

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Transaction type constants
const TX_TYPE_REACTION = 'reaction'
const TX_TYPE_EXPLOSION = 'explosion'

// Transaction queue item type
export type TransactionQueueItem = {
  id: number;
  atom_id?: string;
  x: number;
  y: number;
  energy: number;
  timestamp?: number;
  status?: string;
  hash?: string;
  type?: string;
  retries?: number;
}

// Add transaction to queue
export async function addToTransactionQueue(data: {
  id: string;
  x: number;
  y: number;
  energy: number;
  type: string;
}) {
  try {
    const { error } = await supabase
      .from('transaction_queue')
      .insert({
        atom_id: data.id,
        x: data.x,
        y: data.y,
        energy: data.energy,
        timestamp: Date.now(),
        status: 'pending',
        type: data.type,
        retries: 0
      })

    return { success: !error, error }
  } catch (error) {
    console.error('Error adding to transaction queue:', error)
    return { success: false, error }
  }
}

// Get next pending transaction
export async function getNextPendingTransaction() {
  try {
    const { data, error } = await supabase
      .from('transaction_queue')
      .select('*')
      .eq('status', 'pending')
      .order('timestamp', { ascending: true })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return { transaction: data, error: null }
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      return { transaction: null, error: null } // No pending transactions
    }
    console.error('Error getting next transaction:', error)
    return { transaction: null, error }
  }
}

// Get a batch of pending transactions
export async function getBatchPendingTransactions(count: number = 5) {
  try {
    const { data, error } = await supabase
      .from('transaction_queue')
      .select('*')
      .eq('status', 'pending')
      .order('timestamp', { ascending: true })
      .limit(count)

    if (error) {
      throw error
    }

    return { transactions: data || [], error: null }
  } catch (error) {
    console.error('Error getting batch transactions:', error)
    return { transactions: [], error }
  }
}

// Update transaction status
export async function updateTransactionStatus(
  id: number,
  status: 'sent' | 'failed',
  hash?: string
) {
  try {
    // Get current retries count
    const { data: currentTx } = await supabase
      .from('transaction_queue')
      .select('retries')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('transaction_queue')
      .update({
        status,
        hash,
        retries: (currentTx?.retries || 0) + 1
      })
      .eq('id', id)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error('Error updating transaction status:', error)
    return { success: false, error }
  }
}

// Get pending transaction count
export async function getPendingTransactionCount() {
  try {
    const { count, error } = await supabase
      .from('transaction_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (error) throw error
    return { count: count || 0, error: null }
  } catch (error) {
    console.error('Error getting pending count:', error)
    return { count: 0, error }
  }
}

// Get transaction types
export async function getTransactionTypes() {
  return {
    REACTION: TX_TYPE_REACTION,
    EXPLOSION: TX_TYPE_EXPLOSION
  }
}

// Get recent transactions
export async function getRecentTransactions(limit: number = 50) {
  try {
    const { data, error } = await supabase
      .from('transaction_queue')
      .select('*')
      .in('status', ['sent', 'pending'])
      .order('timestamp', { ascending: false })
      .limit(limit)

    return { transactions: data || [], error }
  } catch (error) {
    console.error('Error getting recent transactions:', error)
    return { transactions: [], error }
  }
}

// Get combined stats in a single query for efficiency
export async function fetchCombinedStats() {
  try {
    // Get pending transaction count
    const { count: pendingCount, error: pendingError } = await supabase
      .from('transaction_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (pendingError) throw pendingError

    // Get explosion count
    const { count: explosionCount, error: explosionError } = await supabase
      .from('transaction_queue')
      .select('*', { count: 'exact', head: true })
      .eq('type', TX_TYPE_EXPLOSION)
      .eq('status', 'sent')

    if (explosionError) throw explosionError

    // Get total transaction count
    const { count: txCount, error: txError } = await supabase
      .from('transaction_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')

    if (txError) throw txError

    return {
      pendingCount: pendingCount || 0,
      explosionCount: explosionCount || 0,
      txCount: txCount || 0,
      error: null
    }
  } catch (error) {
    console.error('Error fetching combined stats:', error)
    return {
      pendingCount: 0,
      explosionCount: 0,
      txCount: 0,
      error
    }
  }
}

// Clean up old transactions for database maintenance
export async function cleanupOldTransactions(ageInHours: number = 1) {
  try {
    const cutoffTime = Date.now() - (ageInHours * 3600000)
    
    const { error } = await supabase
      .from('transaction_queue')
      .delete()
      .lt('timestamp', cutoffTime)
      .neq('status', 'pending')

    return { success: !error, error }
  } catch (error) {
    console.error('Error cleaning up old transactions:', error)
    return { success: false, error }
  }
}

// Mass submit transactions for stress testing
export async function massSubmitTransactions(count: number = 100): Promise<{ success: boolean, count: number }> {
  try {
    const transactions = [];
    
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * 800);
      const y = Math.floor(Math.random() * 600);
      const energy = Math.floor(Math.random() * 3) + 1;
      const atomId = `stress-${Date.now()}-${i}`;
      
      transactions.push({
        atom_id: atomId,
        x: x, 
        y: y,
        energy: energy,
        timestamp: Date.now() + i,
        status: 'pending',
        type: TX_TYPE_REACTION,
        retries: 0
      });
    }
    
    // Use RLS bypass for bulk insert
    const { error } = await supabase
      .from('transaction_queue')
      .insert(transactions);
      
    if (error) throw error;
    
    return { success: true, count };
  } catch (error) {
    console.error('Error in mass submit:', error);
    return { success: false, count: 0 };
  }
}