// components/ChainReaction/index.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  createWalletClient, 
  createPublicClient, 
  http, 
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somnia } from '@/lib/chains';
import { toast } from "sonner";
import { addCell, getCells, addToTransactionQueue, getNextPendingTransaction, updateTransactionStatus, cleanupOldTransactions } from '../lib/db';
import { supabase } from '../lib/supabase';

// Components
import ReactionStats from './ReactionStats';
import ReactionBoard from './ReactionBoard';
import TransactionLog from './TransactionLog';

// Shadcn UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Game constants
const GRID_SIZE = 30;  // Reduced from 40 to make cells larger
const CELL_SIZE = 20;  // Increased from 16 to make cells more visible
const MAX_ENERGY = 50;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
const POLLING_INTERVAL = 3000; // 3 seconds

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
  },
  {
    name: 'getRecentActiveCells',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_count', type: 'uint256' }],
    outputs: [{ 
      name: '', 
      type: 'tuple[]',
      components: [
        { name: 'x', type: 'uint256' },
        { name: 'y', type: 'uint256' },
        { name: 'energy', type: 'uint256' },
        { name: 'lastUpdated', type: 'uint256' }
      ]
    }]
  },
  {
    name: 'getActiveCellCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  }
];

// Cell interface
interface Cell {
  x: number;
  y: number;
  energy: number;
}

