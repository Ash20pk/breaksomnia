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

// Components
import ReactionStats from './ReactionStats';
import ReactionBoard from './ReactionBoard';
import TransactionLog from './TransactionLog';

// Shadcn UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Game constants
const GRID_SIZE = 40;
const CELL_SIZE = 16;
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
  const [txQueue, setTxQueue] = useState<Cell[]>([]);
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
  const txQueueRef = useRef(txQueue);
  txQueueRef.current = txQueue;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  
  // Create viem clients
  const [walletClient, setWalletClient] = useState<any>(null);
  const [publicClient, setPublicClient] = useState<any>(null);
  
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

  // Poll for active cells
  useEffect(() => {
    const pollBlockchain = async () => {
      if (!publicClient || !CONTRACT_ADDRESS) return;
      
      try {
        // Get recent active cells from the contract
        const recentCells = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: ABI,
          functionName: 'getRecentActiveCells',
          args: [50] // Get last 50 active cells
        });
        
        // Get total cell count
        const totalCells = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: ABI,
          functionName: 'getActiveCellCount'
        });
        
        setTxCount(Number(totalCells));
        
        // Update cells based on recent data
        const newCells: Cell[] = [];
        recentCells.forEach((cell: any) => {
          const x = Number(cell.x);
          const y = Number(cell.y);
          const energy = Number(cell.energy);
          
          // Check if cell already exists in our new array
          const existingCellIndex = newCells.findIndex(c => c.x === x && c.y === y);
          if (existingCellIndex >= 0) {
            // Update energy (newer data overwrites older)
            newCells[existingCellIndex].energy = energy;
          } else {
            // Add new cell
            newCells.push({ x, y, energy });
          }
          
          // Add to transactions if not already there
          const txExists = transactions.some(tx => 
            tx.x === x && tx.y === y && tx.timestamp === Number(cell.lastUpdated)
          );
          
          if (!txExists) {
            const newTx: Transaction = {
              hash: `cell-${Date.now()}-${x}-${y}`, // Placeholder hash since we don't have tx hash
              x,
              y,
              energy,
              timestamp: Number(cell.lastUpdated)
            };
            
            setTransactions(prev => [newTx, ...prev].slice(0, 50));
          }
        });
        
        // Replace all cells with the ones from the blockchain
        // This ensures we stay in sync with the on-chain state
        setCells(newCells);
        
      } catch (error) {
        console.error("Error polling blockchain:", error);
      }
    };
    
    const interval = setInterval(pollBlockchain, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [publicClient, transactions]);

  // Process transaction queue
  useEffect(() => {
    const processTxQueue = async () => {
      if (txQueueRef.current.length > 0 && walletClient && publicClient && !isLoading && CONTRACT_ADDRESS) {
        setIsLoading(true);
        
        try {
          const cellToSubmit = txQueueRef.current[0];
          
          // Prepare transaction
          const { request } = await publicClient.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'updateCell',
            args: [BigInt(cellToSubmit.x), BigInt(cellToSubmit.y), BigInt(cellToSubmit.energy)],
            account: walletClient.account
          });
          
          // Send transaction
          const hash = await walletClient.writeContract({
            ...request,
          });
          
          // Update TPS tracking
          const now = Date.now();
          const newTxCount = txCount + 1;
          setTxCount(newTxCount);
          
          // Update TPS data
          if (tpsData.startTime === null) {
            setTpsData({
              count: 1,
              startTime: now
            });
          } else {
            const newCount = tpsData.count + 1;
            setTpsData(prev => ({
              count: newCount,
              startTime: prev.startTime
            }));
            
            // Calculate TPS
            const elapsedSeconds = (now - tpsData.startTime) / 1000;
            if (elapsedSeconds > 0) {
              const newTps = newCount / elapsedSeconds;
              setTps(parseFloat(newTps.toFixed(2)));
            }
          }
          
          // Show toast
          toast('Cell Updated', {
            description: `Cell at (${cellToSubmit.x}, ${cellToSubmit.y}) with energy ${cellToSubmit.energy} recorded on chain.`,
          });
          
          // Add to transactions list
          const newTx: Transaction = {
            hash: hash,
            x: cellToSubmit.x,
            y: cellToSubmit.y,
            energy: cellToSubmit.energy,
            timestamp: Math.floor(Date.now() / 1000)
          };
          
          setTransactions(prev => [newTx, ...prev].slice(0, 50));
          
          // Remove from queue
          setTxQueue(prev => prev.slice(1));
          
        } catch (error) {
          console.error("Error sending transaction:", error);
          toast.error('Transaction Failed', {
            description: "Could not record explosion on blockchain.",
          });
          
          // Remove failed transaction from queue
          setTxQueue(prev => prev.slice(1));
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    const interval = setInterval(processTxQueue, 1000);
    return () => clearInterval(interval);
  }, [walletClient, publicClient, isLoading, txCount, tpsData]);

  // Update TPS calculation
  useEffect(() => {
    const updateTPS = () => {
      if (tpsData.startTime && tpsData.count > 0) {
        const elapsedSeconds = (Date.now() - tpsData.startTime) / 1000;
        if (elapsedSeconds > 0) {
          const currentTPS = tpsData.count / elapsedSeconds;
          setTps(parseFloat(currentTPS.toFixed(2)));
        }
      }
    };
    
    const tpsInterval = setInterval(updateTPS, 1000);
    return () => clearInterval(tpsInterval);
  }, [tpsData]);

  // Helper function to process new cell creation or energy addition
  const processNewCell = (cells: Cell[], x: number, y: number, energy: number) => {
    // Check if cell already exists
    const existingCellIndex = cells.findIndex(cell => cell.x === x && cell.y === y);
    
    if (existingCellIndex >= 0) {
      // Cell exists, increase energy up to max
      const existingCell = cells[existingCellIndex];
      const newEnergy = Math.min(existingCell.energy + energy, MAX_ENERGY);
      
      cells[existingCellIndex] = { 
        ...existingCell, 
        energy: newEnergy 
      };
      
      // Add to transaction queue
      setTxQueue(prev => [...prev, { 
        x, 
        y, 
        energy: newEnergy 
      }]);
      
      // Check if this cell should explode now
      if (newEnergy > 1) {
        // Recursively trigger explosion
        return triggerExplosion(cells, x, y, newEnergy);
      }
    } else {
      // Create new cell
      cells.push({ x, y, energy });
      
      // Add to transaction queue
      setTxQueue(prev => [...prev, { x, y, energy }]);
      
      // Check if this cell should explode now
      if (energy > 1) {
        // Recursively trigger explosion
        return triggerExplosion(cells, x, y, energy);
      }
    }
    
    return cells;
  };

  // Trigger explosion function with more dynamic patterns
  const triggerExplosion = (currentCells: Cell[], x: number, y: number, energy: number): Cell[] => {
    // Sound feedback (would be nice to have, but requires browser audio permission)
    if (energy > 10) {
      // Could add audio effects here if needed
    }
    
    // Notify with toast for big explosions
    if (energy > 15) {
      toast.success(`Massive Chain Reaction at (${x}, ${y})!`, {
        description: `Energy level ${energy} created a massive explosion!`,
      });
    }
    
    // Different explosion patterns based on energy level
    if (energy === 2) {
      // Pattern 1: Simple 2-way split
      // Remove energy from current cell
      const updatedCells = currentCells.filter(cell => !(cell.x === x && cell.y === y));
      
      // Define possible directions: up, right, down, left
      const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }  // left
      ];
      
      // Shuffle directions
      const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);
      const chosenDirs = shuffledDirs.slice(0, 2); // Take first two directions
      
      // Create new cells in chosen directions
      chosenDirs.forEach(dir => {
        const newX = x + dir.dx;
        const newY = y + dir.dy;
        
        // Ensure new coordinates are within grid bounds
        if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
          // Check if cell already exists
          const existingCellIndex = updatedCells.findIndex(cell => cell.x === newX && cell.y === newY);
          
          if (existingCellIndex >= 0) {
            // Cell exists, increase energy
            const existingCell = updatedCells[existingCellIndex];
            
            if (existingCell.energy < MAX_ENERGY) {
              updatedCells[existingCellIndex] = { 
                ...existingCell, 
                energy: existingCell.energy + 1 
              };
              
              // Check if this cell should explode now
              if (updatedCells[existingCellIndex].energy > 1) {
                // Add to transaction queue
                setTxQueue(prev => [...prev, { 
                  x: newX, 
                  y: newY, 
                  energy: updatedCells[existingCellIndex].energy 
                }]);
                
                // Recursively trigger explosion
                return triggerExplosion(
                  updatedCells, 
                  newX, 
                  newY, 
                  updatedCells[existingCellIndex].energy
                );
              }
            }
          } else {
            // Create new cell
            updatedCells.push({ x: newX, y: newY, energy: 1 });
            
            // Add to transaction queue
            setTxQueue(prev => [...prev, { x: newX, y: newY, energy: 1 }]);
          }
        }
      });
      
      return updatedCells;
    }
    else if (energy >= 3 && energy < 7) {
      // Pattern 2: Cross pattern
      const updatedCells = currentCells.filter(cell => !(cell.x === x && cell.y === y));
      
      // Define the four directions
      const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }  // left
      ];
      
      // Energy distribution
      const baseEnergy = Math.floor(energy / 4);
      const extraEnergy = energy % 4;
      
      // Distribute to all four directions
      directions.forEach((dir, index) => {
        const newX = x + dir.dx;
        const newY = y + dir.dy;
        
        // Extra energy goes to random directions
        let dirEnergy = baseEnergy;
        if (index < extraEnergy) {
          dirEnergy += 1;
        }
        
        if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE && dirEnergy > 0) {
          processNewCell(updatedCells, newX, newY, dirEnergy);
        }
      });
      
      return updatedCells;
    }
    else if (energy >= 7 && energy < 15) {
      // Pattern 3: Star pattern (8 directions)
      const updatedCells = currentCells.filter(cell => !(cell.x === x && cell.y === y));
      
      // Define 8 directions (including diagonals)
      const directions = [
        { dx: 0, dy: -1 },  // up
        { dx: 1, dy: -1 },  // up-right
        { dx: 1, dy: 0 },   // right
        { dx: 1, dy: 1 },   // down-right
        { dx: 0, dy: 1 },   // down
        { dx: -1, dy: 1 },  // down-left
        { dx: -1, dy: 0 },  // left
        { dx: -1, dy: -1 }, // up-left
      ];
      
      // Energy distribution - base energy with some randomness
      const baseEnergy = Math.floor(energy / 8);
      let remainingEnergy = energy % 8;
      
      // Distribute energy
      directions.forEach(dir => {
        const newX = x + dir.dx;
        const newY = y + dir.dy;
        
        // Calculate energy for this direction
        let dirEnergy = baseEnergy;
        
        // Add some randomness to the energy distribution
        if (remainingEnergy > 0 && Math.random() > 0.5) {
          dirEnergy += 1;
          remainingEnergy -= 1;
        }
        
        if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE && dirEnergy > 0) {
          processNewCell(updatedCells, newX, newY, dirEnergy);
        }
      });
      
      return updatedCells;
    }
    else if (energy >= 15) {
      // Pattern 4: Supernova (larger radius explosion)
      const updatedCells = currentCells.filter(cell => !(cell.x === x && cell.y === y));
      
      // Define explosion radius based on energy
      const radius = Math.min(3, Math.floor(energy / 10) + 1);
      
      // Collect all cells within radius
      const targetCells = [];
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Skip the center cell
          if (dx === 0 && dy === 0) continue;
          
          // Skip cells outside the circular radius (approximation)
          if (dx*dx + dy*dy > radius*radius) continue;
          
          const newX = x + dx;
          const newY = y + dy;
          
          if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
            // Calculate energy based on distance from center
            const distance = Math.sqrt(dx*dx + dy*dy);
            const dirEnergy = Math.max(1, Math.floor((energy / (radius * 2)) * (1 - distance/radius)));
            
            targetCells.push({ x: newX, y: newY, energy: dirEnergy });
          }
        }
      }
      
      // Process all the target cells
      targetCells.forEach(target => {
        processNewCell(updatedCells, target.x, target.y, target.energy);
      });
      
      return updatedCells;
    }
    
    return currentCells;
  };

  // Handle cell click
  const handleCellClick = (x: number, y: number) => {
    if (isPausedRef.current) return;
    
    // Find if cell already exists
    const cellIndex = cellsRef.current.findIndex(cell => cell.x === x && cell.y === y);
    let updatedCells = [...cellsRef.current];
    
    if (cellIndex >= 0) {
      // Cell exists, increase energy
      const cell = updatedCells[cellIndex];
      
      // Check energy limit
      if (cell.energy >= MAX_ENERGY) {
        // Cell has reached max energy, cannot add more
        toast.info('Cell at maximum energy', {
          description: `Cell at (${x}, ${y}) has reached maximum energy capacity.`
        });
        return;
      }
      
      // Increase energy by 1
      const updatedCell = { ...cell, energy: cell.energy + 1 };
      updatedCells[cellIndex] = updatedCell;
      
      // Check if cell should explode (energy > 1)
      if (updatedCell.energy > 1) {
        // Add to transaction queue
        setTxQueue(prev => [...prev, { x, y, energy: updatedCell.energy }]);
        
        // Trigger explosion
        updatedCells = triggerExplosion(updatedCells, x, y, updatedCell.energy);
      }
    } else {
      // Create new cell with energy 1
      updatedCells.push({ x, y, energy: 1 });
      
      // Add to transaction queue
      setTxQueue(prev => [...prev, { x, y, energy: 1 }]);
    }
    
    setCells(updatedCells);
  };

  // Clear all cells
  const clearReaction = () => {
    setCells([]);
    setTxQueue([]);
    // Reset TPS tracking
    setTpsData({ count: 0, startTime: null });
    setTps(0);
  };

  // Start a random reaction with different pattern options
  const startRandomReaction = () => {
    // Clear current cells first
    clearReaction();
    
    // Choose a random pattern type
    const patternType = Math.floor(Math.random() * 5);
    let randomCells: Cell[] = [];
    
    switch(patternType) {
      case 0:
        // Pattern: Single high-energy cell in the center
        const centerX = Math.floor(GRID_SIZE / 2);
        const centerY = Math.floor(GRID_SIZE / 2);
        const energy = Math.floor(Math.random() * 10) + 10; // 10-19 energy for a big explosion
        
        randomCells.push({ x: centerX, y: centerY, energy });
        setTxQueue(prev => [...prev, { x: centerX, y: centerY, energy }]);
        
        toast.info('Supernova Pattern', {
          description: `A massive explosion starting from the center with energy ${energy}!`
        });
        break;
        
      case 1:
        // Pattern: Grid of low-energy cells
        const gridSpacing = 4;
        const randomOffset = Math.floor(Math.random() * gridSpacing);
        
        for (let x = randomOffset; x < GRID_SIZE; x += gridSpacing) {
          for (let y = randomOffset; y < GRID_SIZE; y += gridSpacing) {
            const cellEnergy = Math.floor(Math.random() * 2) + 1; // 1-2 energy
            randomCells.push({ x, y, energy: cellEnergy });
            setTxQueue(prev => [...prev, { x, y, energy: cellEnergy }]);
          }
        }
        
        toast.info('Grid Pattern', {
          description: `A grid of cells with small amounts of energy.`
        });
        break;
        
      case 2:
        // Pattern: Spiral of cells with increasing energy
        const spiralCenterX = Math.floor(GRID_SIZE / 2);
        const spiralCenterY = Math.floor(GRID_SIZE / 2);
        const maxRadius = Math.min(10, Math.floor(Math.min(GRID_SIZE, GRID_SIZE) / 2) - 1);
        
        // Create spiral coordinates
        for (let radius = 1; radius <= maxRadius; radius++) {
          const angularStepCount = Math.ceil(2 * Math.PI * radius);
          const angularStep = 2 * Math.PI / angularStepCount;
          
          for (let i = 0; i < angularStepCount; i++) {
            const angle = i * angularStep;
            const x = Math.floor(spiralCenterX + radius * Math.cos(angle));
            const y = Math.floor(spiralCenterY + radius * Math.sin(angle));
            
            // Only add if within bounds
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
              // Energy increases toward center
              const cellEnergy = Math.max(1, Math.floor((maxRadius - radius + 1) / 2));
              
              // Skip some cells randomly for a more natural look
              if (Math.random() > 0.3) {
                randomCells.push({ x, y, energy: cellEnergy });
                setTxQueue(prev => [...prev, { x, y, energy: cellEnergy }]);
              }
            }
          }
        }
        
        toast.info('Spiral Pattern', {
          description: `A spiral of energy, more intense toward the center.`
        });
        break;
        
      case 3:
        // Pattern: Random line
        const horizontal = Math.random() > 0.5;
        const position = Math.floor(Math.random() * GRID_SIZE);
        
        for (let i = 0; i < GRID_SIZE; i++) {
          // Skip some cells randomly
          if (Math.random() < 0.2) continue;
          
          const x = horizontal ? i : position;
          const y = horizontal ? position : i;
          const cellEnergy = Math.floor(Math.random() * 3) + 1; // 1-3 energy
          
          randomCells.push({ x, y, energy: cellEnergy });
          setTxQueue(prev => [...prev, { x, y, energy: cellEnergy }]);
        }
        
        toast.info(`${horizontal ? 'Horizontal' : 'Vertical'} Line Pattern`, {
          description: `A line of energized cells.`
        });
        break;
        
      case 4:
      default:
        // Pattern: Classic random cells
        const numStartCells = Math.floor(Math.random() * 5) + 5; // 5-9 cells
        
        for (let i = 0; i < numStartCells; i++) {
          const x = Math.floor(Math.random() * GRID_SIZE);
          const y = Math.floor(Math.random() * GRID_SIZE);
          const cellEnergy = Math.floor(Math.random() * 5) + 1; // 1-5 energy
          
          // Check if cell already exists
          const existingCellIndex = randomCells.findIndex(cell => cell.x === x && cell.y === y);
          
          if (existingCellIndex >= 0) {
            // Update energy
            randomCells[existingCellIndex].energy = Math.min(
              randomCells[existingCellIndex].energy + cellEnergy, 
              MAX_ENERGY
            );
          } else {
            // Add new cell
            randomCells.push({ x, y, energy: cellEnergy });
          }
          
          // Add to transaction queue
          setTxQueue(prev => [...prev, { x, y, energy: cellEnergy }]);
        }
        
        toast.info('Random Pattern', {
          description: `${numStartCells} randomly placed energy cells.`
        });
        break;
    }
    
    // Set initial cells
    setCells(randomCells);
    
    // Trigger explosions for cells with energy > 1
    let updatedCells = [...randomCells];
    for (const cell of randomCells) {
      if (cell.energy > 1) {
        updatedCells = triggerExplosion(updatedCells, cell.x, cell.y, cell.energy);
      }
    }
    
    setCells(updatedCells);
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
            txQueue={txQueue.length}
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
      
      {/* Transaction queue progress */}
      {txQueue.length > 0 && (
        <div className="w-full mt-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Transaction Queue:</span>
            <span>{txQueue.length} pending</span>
          </div>
          <Progress value={(1 - txQueue.length / (txQueue.length + 1)) * 100} />
        </div>
      )}
    </div>
  );
};

export default ChainReaction;