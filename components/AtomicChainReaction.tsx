'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somnia } from '@/lib/chains';
import { toast } from "sonner";
import { 
  addCell, 
  addToTransactionQueue,
  getPendingTransactionCount,
  getNextPendingTransaction,
  updateTransactionStatus,
  getTransactionTypes
} from '@/app/action';

// Components
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Beaker, 
  Atom, 
  ZapOff, 
  Plus, 
  RotateCw, 
  Pause, 
  Play, 
  Trash2, 
  Sparkles, 
  BarChart3 
} from 'lucide-react';

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const MAX_ENERGY = 4;  // Energy level required for explosion
const ATOM_RADIUS = 15;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

// ABI for our contract
const ABI = [
  {
    name: 'recordReaction',
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
    name: 'recordExplosion',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  }
];

// Atom interface
interface Atom {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  radius: number;
  color: string;
  lastCollision: number;
}

// Transaction interface
interface Transaction {
  hash: string;
  atomId?: string;
  x: number;
  y: number;
  energy: number;
  timestamp: number;
  type: string;
}

const AtomicChainReaction: React.FC = () => {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  
  // State
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [txCount, setTxCount] = useState(0);
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const [explosionCount, setExplosionCount] = useState(0);
  const [tps, setTps] = useState(0);
  const [maxAtoms, setMaxAtoms] = useState(50);
  const [showStats, setShowStats] = useState(false);
  
  // Transaction type constants
  const [txTypes, setTxTypes] = useState({
    REACTION: 'reaction',
    EXPLOSION: 'explosion'
  });
  
  // Blockchain clients
  const [walletClient, setWalletClient] = useState<any>(null);
  const [publicClient, setPublicClient] = useState<any>(null);
  
  // Processing flags
  const processingTxRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Initialize transaction types from server
  useEffect(() => {
    async function fetchTransactionTypes() {
      try {
        const types = await getTransactionTypes();
        setTxTypes({
          REACTION: types.REACTION,
          EXPLOSION: types.EXPLOSION
        });
      } catch (error) {
        console.error('Error fetching transaction types:', error);
      }
    }
    
    fetchTransactionTypes();
  }, []);

  // Initialize blockchain connection
  useEffect(() => {
    const initBlockchain = async () => {
      try {
        const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
        
        if (!privateKey) {
          console.warn("No private key provided. Running in view-only mode.");
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
        
        toast.success('Connected to blockchain');
      } catch (error) {
        console.error("Blockchain connection error:", error);
        toast.error("Failed to connect to blockchain. Operating in view-only mode.");
      }
    };
    
    initBlockchain();
  }, []);

  // Process transaction queue
  useEffect(() => {
    let isMounted = true;
    
    const processTxQueue = async () => {
      if (processingTxRef.current || isLoadingRef.current || isPaused || !walletClient || !publicClient || !CONTRACT_ADDRESS) {
        return;
      }
      
      processingTxRef.current = true;
      
      try {
        const result = await getNextPendingTransaction();
        
        if (!isMounted) return;
        
        if (result.error) {
          console.error('Error getting next pending transaction:', result.error);
          processingTxRef.current = false;
          return;
        }
        
        const nextTx = result.transaction;
        
        if (nextTx && nextTx.id) {
          isLoadingRef.current = true;
          
          try {
            let hash;
            
            if (nextTx.type === txTypes.EXPLOSION) {
              // Process explosion transaction
              const { request } = await publicClient.simulateContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: ABI,
                functionName: 'recordExplosion',
                args: [],
                account: walletClient.account
              });
              
              // Send transaction
              hash = await walletClient.writeContract({
                ...request,
              });
              
              setExplosionCount(prev => prev + 1);
            } else {
              // Process regular reaction transaction
              const { request } = await publicClient.simulateContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: ABI,
                functionName: 'recordReaction',
                args: [BigInt(nextTx.x), BigInt(nextTx.y), BigInt(nextTx.energy)],
                account: walletClient.account
              });
              
              // Send transaction
              hash = await walletClient.writeContract({
                ...request,
              });
              
              setTxCount(prev => prev + 1);
            }
            
            // Update transaction status
            await updateTransactionStatus(nextTx.id, 'sent', hash);
            
            // Add to transactions list
            if (isMounted) {
              setTransactions(prev => {
                const newTransaction: Transaction = {
                  hash,
                  x: nextTx.x,
                  y: nextTx.y,
                  energy: nextTx.energy,
                  timestamp: Date.now(),
                  type: nextTx.type || txTypes.REACTION
                };
                
                const newTransactions = [newTransaction, ...prev];
                return newTransactions.slice(0, 50); // Keep only 50 latest
              });
            }
            
          } catch (err: any) {
            console.error('Transaction error:', err);
            // Mark transaction as failed
            await updateTransactionStatus(nextTx.id, 'failed');
          } finally {
            if (isMounted) {
              isLoadingRef.current = false;
            }
          }
        }
      } catch (error) {
        console.error('Error processing transaction queue:', error);
      } finally {
        processingTxRef.current = false;
      }
    };
    
    const interval = setInterval(processTxQueue, 2000);
    
    // Poll for pending transaction count
    const pendingInterval = setInterval(async () => {
      if (isMounted && !isPaused) {
        try {
          const result = await getPendingTransactionCount();
          if (isMounted) {
            setPendingTxCount(result.count);
          }
        } catch (error) {
          console.error('Error getting pending transaction count:', error);
        }
      }
    }, 3000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(pendingInterval);
    };
  }, [walletClient, publicClient, isPaused, txTypes]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Animation function
    const animate = (timestamp: number) => {
      if (isPaused) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      // Calculate delta time for smooth animation
      const deltaTime = lastFrameTimeRef.current ? (timestamp - lastFrameTimeRef.current) / 1000 : 0.016;
      lastFrameTimeRef.current = timestamp;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw laboratory background
      drawLaboratory(ctx);
      
      // Update and draw atoms
      updateAtoms(deltaTime);
      
      // Request next frame
      animationRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation loop
    animationRef.current = requestAnimationFrame(animate);
    
    // Clean up animation on unmount
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPaused, atoms]);

  // Draw laboratory background
  const drawLaboratory = (ctx: CanvasRenderingContext2D) => {
    // Draw background grid
    ctx.fillStyle = '#f0f8ff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw grid lines
    ctx.strokeStyle = '#dbeafe';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let y = 0; y < CANVAS_HEIGHT; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let x = 0; x < CANVAS_WIDTH; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    
    // Draw container border
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  };

  // Update atoms positions, check collisions, and draw
  const updateAtoms = (deltaTime: number) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const updatedAtoms = [...atoms];
    const collisionsProcessed = new Set<string>();
    
    // First pass: Movement and wall collisions
    for (let i = 0; i < updatedAtoms.length; i++) {
      const atom = updatedAtoms[i];
      
      // Update position
      atom.x += atom.vx * deltaTime * 60;
      atom.y += atom.vy * deltaTime * 60;
      
      // Handle wall collisions
      if (atom.x - atom.radius < 0) {
        atom.x = atom.radius;
        atom.vx = Math.abs(atom.vx) * 0.9;
      } else if (atom.x + atom.radius > CANVAS_WIDTH) {
        atom.x = CANVAS_WIDTH - atom.radius;
        atom.vx = -Math.abs(atom.vx) * 0.9;
      }
      
      if (atom.y - atom.radius < 0) {
        atom.y = atom.radius;
        atom.vy = Math.abs(atom.vy) * 0.9;
      } else if (atom.y + atom.radius > CANVAS_HEIGHT) {
        atom.y = CANVAS_HEIGHT - atom.radius;
        atom.vy = -Math.abs(atom.vy) * 0.9;
      }
    }
    
    // Second pass: Atom-to-atom collisions
    for (let i = 0; i < updatedAtoms.length; i++) {
      for (let j = i + 1; j < updatedAtoms.length; j++) {
        const atomA = updatedAtoms[i];
        const atomB = updatedAtoms[j];
        
        // Skip if either atom has already been processed for explosion
        if (atomA.energy >= MAX_ENERGY || atomB.energy >= MAX_ENERGY) continue;
        
        // Calculate distance between atoms
        const dx = atomB.x - atomA.x;
        const dy = atomB.y - atomA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check for collision
        if (distance < atomA.radius + atomB.radius) {
          // Create a unique collision ID
          const collisionId = [atomA.id, atomB.id].sort().join('_');
          
          // Check if this collision was already processed recently
          const now = Date.now();
          if (now - atomA.lastCollision > 500 && now - atomB.lastCollision > 500 && !collisionsProcessed.has(collisionId)) {
            collisionsProcessed.add(collisionId);
            
            // Collision response - physics
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Relative velocity
            const vx = atomB.vx - atomA.vx;
            const vy = atomB.vy - atomA.vy;
            
            // Relative velocity along normal
            const velAlongNormal = vx * nx + vy * ny;
            
            // Skip if atoms are moving away from each other
            if (velAlongNormal > 0) continue;
            
            // Bounce effect - simplified physics
            const bounceFactor = 1.5; // More energetic bounce
            
            // New velocities
            const dv = velAlongNormal * bounceFactor;
            
            atomA.vx -= nx * dv;
            atomA.vy -= ny * dv;
            atomB.vx += nx * dv;
            atomB.vy += ny * dv;
            
            // Move atoms apart to prevent sticking
            const overlap = (atomA.radius + atomB.radius - distance) * 0.5;
            atomA.x -= nx * overlap;
            atomA.y -= ny * overlap;
            atomB.x += nx * overlap;
            atomB.y += ny * overlap;
            
            // Increase energy for both atoms
            atomA.energy += 1;
            atomB.energy += 1;
            
            // Update last collision time
            atomA.lastCollision = now;
            atomB.lastCollision = now;
            
            // Update energy colors
            atomA.color = getAtomColor(atomA.energy);
            atomB.color = getAtomColor(atomB.energy);
            
            // Queue transactions
            queueAtomTransaction(atomA);
            queueAtomTransaction(atomB);
            
            // Play collision sound
            playSound('collision');
          }
        }
      }
    }
    
    // Check for explosions
    for (let i = updatedAtoms.length - 1; i >= 0; i--) {
      const atom = updatedAtoms[i];
      
      if (atom.energy >= MAX_ENERGY) {
        // Trigger explosion
        createExplosion(atom.x, atom.y);
        
        // Queue explosion transaction
        queueExplosion(atom);
        
        // Remove the exploded atom
        updatedAtoms.splice(i, 1);
        
        // Play explosion sound
        playSound('explosion');
      }
    }
    
    // Draw atoms
    updatedAtoms.forEach(atom => {
      drawAtom(ctx, atom);
    });
    
    // Update atoms state if needed
    if (JSON.stringify(atoms) !== JSON.stringify(updatedAtoms)) {
      setAtoms(updatedAtoms);
    }
  };

  // Draw a single atom
  const drawAtom = (ctx: CanvasRenderingContext2D, atom: Atom) => {
    // Draw atom circle
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, atom.radius, 0, Math.PI * 2);
    ctx.fillStyle = atom.color;
    ctx.fill();
    
    // Draw atom glow based on energy
    const glowSize = atom.radius * (1 + atom.energy * 0.15);
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, glowSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${240 - atom.energy * 40}, ${240 - atom.energy * 20}, 255, 0.2)`;
    ctx.fill();
    
    // Draw energy indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(atom.energy.toString(), atom.x, atom.y);
    
    // Draw electron rings
    const electronCount = Math.min(4, atom.energy + 1);
    
    for (let i = 0; i < electronCount; i++) {
      const angle = (Date.now() / 1000 * (i + 1)) % (Math.PI * 2);
      const ringRadius = atom.radius * (1.2 + i * 0.3);
      
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 149, 237, ${0.7 - i * 0.15})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw electron
      const electronX = atom.x + Math.cos(angle + i * Math.PI / 2) * ringRadius;
      const electronY = atom.y + Math.sin(angle + i * Math.PI / 2) * ringRadius;
      
      ctx.beginPath();
      ctx.arc(electronX, electronY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00ffff';
      ctx.fill();
    }
  };

  // Create explosion effect
  const createExplosion = (x: number, y: number) => {
    // Create smaller atoms from explosion
    const fragmentCount = Math.floor(Math.random() * 2) + 3; // 3-4 fragments
    
    const newAtoms: Atom[] = [];
    
    for (let i = 0; i < fragmentCount; i++) {
      const angle = (Math.PI * 2 / fragmentCount) * i;
      
      // Create new atom with random properties
      const newAtom: Atom = {
        id: `atom-${Date.now()}-${i}`,
        x: x,
        y: y,
        vx: Math.cos(angle) * (Math.random() * 3 + 2),
        vy: Math.sin(angle) * (Math.random() * 3 + 2),
        energy: 1,
        radius: ATOM_RADIUS * 0.8,
        color: getAtomColor(1),
        lastCollision: 0
      };
      
      newAtoms.push(newAtom);
    }
    
    // Add explosion particles
    setAtoms(prev => [...prev, ...newAtoms]);
  };

  // Get atom color based on energy
  const getAtomColor = (energy: number): string => {
    switch (energy) {
      case 1: return '#4299e1'; // Blue
      case 2: return '#805ad5'; // Purple
      case 3: return '#f56565'; // Red
      case 4: return '#ed8936'; // Orange
      default: return '#4299e1';
    }
  };

  // Add atom to the simulation
  const addAtom = (x: number, y: number) => {
    if (atoms.length >= maxAtoms) {
      toast.warning(`Maximum of ${maxAtoms} atoms reached!`);
      return;
    }
    
    // Create random velocity
    const speed = Math.random() * 1 + 0.5;
    const angle = Math.random() * Math.PI * 2;
    
    const newAtom: Atom = {
      id: `atom-${Date.now()}`,
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      energy: 1,
      radius: ATOM_RADIUS,
      color: getAtomColor(1),
      lastCollision: 0
    };
    
    // Add to state
    setAtoms(prev => [...prev, newAtom]);
    
    // Queue transaction
    queueAtomTransaction(newAtom);
    
    // Play sound
    playSound('add');
  };

  // Add a random atom
  const addRandomAtom = () => {
    const x = Math.random() * (CANVAS_WIDTH - ATOM_RADIUS * 2) + ATOM_RADIUS;
    const y = Math.random() * (CANVAS_HEIGHT - ATOM_RADIUS * 2) + ATOM_RADIUS;
    addAtom(x, y);
  };

  // Queue atom transaction
  const queueAtomTransaction = async (atom: Atom) => {
    try {
      await addToTransactionQueue({
        x: Math.floor(atom.x),
        y: Math.floor(atom.y),
        energy: atom.energy,
        type: txTypes.REACTION
      });
    } catch (error) {
      console.error('Error queuing atom transaction:', error);
    }
  };

  // Queue explosion transaction
  const queueExplosion = async (atom: Atom) => {
    try {
      await addToTransactionQueue({
        x: Math.floor(atom.x),
        y: Math.floor(atom.y),
        energy: atom.energy,
        type: txTypes.EXPLOSION
      });
    } catch (error) {
      console.error('Error queuing explosion transaction:', error);
    }
  };

  // Play sound effect
  const playSound = (type: 'add' | 'collision' | 'explosion') => {
    // In a real app, implement sound effects here
  };

  // Clear all atoms
  const clearAtoms = () => {
    setAtoms([]);
    toast.info('Cleared all atoms');
  };

  // Generate multiple random atoms
  const generateRandomAtoms = () => {
    const count = Math.min(10, maxAtoms - atoms.length);
    
    if (count <= 0) {
      toast.warning(`Maximum of ${maxAtoms} atoms reached!`);
      return;
    }
    
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        addRandomAtom();
      }, i * 100);
    }
    
    toast.success(`Added ${count} random atoms`);
  };

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPaused) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    addAtom(x, y);
  };

  return (
    <div className="flex flex-col items-center py-6 px-4 max-w-7xl mx-auto">
      <div className="w-full mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Beaker className="text-blue-500" />
          Break Somnia
        </h1>
        <p className="text-muted-foreground">
          Click to add atoms, watch them collide and explode when energy reaches {MAX_ENERGY}
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* Left sidebar - Controls */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Atom className="h-5 w-5 text-blue-500" />
                Lab Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Simulation controls */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsPaused(!isPaused)}
                  className="flex items-center gap-1"
                >
                  {isPaused 
                    ? <Play className="h-4 w-4" />
                    : <Pause className="h-4 w-4" />
                  }
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={clearAtoms}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
              
              <Separator />
              
              {/* Atom actions */}
              <Button 
                variant="default"
                onClick={addRandomAtom}
                className="w-full flex items-center gap-1"
                disabled={atoms.length >= maxAtoms}
              >
                <Plus className="h-4 w-4" />
                Add Atom
              </Button>
                            
              <Separator />
              
              {/* Statistics toggle */}
              <Button 
                variant="outline"
                onClick={() => setShowStats(!showStats)}
                className="w-full flex items-center gap-1"
              >
                <BarChart3 className="h-4 w-4" />
                {showStats ? 'Hide Stats' : 'Show Stats'}
              </Button>
            </CardContent>
          </Card>
          
          {/* Stats card */}
          {showStats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Simulation Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active Atoms:</span>
                  <Badge variant="secondary" className="text-lg">{atoms.length}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pending Tx:</span>
                  <Badge variant="outline" className={pendingTxCount > 0 ? "bg-amber-100 dark:bg-amber-900" : ""}>
                    {pendingTxCount}
                  </Badge>
                </div>
                
                <Separator />
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Transactions:</span>
                  <Badge variant="outline">{txCount}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Explosions:</span>
                  <Badge variant="default" className="bg-red-500">{explosionCount}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">TPS:</span>
                  <Badge 
                    variant={tps > 0 ? "default" : "outline"} 
                    className={tps > 10 ? "bg-green-500" : tps > 5 ? "bg-yellow-500" : ""}
                  >
                    {tps.toFixed(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Transactions log */}
          <Card className="h-80 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <RotateCw className="h-5 w-5 text-green-500" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-60 overflow-y-auto space-y-2 pr-2">
                {transactions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <ZapOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No transactions yet</p>
                  </div>
                ) : (
                  transactions.map((tx, i) => (
                    <div key={tx.hash} className="text-xs border rounded p-2 bg-secondary/20">
                      <div className="flex justify-between">
                        <span className="font-medium truncate">
                          {tx.hash.substring(0, 10)}...
                        </span>
                        <Badge 
                          variant="outline" 
                          className={tx.type === txTypes.EXPLOSION ? "bg-red-100 dark:bg-red-900/30" : ""}
                        >
                          {tx.type === txTypes.EXPLOSION ? 'Explosion' : 'Reaction'}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mt-1">
                        {tx.type !== txTypes.EXPLOSION && (
                          <span>Pos: ({tx.x}, {tx.y}) | Energy: {tx.energy}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main simulation area */}
        <div className="lg:col-span-9">
          <Card className="p-4 h-full">
            <canvas 
              ref={canvasRef} 
              width={CANVAS_WIDTH} 
              height={CANVAS_HEIGHT} 
              onClick={handleCanvasClick}
              className="w-full h-full border-2 border-gray-300 rounded-md cursor-pointer"
            />
            
            <div className="mt-2 text-center text-sm text-muted-foreground">
              Click anywhere in the lab to add an atom. Atoms gain energy when they collide and explode at {MAX_ENERGY} energy.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AtomicChainReaction;