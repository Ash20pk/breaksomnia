// utils/TransactionProcessor.ts
import { 
    getNextPendingTransaction, 
    updateTransactionStatus,
    type TransactionQueueItem
  } from '@/app/action';
  
  // Types for the processor
  type ProcessorOptions = {
    walletClient: any;
    publicClient: any;
    contractAddress: string;
    abi: any[];
    onSuccess?: (tx: { hash: string, transaction: TransactionQueueItem }) => void;
    onError?: (error: any, transaction: TransactionQueueItem) => void;
  };
  
  export class TransactionProcessor {
    private walletClient: any;
    private publicClient: any;
    private contractAddress: string;
    private abi: any[];
    private isProcessing: boolean = false;
    private isPaused: boolean = false;
    private processingInterval: NodeJS.Timeout | null = null;
    private onSuccess?: (tx: { hash: string, transaction: TransactionQueueItem }) => void;
    private onError?: (error: any, transaction: TransactionQueueItem) => void;
    private txTypeReaction: string = 'reaction';
    private txTypeExplosion: string = 'explosion';
  
    constructor(options: ProcessorOptions) {
      this.walletClient = options.walletClient;
      this.publicClient = options.publicClient;
      this.contractAddress = options.contractAddress;
      this.abi = options.abi;
      this.onSuccess = options.onSuccess;
      this.onError = options.onError;
    }
  
    // Set transaction types
    setTransactionTypes(reaction: string, explosion: string) {
      this.txTypeReaction = reaction;
      this.txTypeExplosion = explosion;
    }
  
    // Start processing
    start(intervalMs: number = 2000) {
      this.isPaused = false;
      if (!this.processingInterval) {
        this.processingInterval = setInterval(() => this.processTxQueue(), intervalMs);
      }
    }
  
    // Pause processing
    pause() {
      this.isPaused = true;
    }
  
    // Resume processing
    resume() {
      this.isPaused = false;
    }
  
    // Stop processing
    stop() {
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
    }
  
    // Process the next transaction in the queue
    private async processTxQueue() {
      if (
        this.isProcessing || 
        this.isPaused || 
        !this.walletClient || 
        !this.publicClient || 
        !this.contractAddress
      ) {
        return;
      }
  
      this.isProcessing = true;
  
      try {
        const result = await getNextPendingTransaction();
  
        if (result.error) {
          console.error('Error getting next pending transaction:', result.error);
          this.isProcessing = false;
          return;
        }
  
        const nextTx = result.transaction;
  
        if (nextTx && nextTx.id) {
          try {
            let hash;
  
            if (nextTx.type === this.txTypeExplosion) {
              // Process explosion transaction
              const { request } = await this.publicClient.simulateContract({
                address: this.contractAddress as `0x${string}`,
                abi: this.abi,
                functionName: 'recordExplosion',
                args: [],
                account: this.walletClient.account
              });
  
              // Send transaction
              hash = await this.walletClient.writeContract({
                ...request,
              });
            } else {
              // Process regular reaction transaction
              const { request } = await this.publicClient.simulateContract({
                address: this.contractAddress as `0x${string}`,
                abi: this.abi,
                functionName: 'recordReaction',
                args: [BigInt(nextTx.x), BigInt(nextTx.y), BigInt(nextTx.energy)],
                account: this.walletClient.account
              });
  
              // Send transaction
              hash = await this.walletClient.writeContract({
                ...request,
              });
            }
  
            // Update transaction status
            await updateTransactionStatus(nextTx.id, 'sent', hash);
  
            // Call success callback
            if (this.onSuccess) {
              this.onSuccess({ hash, transaction: nextTx });
            }
          } catch (err: any) {
            console.error('Transaction error:', err);
            
            // Mark transaction as failed
            await updateTransactionStatus(nextTx.id, 'failed');
            
            // Call error callback
            if (this.onError && nextTx) {
              this.onError(err, nextTx);
            }
          }
        }
      } catch (error) {
        console.error('Error processing transaction queue:', error);
      } finally {
        this.isProcessing = false;
      }
    }
  }