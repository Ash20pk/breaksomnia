"use client";

import { Cell } from '../types/game';
import { supabase } from './supabase';

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

export const addCell = async (cell: Cell): Promise<void> => {
  const { error } = await supabase
    .from('cells')
    .upsert({
      x: cell.x,
      y: cell.y,
      energy: cell.energy,
      timestamp: Date.now()
    });

  if (error) throw error;
};

export const getCells = async (): Promise<Cell[]> => {
  const { data, error } = await supabase
    .from('cells')
    .select('*');

  if (error) throw error;
  return data || [];
};

export const addToTransactionQueue = async (cell: Cell): Promise<void> => {
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
};

export const getNextPendingTransaction = async (): Promise<TransactionQueueItem | null> => {
  const { data, error } = await supabase
    .from('transaction_queue')
    .select('*')
    .eq('status', 'pending')
    .order('timestamp', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
  return data || null;
};

export const updateTransactionStatus = async (
  id: number,
  status: 'sent' | 'failed',
  hash?: string
): Promise<void> => {
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
};

export const cleanupOldTransactions = async (): Promise<void> => {
  const oneHourAgo = Date.now() - 3600000;
  
  const { error } = await supabase
    .from('transaction_queue')
    .delete()
    .lt('timestamp', oneHourAgo)
    .neq('status', 'pending');

  if (error) throw error;
};