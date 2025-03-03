'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  createWalletClient, 
  createPublicClient, 
  http
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somnia } from '@/lib/chains';
import { toast } from "sonner";
import { 
  addCell, 
  getCells, 
  addToTransactionQueue, 
  getNextPendingTransaction, 
  updateTransactionStatus, 
  cleanupOldTransactions,
  clearAllCells,
  getPendingTransactionCount,
  type Cell,
  type TransactionQueueItem
} from '@/app/action';

// Components
import ReactionStats from './ReactionStats';
import ReactionBoard from './ReactionBoard';
import TransactionLog from './TransactionLog';

// Shadcn UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';

// Game constants
const GRID_SIZE = 30;  // Grid size
const CELL_SIZE = 20;  // Cell size
const MAX_ENERGY = 50;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
const POLLING_INTERVAL = 5000; // 5 seconds

// Transaction interface
interface Transaction {
  hash: string;
  x: number;
  y: number;
  energy: number;
  timestamp: number;
}

// Local cache to reduce server calls
const cellCache = new Map<string, Cell>();
const pendingOperations = new Set<string>();

// ABI for the simplified cell storage contract
const ABI = [
  {
    name: 'updateCell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_x', type: 'uint256' },
      { name: '_y', type: 'uint256' },
      { name: '_energy', type: 'uint256' }
    ],
    outputs: []
  }
];

