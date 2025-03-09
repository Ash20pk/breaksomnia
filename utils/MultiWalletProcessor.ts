// utils/SimpleMultiWalletProcessor.ts
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somnia } from '@/lib/chains';
import { 
  getNextPendingTransaction, 
  updateTransactionStatus,
  type TransactionQueueItem
} from '@/app/action';

// Types for the processor
type ProcessorOptions = {
  privateKeys: string[];
  contractAddress: string;
  abi: any[];
  rpcUrl?: string;
  onSuccess?: (tx: { hash: string, transaction: TransactionQueueItem, walletIndex: number }) => void;
  onError?: (error: any, transaction: TransactionQueueItem, walletIndex: number) => void;
  onStatusUpdate?: (status: WalletStatus[]) => void;
};

type WalletStatus = {
  index: number;
  isProcessing: boolean;
  totalProcessed: number;
  consecutiveErrors: number;
};

export class MultiWalletProcessor {
  private walletClients: any[] = [];
  private publicClient: any;
  private contractAddress: string;
  private abi: any[];
  private walletStatus: WalletStatus[] = [];
  private isPaused: boolean = false;
  private processingIntervals: NodeJS.Timeout[] = [];
  private onSuccess?: (tx: { hash: string, transaction: TransactionQueueItem, walletIndex: number }) => void;
  private onError?: (error: any, transaction: TransactionQueueItem, walletIndex: number) => void;
  private onStatusUpdate?: (status: WalletStatus[]) => void;
  private txTypeReaction: string = 'reaction';
  private txTypeExplosion: string = 'explosion';
  private maxConsecutiveErrors: number = 5;

  constructor(options: ProcessorOptions) {
    this.contractAddress = options.contractAddress;
    this.abi = options.abi;
    this.onSuccess = options.onSuccess;
    this.onError = options.onError;
    this.onStatusUpdate = options.onStatusUpdate;
    
    const rpcUrl = options.rpcUrl || 'https://dream-rpc.somnia.network';
    
    // Initialize public client
    this.publicClient = createPublicClient({
      chain: somnia,
      transport: http(rpcUrl, {
        timeout: 30000
      })
    });
    
    // Initialize wallet clients
    options.privateKeys.forEach((privateKey, index) => {
      if (!privateKey) return;
      
      try {
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
          account,
          chain: somnia,
          transport: http(rpcUrl, {
            timeout: 30000
          })
        });
        
        this.walletClients.push(walletClient);
        this.walletStatus.push({
          index,
          isProcessing: false,
          totalProcessed: 0,
          consecutiveErrors: 0
        });
      } catch (error) {
        console.error(`Failed to initialize wallet ${index}:`, error);
      }
    });
    
    console.log(`Simple multi-wallet processor initialized with ${this.walletClients.length} wallets`);
  }

  // Set transaction types
  setTransactionTypes(reaction: string, explosion: string) {
    this.txTypeReaction = reaction;
    this.txTypeExplosion = explosion;
  }

  // Start processing
  start(intervalMs: number = 100) {
    this.isPaused = false;
    
    // Clear any existing intervals
    this.stop();
    
    // Start a separate processing interval for each wallet
    this.walletClients.forEach((_, index) => {
      const staggeredInterval = intervalMs + (index * 50);
      
      this.processingIntervals[index] = setInterval(
        () => this.processWithWallet(index), 
        staggeredInterval
      );
    });
  }

  // Pause all processing
  pause() {
    this.isPaused = true;
  }

  // Resume processing
  resume() {
    this.isPaused = false;
  }

  // Stop all processing
  stop() {
    this.processingIntervals.forEach((interval) => {
      if (interval) {
        clearInterval(interval);
      }
    });
    this.processingIntervals = [];
  }

  // Get current status
  getStatus(): WalletStatus[] {
    return [...this.walletStatus];
  }

  // Reset a frozen wallet
  resetWallet(index: number) {
    if (index >= 0 && index < this.walletStatus.length) {
      this.walletStatus[index].consecutiveErrors = 0;
    }
  }

  // Process a transaction with a specific wallet
  private async processWithWallet(walletIndex: number) {
    // Skip if paused or if this wallet is already processing
    if (
      this.isPaused || 
      !this.walletClients[walletIndex] || 
      this.walletStatus[walletIndex].isProcessing ||
      this.walletStatus[walletIndex].consecutiveErrors >= this.maxConsecutiveErrors
    ) {
      return;
    }

    // Mark this wallet as processing
    this.walletStatus[walletIndex].isProcessing = true;
    this.updateStatusCallback();

    try {
      // Fetch next pending transaction
      const result = await getNextPendingTransaction();

      if (result.error || !result.transaction || !result.transaction.id) {
        // No pending transactions
        this.walletStatus[walletIndex].isProcessing = false;
        this.updateStatusCallback();
        return;
      }

      const tx = result.transaction;
      const walletClient = this.walletClients[walletIndex];
      let hash = '';

      try {
        if (tx.type === this.txTypeExplosion) {
          // Process explosion transaction
          const atomId = tx.atom_id || '';
          const { request } = await this.publicClient.simulateContract({
            address: this.contractAddress as `0x${string}`,
            abi: this.abi,
            functionName: 'recordExplosion',
            args: [atomId],
            account: walletClient.account
          });

          // Send transaction
          hash = await walletClient.writeContract(request);
        } else {
          // Process regular reaction transaction
          const atomId = tx.atom_id || '';
          const { request } = await this.publicClient.simulateContract({
            address: this.contractAddress as `0x${string}`,
            abi: this.abi,
            functionName: 'recordReaction',
            args: [BigInt(tx.x), BigInt(tx.y), BigInt(tx.energy), atomId],
            account: walletClient.account
          });

          // Send transaction
          hash = await walletClient.writeContract(request);
        }

        // Update transaction status in database
        await updateTransactionStatus(tx.id, 'sent', hash);

        // Safely update wallet status counters to avoid BigInt issues
        this.walletStatus[walletIndex].totalProcessed = 
          (this.walletStatus[walletIndex].totalProcessed || 0) + 1;
        this.walletStatus[walletIndex].consecutiveErrors = 0;

        // Call success callback
        if (this.onSuccess) {
          this.onSuccess({ hash, transaction: tx, walletIndex });
        }
      } catch (err) {
        console.error(`Wallet ${walletIndex}: Transaction error:`, err);
        
        // Mark transaction as failed
        await updateTransactionStatus(tx.id, 'failed');
        
        // Increment consecutive errors
        this.walletStatus[walletIndex].consecutiveErrors = 
          (this.walletStatus[walletIndex].consecutiveErrors || 0) + 1;
        
        // Call error callback
        if (this.onError) {
          this.onError(err, tx, walletIndex);
        }
      }
    } catch (error) {
      console.error(`Wallet ${walletIndex}: Error in transaction processing:`, error);
      this.walletStatus[walletIndex].consecutiveErrors = 
        (this.walletStatus[walletIndex].consecutiveErrors || 0) + 1;
    } finally {
      this.walletStatus[walletIndex].isProcessing = false;
      this.updateStatusCallback();
    }
  }

  // Helper to call status update callback
  private updateStatusCallback() {
    if (this.onStatusUpdate) {
      this.onStatusUpdate([...this.walletStatus]);
    }
  }
}