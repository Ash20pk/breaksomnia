// utils/transactionProcessor.ts
import { ethers } from 'ethers';
import SnakeABI from '../contracts/SnakeGame.json';

interface TransactionQueueItem {
  score: number;
  timestamp: number;
}

class TransactionProcessor {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private queue: TransactionQueueItem[] = [];
  private isProcessing: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 2000; // 2 seconds
  private maxBatchSize: number = 5; // Maximum transactions to batch process
  
  constructor(
    privateKey: string, 
    rpcUrl: string, 
    contractAddress: string
  ) {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Create wallet from private key
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Connect to contract
    this.contract = new ethers.Contract(
      contractAddress, 
      SnakeABI, 
      this.wallet
    );
    
    // Start processing queue
    this.startProcessing();
  }
  
  /**
   * Add a transaction to the queue
   * @param score The score to be recorded
   */
  public addToQueue(score: number): void {
    this.queue.push({
      score,
      timestamp: Date.now()
    });
    
    console.log(`Added score ${score} to transaction queue. Queue length: ${this.queue.length}`);
  }
  
  /**
   * Start processing the queue in a non-blocking way
   */
  private startProcessing(): void {
    setInterval(() => this.processQueue(), 1000);
  }
  
  /**
   * Process transactions in the queue
   */
  private async processQueue(): Promise<void> {
    // If already processing or queue is empty, skip
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Get current nonce
      const nonce = await this.wallet.getNonce();
      
      // Get gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice;

      // Take up to maxBatchSize items from the queue
      const batchSize = Math.min(this.queue.length, this.maxBatchSize);
      const batch = this.queue.slice(0, batchSize);
      
      // Process items in parallel
      const promises = batch.map((item, index) => {
        return this.processTransaction(item.score, {
          nonce: nonce + index,
          gasPrice: gasPrice,
          gasLimit: 100000 // Adjust as needed
        });
      });
      
      // Wait for all transactions to complete
      const results = await Promise.allSettled(promises);
      
      // Remove successfully processed items
      let successCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          console.error(`Failed to process transaction at index ${index}:`, result.reason);
        }
      });
      
      // Remove successful transactions from queue
      if (successCount > 0) {
        this.queue = this.queue.slice(successCount);
        console.log(`Successfully processed ${successCount} transactions. Remaining queue: ${this.queue.length}`);
      }
    } catch (error) {
      console.error('Error in transaction batch processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process a single transaction with retries
   */
  private async processTransaction(
    score: number, 
    txOptions: ethers.TransactionRequest
  ): Promise<ethers.TransactionReceipt> {
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        // Submit transaction to contract
        const tx = await this.contract.updateScore(this.wallet.address, score, txOptions);
        
        // Wait for transaction to be mined
        const receipt = await tx.wait();
        
        console.log(`Transaction successful for score ${score}. Hash: ${receipt.transactionHash}`);
        
        return receipt;
      } catch (error) {
        attempts++;
        
        if (attempts >= this.maxRetries) {
          throw error;
        }
        
        console.warn(`Retry ${attempts}/${this.maxRetries} for score ${score}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
    
    throw new Error(`Failed to process transaction after ${this.maxRetries} attempts`);
  }
  
  /**
   * Get the current queue length
   */
  public getQueueLength(): number {
    return this.queue.length;
  }
  
  /**
   * Clear the queue
   */
  public clearQueue(): void {
    this.queue = [];
  }
}

export default TransactionProcessor;