const ChainReaction: React.FC = () => {
  // Private key from environment
  const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
  
  // Game state
  const [cells, setCells] = useState<Cell[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tps, setTps] = useState<number>(0);
  const [txCount, setTxCount] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [tpsData, setTpsData] = useState<{ count: number; startTime: number | null }>({ count: 0, startTime: null });
  const [txQueue, setTxQueue] = useState<number>(0);
  
  // Refs to track the latest state in callbacks
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  
  // Create viem clients
  const [walletClient, setWalletClient] = useState<any>(null);
  const [publicClient, setPublicClient] = useState<any>(null);
  
  // Throttle server actions
  const throttledAddCell = async (cell: Cell) => {
    const key = `cell-${cell.x}-${cell.y}`;
    if (pendingOperations.has(key)) return;
    
    pendingOperations.add(key);
    cellCache.set(`${cell.x}-${cell.y}`, cell);
    
    try {
      const result = await addCell(cell);
      if (!result.success) {
        console.error('Error adding cell:', result.error);
      }
    } catch (error) {
      console.error('Error adding cell:', error);
    } finally {
      pendingOperations.delete(key);
    }
  };
  
  const throttledAddToTransactionQueue = async (cell: Cell) => {
    const key = `tx-${cell.x}-${cell.y}-${Date.now()}`;
    if (pendingOperations.has(key)) return;
    
    pendingOperations.add(key);
    
    try {
      const result = await addToTransactionQueue(cell);
      if (!result.success) {
        console.error('Error adding to transaction queue:', result.error);
      }
    } catch (error) {
      console.error('Error adding to transaction queue:', error);
    } finally {
      pendingOperations.delete(key);
    }
  };
  
  // Load initial cells and set up polling
  useEffect(() => {
    let isMounted = true;
    
    // Initial load of cells
    const loadCells = async () => {
      try {
        const result = await getCells();
        if (!isMounted) return;
        
        if (result.error) {
          console.error('Error loading cells:', result.error);
          setError('Failed to load cell data. Please refresh the page.');
          return;
        }
        
        setCells(result.cells);
        cellsRef.current = result.cells;
        
        // Populate cache
        result.cells.forEach(cell => {
          cellCache.set(`${cell.x}-${cell.y}`, cell);
        });
      } catch (error) {
        console.error('Error loading cells:', error);
        if (isMounted) {
          setError('Failed to load cell data. Please refresh the page.');
        }
      }
    };
    
    loadCells();
    
    // Reload all cells periodically to ensure consistency
    const reloadInterval = setInterval(async () => {
      if (isMounted && !isPausedRef.current) {
        try {
          const result = await getCells();
          if (!isMounted) return;
          
          if (result.error) {
            console.error('Error reloading cells:', result.error);
            return;
          }
          
          setCells(result.cells);
          cellsRef.current = result.cells;
        } catch (error) {
          console.error('Error reloading cells:', error);
        }
      }
    }, POLLING_INTERVAL);
    
    // Update transaction queue count periodically
    const queueInterval = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        const result = await getPendingTransactionCount();
        if (!isMounted) return;
        
        if (result.error) {
          console.error('Error getting pending transaction count:', result.error);
          return;
        }
        
        setTxQueue(result.count);
      } catch (error) {
        console.error('Error checking transaction queue:', error);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(reloadInterval);
      clearInterval(queueInterval);
    };
  }, []);

  // Initialize blockchain connection
  useEffect(() => {
    const initBlockchain = async () => {
      try {
        if (!privateKey) {
          console.warn("No private key provided. Running in view-only mode.");
          // Still create public client for polling
          const client = createPublicClient({
            chain: somnia,
            transport: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network')
          });
          setPublicClient(client);
          return;
        }

        // Create account from private key
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        
        // Create wallet client
        const wallet = createWalletClient({
          account,
          chain: somnia,
          transport: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network')
        });
        setWalletClient(wallet);
        
        // Create public client
        const client = createPublicClient({
          chain: somnia,
          transport: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network')
        });
        setPublicClient(client);
        
      } catch (error) {
        console.error("Blockchain connection error:", error);
        setError("Failed to connect to blockchain. Operating in view-only mode.");
      }
    };
    
    initBlockchain();
  }, [privateKey]);

  // Process transaction queue periodically
  useEffect(() => {
    let isMounted = true;
    let processingTx = false;
    
    const processTxQueue = async () => {
      if (!isMounted || processingTx || !walletClient || !publicClient || isLoading || isPausedRef.current || !CONTRACT_ADDRESS) {
        return;
      }
      
      processingTx = true;
      
      try {
        const result = await getNextPendingTransaction();
        if (!isMounted) return;
        
        if (result.error) {
          console.error('Error getting next pending transaction:', result.error);
          processingTx = false;
          return;
        }
        
        const nextTx = result.transaction;
        
        if (nextTx && nextTx.id) {
          setIsLoading(true);
          
          try {
            // Prepare transaction
            const { request } = await publicClient.simulateContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: ABI,
              functionName: 'updateCell',
              args: [BigInt(nextTx.x), BigInt(nextTx.y), BigInt(nextTx.energy)],
              account: walletClient.account
            });
            
            // Send transaction
            const hash = await walletClient.writeContract({
              ...request,
            });
            
            // Update transaction status
            const updateResult = await updateTransactionStatus(nextTx.id, 'sent', hash);
            if (!updateResult.success) {
              console.error('Error updating transaction status:', updateResult.error);
            }
            
            // Update TPS tracking
            const now = Date.now();
            const newTxCount = txCount + 1;
            if (isMounted) {
              setTxCount(newTxCount);
              
              if (tpsData.startTime === null) {
                setTpsData({ count: 1, startTime: now });
              } else {
                const elapsed = (now - tpsData.startTime) / 1000;
                if (elapsed >= 1) {
                  setTps(Math.round((tpsData.count + 1) / elapsed));
                  setTpsData({ count: 0, startTime: now });
                } else {
                  setTpsData(prev => ({ ...prev, count: prev.count + 1 }));
                }
              }
              
              // Add to transactions list (limit to most recent 100 for performance)
              setTransactions(prev => {
                const newTransactions = [
                  {
                    hash,
                    x: nextTx.x,
                    y: nextTx.y,
                    energy: nextTx.energy,
                    timestamp: Math.floor(Date.now() / 1000)
                  },
                  ...prev
                ];
                
                // Keep only the most recent 100 transactions
                return newTransactions.slice(0, 100);
              });
            }
            
          } catch (err: any) {
            console.error('Transaction error:', err);
            // Mark transaction as failed
            const failResult = await updateTransactionStatus(nextTx.id, 'failed');
            if (!failResult.success) {
              console.error('Error marking transaction as failed:', failResult.error);
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        }
      } catch (error) {
        console.error('Error processing transaction queue:', error);
      } finally {
        processingTx = false;
      }
    };
    
    const interval = setInterval(processTxQueue, 1000);
    
    // Clean up old transactions periodically
    const cleanupInterval = setInterval(async () => {
      if (isMounted && !isPausedRef.current) {
        try {
          const result = await cleanupOldTransactions();
          if (!result.success) {
            console.error('Error cleaning up old transactions:', result.error);
          }
        } catch (error) {
          console.error('Error cleaning up old transactions:', error);
        }
      }
    }, 60000); // Once per minute
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(cleanupInterval);
    };
  }, [walletClient, publicClient, isLoading, txCount, tpsData, isPaused]);

  const processNewCell = (cells: Cell[], x: number, y: number, energyIncrement: number) => {
    let updatedCells = [...cells];
    const existingCellIndex = updatedCells.findIndex(cell => cell.x === x && cell.y === y);
    
    if (existingCellIndex >= 0) {
      // Update existing cell's energy
      const currentEnergy = updatedCells[existingCellIndex].energy;
      const newEnergy = Math.min(MAX_ENERGY, currentEnergy + energyIncrement);
      
      // Update the cell's energy
      updatedCells[existingCellIndex] = {
        ...updatedCells[existingCellIndex],
        energy: newEnergy
      };
    } else {
      // Add new cell with specified energy
      updatedCells.push({ x, y, energy: energyIncrement });
    }
    
    return updatedCells;
  };

  const processExplosions = (cells: Cell[]): Cell[] => {
    let updatedCells = [...cells];
    let hasExploded = true;
    let explosionCount = 0;
    const MAX_EXPLOSIONS = 100; // Safety limit to prevent infinite loops
    
    while (hasExploded && explosionCount < MAX_EXPLOSIONS) {
      hasExploded = false;
      explosionCount++;
      
      const cellsToExplode = updatedCells.filter(cell => cell.energy >= 2);
      
      if (cellsToExplode.length === 0) break;
      
      // Remove all cells that will explode
      updatedCells = updatedCells.filter(cell => cell.energy < 2);
      
      // Process each explosion (limit batch size for performance)
      for (const cell of cellsToExplode.slice(0, 20)) {
        hasExploded = true;
        
        // Define all adjacent positions
        const directions = [
          { dx: 1, dy: 0 },   // right
          { dx: -1, dy: 0 },  // left
          { dx: 0, dy: 1 },   // down
          { dx: 0, dy: -1 }   // up
        ];
        
        // Spread to all adjacent cells
        for (const dir of directions) {
          const newX = cell.x + dir.dx;
          const newY = cell.y + dir.dy;
          
          // Check if the new position is within bounds
          if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
            // Add energy 1 to the position
            updatedCells = processNewCell(updatedCells, newX, newY, 1);
            
            // Add to database and transaction queue
            const newCell = { x: newX, y: newY, energy: 1 };
            throttledAddCell(newCell);
            throttledAddToTransactionQueue(newCell);
          }
        }
      }
    }
    
    if (explosionCount >= MAX_EXPLOSIONS) {
      console.warn('Max explosion count reached, stopping to prevent infinite loop');
    }
    
    return updatedCells;
  };

  const handleCellClick = async (x: number, y: number) => {
    if (isPausedRef.current) return;
    
    try {
      const existingCell = cellsRef.current.find(cell => cell.x === x && cell.y === y);
      
      // Always increment by 1
      const newEnergy = existingCell ? Math.min(MAX_ENERGY, existingCell.energy + 1) : 1;
      const newCell = { x, y, energy: newEnergy };
      
      // Add or update cell in database
      await throttledAddCell(newCell);
      await throttledAddToTransactionQueue(newCell);
      
      // First update the clicked cell
      let newCells = processNewCell(cellsRef.current, x, y, 1);
      
      // Then process any resulting explosions
      newCells = processExplosions(newCells);
      
      // Update state
      setCells(newCells);
      cellsRef.current = newCells;
    } catch (error) {
      console.error('Error handling cell click:', error);
      toast.error('Failed to update cell', {
        description: 'Please try again.'
      });
    }
  };

  const clearReaction = async () => {
    try {
      setIsPaused(true); // Pause during clear operation
      
      // Clear cells using server action
      const result = await clearAllCells();
      if (!result.success) {
        console.error('Error clearing cells:', result.error);
        toast.error('Failed to clear reaction');
        return;
      }
      
      // Clear local state
      setCells([]);
      cellsRef.current = [];
      cellCache.clear();
      
      // Reset TPS tracking
      setTpsData({ count: 0, startTime: null });
      setTps(0);
      setTxCount(0);
      
      toast.success('Chain reaction cleared!');
    } catch (error) {
      console.error('Error clearing reaction:', error);
      toast.error('Failed to clear reaction');
    } finally {
      setIsPaused(false);
    }
  };

  const startRandomReaction = async () => {
    if (isPausedRef.current) return;
    
    try {
      const pattern = Math.floor(Math.random() * 5);
      const randomCells: Cell[] = [];
      
      switch (pattern) {
        case 0: // Supernova pattern
          const centerX = Math.floor(GRID_SIZE / 2);
          const centerY = Math.floor(GRID_SIZE / 2);
          const energy = Math.floor(Math.random() * 5) + 2; // Reduced energy level
          
          randomCells.push({ x: centerX, y: centerY, energy });
          await throttledAddCell({ x: centerX, y: centerY, energy });
          await throttledAddToTransactionQueue({ x: centerX, y: centerY, energy });
          
          toast.info('Supernova Pattern', {
            description: `A massive explosion starting from the center with energy ${energy}!`
          });
          break;
          
        case 1: // Grid pattern - simplified
          const gridSpacing = Math.floor(Math.random() * 3) + 3; // Increased spacing
          const randomOffset = Math.floor(Math.random() * gridSpacing);
          
          // Limit grid points for performance
          const maxPoints = 10;
          let pointCount = 0;
          
          for (let x = randomOffset; x < GRID_SIZE && pointCount < maxPoints; x += gridSpacing) {
            for (let y = randomOffset; y < GRID_SIZE && pointCount < maxPoints; y += gridSpacing) {
              pointCount++;
              const cellEnergy = Math.floor(Math.random() * 2) + 1;
              randomCells.push({ x, y, energy: cellEnergy });
              await throttledAddCell({ x, y, energy: cellEnergy });
              await throttledAddToTransactionQueue({ x, y, energy: cellEnergy });
            }
          }
          
          toast.info('Grid Pattern', {
            description: `Creating a grid pattern with spacing ${gridSpacing}`
          });
          break;
          
        case 2: // Line pattern - simplified
          const isHorizontal = Math.random() > 0.5;
          const position = Math.floor(Math.random() * GRID_SIZE);
          const maxLineLength = 10; // Limit line length
          
          for (let i = 0; i < maxLineLength; i++) {
            const cellX = isHorizontal ? i : position;
            const cellY = isHorizontal ? position : i;
            
            if (cellX < GRID_SIZE && cellY < GRID_SIZE) {
              const cellEnergy = 1;
              randomCells.push({ x: cellX, y: cellY, energy: cellEnergy });
              await throttledAddCell({ x: cellX, y: cellY, energy: cellEnergy });
              await throttledAddToTransactionQueue({ x: cellX, y: cellY, energy: cellEnergy });
            }
          }
          
          toast.info(`${isHorizontal ? 'Horizontal' : 'Vertical'} Line Pattern`, {
            description: 'Creating a line of cells that will trigger a chain reaction!'
          });
          break;
          
        case 3: // Random sparse pattern - limited
          const numPoints = Math.floor(Math.random() * 5) + 3; // Reduced points
          
          for (let i = 0; i < numPoints; i++) {
            const x = Math.floor(Math.random() * GRID_SIZE);
            const y = Math.floor(Math.random() * GRID_SIZE);
            const energy = Math.floor(Math.random() * 2) + 1;
            
            randomCells.push({ x, y, energy });
            await throttledAddCell({ x, y, energy });
            await throttledAddToTransactionQueue({ x, y, energy });
          }
          
          toast.info('Random Pattern', {
            description: `Placing ${numPoints} random cells with varied energy levels`
          });
          break;
          
        case 4: // Diamond pattern - simplified
          const diamondSize = Math.floor(Math.random() * 3) + 2; // Small diamond
          const centerDiamondX = Math.floor(GRID_SIZE / 2);
          const centerDiamondY = Math.floor(GRID_SIZE / 2);
          
          for (let offset = 0; offset <= diamondSize; offset++) {
            // Top, Right, Bottom, Left points of the diamond
            const points = [
              { x: centerDiamondX, y: centerDiamondY - offset },
              { x: centerDiamondX + offset, y: centerDiamondY },
              { x: centerDiamondX, y: centerDiamondY + offset },
              { x: centerDiamondX - offset, y: centerDiamondY }
            ];
            
            for (const point of points) {
              if (point.x >= 0 && point.x < GRID_SIZE && point.y >= 0 && point.y < GRID_SIZE) {
                const energy = offset === diamondSize ? 2 : 1; // Outer edge has more energy
                randomCells.push({ x: point.x, y: point.y, energy });
                await throttledAddCell({ x: point.x, y: point.y, energy });
                await throttledAddToTransactionQueue({ x: point.x, y: point.y, energy });
              }
            }
          }
          
          toast.info('Diamond Pattern', {
            description: `Creating a diamond pattern of size ${diamondSize}`
          });
          break;
      }
      
      // Update local state
      setCells(prev => {
        const newCells = [...prev];
        for (const cell of randomCells) {
          const index = newCells.findIndex(c => c.x === cell.x && c.y === cell.y);
          if (index >= 0) {
            newCells[index] = cell;
          } else {
            newCells.push(cell);
          }
        }
        return newCells;
      });
      
      // Process any resulting explosions after a short delay
      setTimeout(() => {
        if (!isPausedRef.current) {
          const newCells = processExplosions(cellsRef.current);
          setCells(newCells);
          cellsRef.current = newCells;
        }
      }, 100);
      
    } catch (error) {
      console.error('Error starting random reaction:', error);
      toast.error('Failed to start random reaction');
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {error && (
        <Alert variant="destructive" className="mb-4 w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mb-6">
        {/* Left sidebar - Stats */}
        <div className="lg:col-span-3">
          <ReactionStats 
            cellCount={cells.length}
            txQueue={txQueue}
            tps={tps}
            txCount={txCount}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            clearReaction={clearReaction}
            startRandomReaction={startRandomReaction}
          />
        </div>
        
        {/* Main reaction area */}
        <div className="lg:col-span-9">
          <ReactionBoard 
            cells={cells}
            gridSize={GRID_SIZE}
            cellSize={CELL_SIZE}
            maxEnergy={MAX_ENERGY}
            onCellClick={handleCellClick}
          />
        </div>
      </div>
      
      {/* Transaction log */}
      <div className="w-full">
        <TransactionLog 
          transactions={transactions}
        />
      </div>
    </div>
  );
};

export default ChainReaction;