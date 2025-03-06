import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Chain configuration for Somnia network
const somnia = {
  id: 2930,
  name: 'Somnia Network',
  network: 'somnia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://dream-rpc.somnia.network'] },
    default: { http: ['https://dream-rpc.somnia.network'] },
  },
};

// ABI for the contract
const ABI = [
  {
    name: 'recordReaction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_x', type: 'uint256' },
      { name: '_y', type: 'uint256' },
      { name: '_energy', type: 'uint256' },
      { name: '_atomId', type: 'string' }
    ],
    outputs: []
  },
  {
    name: 'recordExplosion',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_atomId', type: 'string' }
    ],
    outputs: []
  }
];

// Transaction types
const TX_TYPE_REACTION = 'reaction';
const TX_TYPE_EXPLOSION = 'explosion';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize blockchain clients
async function initBlockchain() {
  try {
    const privateKey = process.env.PRIVATE_KEY || '';
    const contractAddress = process.env.CONTRACT_ADDRESS || '';
    
    if (!privateKey || !contractAddress) {
      throw new Error("Missing private key or contract address");
    }

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: somnia,
      transport: http(process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network')
    });
    
    // Create public client
    const publicClient = createPublicClient({
      chain: somnia,
      transport: http(process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network')
    });
    
    return { walletClient, publicClient, contractAddress };
  } catch (error) {
    console.error("Blockchain connection error:", error);
    throw error;
  }
}

// Get the next pending transaction
async function getNextPendingTransaction() {
  try {
    const { data, error } = await supabase
      .from('transaction_queue')
      .select('*')
      .eq('status', 'pending')
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  } catch (error: any) {
    if (error.code === 'PGRST116') {
      return null; // No pending transactions
    }
    throw error;
  }
}

// Update transaction status
async function updateTransactionStatus(
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
    return true;
  } catch (error) {
    console.error('Error updating transaction status:', error);
    return false;
  }
}

// Process the transaction queue
async function processTransactionQueue() {
  console.log("Starting transaction processing...");
  
  try {
    const { walletClient, publicClient, contractAddress } = await initBlockchain();
    console.log("Blockchain connection established");
    
    let processedCount = 0;
    const MAX_TRANSACTIONS = 20; // Increased to 20 transactions per run for more stress
    
    for (let i = 0; i < MAX_TRANSACTIONS; i++) {
      const nextTx = await getNextPendingTransaction();
      
      if (!nextTx) {
        console.log("No more pending transactions");
        break;
      }
      
      try {
        let hash;
        
        if (nextTx.type === TX_TYPE_EXPLOSION) {
          console.log(`Processing explosion transaction for atom: ${nextTx.atom_id}`);
          // Process explosion transaction with atom ID
          const atomId = nextTx.atom_id || '';
          const { request } = await publicClient.simulateContract({
            address: contractAddress as `0x${string}`,
            abi: ABI,
            functionName: 'recordExplosion',
            args: [atomId],
            account: walletClient.account
          });
          
          // Send transaction
          hash = await walletClient.writeContract({
            ...request,
          });
        } else {
          console.log(`Processing reaction transaction at (${nextTx.x}, ${nextTx.y}) with energy ${nextTx.energy}`);
          // Process regular reaction transaction with atom ID
          const atomId = nextTx.atom_id || '';
          const { request } = await publicClient.simulateContract({
            address: contractAddress as `0x${string}`,
            abi: ABI,
            functionName: 'recordReaction',
            args: [BigInt(nextTx.x), BigInt(nextTx.y), BigInt(nextTx.energy), atomId],
            account: walletClient.account
          });
          
          // Send transaction
          hash = await walletClient.writeContract({
            ...request,
          });
        }
        
        // Update transaction status
        await updateTransactionStatus(nextTx.id, 'sent', hash);
        processedCount++;
        console.log(`Transaction processed with hash: ${hash}`);
        
      } catch (err) {
        console.error('Transaction error:', err);
        // Mark transaction as failed
        await updateTransactionStatus(nextTx.id, 'failed');
      }
    }
    
    console.log(`Completed processing ${processedCount} transactions`);
    return processedCount;
  } catch (error) {
    console.error('Error in transaction queue processing:', error);
    throw error;
  }
}

// Clean up old transactions
async function cleanupOldTransactions() {
  try {
    const oneHourAgo = Date.now() - 3600000;
    
    const { error } = await supabase
      .from('transaction_queue')
      .delete()
      .lt('timestamp', oneHourAgo)
      .neq('status', 'pending');

    if (error) throw error;
    console.log("Cleaned up old transactions");
  } catch (error) {
    console.error('Error cleaning up old transactions:', error);
  }
}

// Handler function for Vercel cron job
export async function GET() {
  try {
    // Process the transaction queue
    const processedCount = await processTransactionQueue();
    
    // Clean up old transactions
    await cleanupOldTransactions();
    
    return NextResponse.json({ 
      success: true, 
      processedTransactions: processedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in cron handler:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}