// Transaction interface
interface Transaction {
  hash: string;
  x: number;
  y: number;
  energy: number;
  timestamp: number;
}

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
  
  // Refs to track the latest state in callbacks
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  
  // Create viem clients
  const [walletClient, setWalletClient] = useState<any>(null);
  const [publicClient, setPublicClient] = useState<any>(null);
  
  // Subscribe to real-time cell updates
  useEffect(() => {
    // Initial load of cells
    const loadCells = async () => {
      try {
        const loadedCells = await getCells();
        setCells(loadedCells);
        cellsRef.current = loadedCells;
      } catch (error) {
        console.error('Error loading cells:', error);
      }
    };
    loadCells();

    // Subscribe to real-time changes
    const cellsSubscription = supabase
      .channel('cells-channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'cells' 
        }, 
        async (payload) => {
          // Reload all cells when there's any change
          const updatedCells = await getCells();
          setCells(updatedCells);
          cellsRef.current = updatedCells;
        }
      )
      .subscribe();

    return () => {
      cellsSubscription.unsubscribe();
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
    const interval = setInterval(async () => {
      if (!isPausedRef.current) {
        try {
          await processTxQueue();
          await cleanupOldTransactions();
        } catch (error) {
          console.error('Error in transaction queue processing:', error);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [walletClient, publicClient, isLoading]);

  const processTxQueue = async () => {
    if (walletClient && publicClient && !isLoading && CONTRACT_ADDRESS) {
      try {
        const nextTx = await getNextPendingTransaction();
        
        if (nextTx) {
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
            await updateTransactionStatus(nextTx.id!, 'sent', hash);
            
            // Update TPS tracking
            const now = Date.now();
            const newTxCount = txCount + 1;
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
            
            // Add to transactions list
            setTransactions(prev => [...prev, {
              hash,
              x: nextTx.x,
              y: nextTx.y,
              energy: nextTx.energy,
              timestamp: Math.floor(Date.now() / 1000)
            }]);
            
          } catch (err: any) {
            console.error('Transaction error:', err);
            setError(err.message);
            // Mark transaction as failed
            await updateTransactionStatus(nextTx.id!, 'failed');
          } finally {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error processing transaction queue:', error);
      }
    }
  };

  const processNewCell = (cells: Cell[], x: number, y: number, energyIncrement: number) => {
    let updatedCells = [...cells];
    const existingCellIndex = updatedCells.findIndex(cell => cell.x === x && cell.y === y);
    
    if (existingCellIndex >= 0) {
      // Update existing cell's energy
      const currentEnergy = updatedCells[existingCellIndex].energy;
      const newEnergy = currentEnergy + energyIncrement;
      
      // Update the cell's energy
      updatedCells[existingCellIndex] = {
        ...updatedCells[existingCellIndex],
        energy: newEnergy
      };
    } else {
      // Add new cell with energy 1
      updatedCells.push({ x, y, energy: energyIncrement });
    }
    
    return updatedCells;
  };

  const processExplosions = (cells: Cell[]): Cell[] => {
    let updatedCells = [...cells];
    let hasExploded = true;
    
    while (hasExploded) {
      hasExploded = false;
      const cellsToExplode = updatedCells.filter(cell => cell.energy >= 2);
      
      if (cellsToExplode.length === 0) break;
      
      // Remove all cells that will explode
      updatedCells = updatedCells.filter(cell => cell.energy < 2);
      
      // Process each explosion
      for (const cell of cellsToExplode) {
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
            addCell(newCell).catch(console.error);
            addToTransactionQueue(newCell).catch(console.error);
          }
        }
      }
    }
    
    return updatedCells;
  };

  const handleCellClick = async (x: number, y: number) => {
    if (isPausedRef.current) return;
    
    try {
      const existingCell = cellsRef.current.find(cell => cell.x === x && cell.y === y);
      
      // Always increment by 1
      const newEnergy = existingCell ? existingCell.energy + 1 : 1;
      const newCell = { x, y, energy: newEnergy };
      
      // Add or update cell in database
      await addCell(newCell);
      await addToTransactionQueue(newCell);
      
      // First update the clicked cell
      let newCells = processNewCell(cellsRef.current, x, y, 1);
      
      // Then process any resulting explosions
      newCells = processExplosions(newCells);
      
      // Update state
      setCells(newCells);
      cellsRef.current = newCells;
      
      console.log('Updated cells:', newCells);
    } catch (error) {
      console.error('Error handling cell click:', error);
      toast.error('Failed to update cell', {
        description: 'Please try again.'
      });
    }
  };

  const clearReaction = async () => {
    try {
      // Clear cells from Supabase
      await supabase.from('cells').delete().neq('x', null);
      
      // Clear local state
      setCells([]);
      cellsRef.current = [];
      
      // Reset TPS tracking
      setTpsData({ count: 0, startTime: null });
      setTps(0);
      setTxCount(0);
      
      toast.success('Chain reaction cleared!');
    } catch (error) {
      console.error('Error clearing reaction:', error);
      toast.error('Failed to clear reaction');
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
          const energy = Math.floor(Math.random() * 10) + 10;
          
          randomCells.push({ x: centerX, y: centerY, energy });
          await addCell({ x: centerX, y: centerY, energy });
          await addToTransactionQueue({ x: centerX, y: centerY, energy });
          
          toast.info('Supernova Pattern', {
            description: `A massive explosion starting from the center with energy ${energy}!`
          });
          break;
          
        case 1: // Grid pattern
          const gridSpacing = Math.floor(Math.random() * 3) + 2;
          const randomOffset = Math.floor(Math.random() * gridSpacing);
          
          for (let x = randomOffset; x < GRID_SIZE; x += gridSpacing) {
            for (let y = randomOffset; y < GRID_SIZE; y += gridSpacing) {
              const cellEnergy = Math.floor(Math.random() * 2) + 1;
              randomCells.push({ x, y, energy: cellEnergy });
              await addCell({ x, y, energy: cellEnergy });
              await addToTransactionQueue({ x, y, energy: cellEnergy });
            }
          }
          
          toast.info('Grid Pattern', {
            description: `Creating a grid pattern with spacing ${gridSpacing}`
          });
          break;
          
        // ... rest of the patterns remain the same, just add await to addCell and addToTransactionQueue calls
      }
      
      // Update local state
      setCells(prev => [...prev, ...randomCells]);
      cellsRef.current = [...cellsRef.current, ...randomCells];
      
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
            txQueue={0}
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