// components/SnakeGame/index.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  createWalletClient, 
  custom,
  createPublicClient, 
  http, 
  parseEther,
  formatEther
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somnia } from '@/lib/chains';
import { cn } from '@/lib/utils';
import { toast } from "sonner";

// Components
import GameStats from './GameStats';
import GameBoard from './GameBoard';
import Leaderboard from './Leaderboard';

// Shadcn UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';

// Game constants
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const GAME_SPEED = 100; // ms
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

// ABI for the snake game contract
const ABI = [
  {
    name: 'updateScore',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_player', type: 'address' },
      { name: '_score', type: 'uint256' }
    ],
    outputs: []
  },
  {
    name: 'getPlayerScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getTopScores',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ 
      name: '', 
      type: 'tuple[]',
      components: [
        { name: 'player', type: 'address' },
        { name: 'score', type: 'uint256' }
      ]
    }]
  }
];

// Direction types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

// Position interface
interface Position {
  x: number;
  y: number;
}

// Score interface
interface Score {
  address: string;
  score: number;
}

interface SnakeGameProps {
  privateKey: string;
  userAddress: string;
}

const SnakeGame: React.FC<SnakeGameProps> = ({ privateKey, userAddress }) => {
  
  // Game state
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [txQueue, setTxQueue] = useState<number[]>([]);
  const [highScores, setHighScores] = useState<Score[]>([]);
  const [userScore, setUserScore] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to track the latest state in callbacks
  const snakeRef = useRef(snake);
  snakeRef.current = snake;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const txQueueRef = useRef(txQueue);
  txQueueRef.current = txQueue;

  // Create viem clients
  const [walletClient, setWalletClient] = useState<any>(null);
  const [publicClient, setPublicClient] = useState<any>(null);
  
  // Initialize blockchain connection
  useEffect(() => {
    const initBlockchain = async () => {
      try {
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
        
        // Get high scores and user score
        if (CONTRACT_ADDRESS) {
          await fetchHighScores(client);
          await fetchUserScore(client, userAddress);
        }
      } catch (error) {
        console.error("Blockchain connection error:", error);
        setError("Failed to connect to blockchain. Please check your connection.");
      }
    };
    
    if (privateKey && userAddress) {
      initBlockchain();
    }
  }, [privateKey, userAddress]);

  // Fetch high scores from contract
  const fetchHighScores = async (client: any) => {
    if (!CONTRACT_ADDRESS) return;
    
    try {
      const scores = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'getTopScores'
      });
      
      const formattedScores = scores.map((score: any) => ({
        address: score.player,
        score: Number(score.score)
      }));
      
      setHighScores(formattedScores);
    } catch (error) {
      console.error("Error fetching high scores:", error);
    }
  };

  // Fetch user score from contract
  const fetchUserScore = async (client: any, address: string) => {
    if (!CONTRACT_ADDRESS) return;
    
    try {
      const score = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'getPlayerScore',
        args: [address]
      });
      
      setUserScore(Number(score));
    } catch (error) {
      console.error("Error fetching user score:", error);
    }
  };

  // Generate random food position
  const generateFood = useCallback((): Position => {
    const newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    
    // Make sure food doesn't spawn on snake
    const isOnSnake = snakeRef.current.some(
      segment => segment.x === newFood.x && segment.y === newFood.y
    );
    
    if (isOnSnake) {
      return generateFood();
    }
    
    return newFood;
  }, []);

  // Update snake position
  const moveSnake = useCallback(() => {
    if (gameOverRef.current || isPausedRef.current) return;
    
    const head = { ...snakeRef.current[0] };
    
    // Move head based on direction
    switch (directionRef.current) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }
    
    // Check for collisions
    if (
      head.x < 0 || head.x >= GRID_SIZE ||
      head.y < 0 || head.y >= GRID_SIZE ||
      snakeRef.current.some(segment => segment.x === head.x && segment.y === head.y)
    ) {
      setGameOver(true);
      submitFinalScore();
      return;
    }
    
    // Create new snake array with new head
    const newSnake = [head, ...snakeRef.current];
    
    // Check if snake ate food
    if (head.x === food.x && head.y === food.y) {
      // Increment score
      setScore(prevScore => prevScore + 1);
      
      // Generate new food
      setFood(generateFood());
      
      // Add score to transaction queue
      setTxQueue(prevQueue => [...prevQueue, scoreRef.current + 1]);
    } else {
      // Remove tail if snake didn't eat
      newSnake.pop();
    }
    
    setSnake(newSnake);
  }, [food, generateFood]);

  // Process transaction queue in a non-blocking way
  useEffect(() => {
    const processTxQueue = async () => {
      if (txQueueRef.current.length > 0 && walletClient && publicClient && !isLoading && CONTRACT_ADDRESS) {
        setIsLoading(true);
        
        try {
          const scoreToSubmit = txQueueRef.current[0];
          
          // Get the current nonce for the wallet account
          const nonce = await publicClient.getTransactionCount({
            address: walletClient.account.address
          });
          
          // Prepare transaction
          const { request } = await publicClient.simulateContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI,
            functionName: 'updateScore',
            args: [userAddress, BigInt(scoreToSubmit)],
            account: walletClient.account,
          });
          
          // Send transaction with nonce
          const hash = await walletClient.writeContract({
            ...request,
          });
          
          // Show pending toast
          toast('Transaction Sent', {
            description: `Score ${scoreToSubmit} is being recorded on blockchain... (Tx: ${hash.slice(0, 6)}...)`,
          });
          
          // Wait for transaction receipt
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          
          // Remove processed item from queue
          setTxQueue(prevQueue => prevQueue.slice(1));
          
          // Show success toast
          toast.success('Game Over Score Recorded', {
            description: `Your final score of ${scoreRef.current} is now on the blockchain! (Tx: ${hash.slice(0, 6)}...)`,
          });
          
          console.log(`Score ${scoreToSubmit} recorded on blockchain. Hash: ${hash}`);
        } catch (error) {
          console.error("Error sending transaction:", error);
          
          // Show error toast
          toast.error('Final Score Submission Failed', {
            description: "Could not record your final score. The transaction failed.",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    const interval = setInterval(processTxQueue, 1000);
    return () => clearInterval(interval);
  }, [walletClient, publicClient, userAddress, isLoading]);

  // Submit final score when game over
  const submitFinalScore = async () => {
    if (!walletClient || !publicClient || !CONTRACT_ADDRESS) return;
    
    try {
      // Get the current nonce for the wallet account
      const nonce = await publicClient.getTransactionCount({
        address: walletClient.account.address
      });
      
      // Prepare transaction
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI,
        functionName: 'updateScore',
        args: [userAddress, BigInt(scoreRef.current)],
        account: walletClient.account
      });
      
      // Send transaction
      const hash = await walletClient.writeContract({
        ...request
      });
      
      // Show pending toast
      toast('Final Score Transaction Sent', {
        description: `Your final score of ${scoreRef.current} is being recorded... (Tx: ${hash.slice(0, 6)}...)`,
      });
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Update high scores and user score
      await fetchHighScores(publicClient);
      await fetchUserScore(publicClient, userAddress);
      
      // Show success toast
      toast.success('Game Over Score Recorded', {
        description: `Your final score of ${scoreRef.current} is now on the blockchain! (Tx: ${hash.slice(0, 6)}...)`,
      });
      
      console.log(`Final score ${scoreRef.current} recorded on blockchain. Hash: ${hash}`);
    } catch (error) {
      console.error("Error submitting final score:", error);
      toast.error('Final Score Submission Failed', {
        description: "Could not record your final score. The transaction failed.",
      });
    }
  };

  // Game loop
  useEffect(() => {
    const gameInterval = setInterval(() => {
      moveSnake();
    }, GAME_SPEED);
    
    return () => clearInterval(gameInterval);
  }, [moveSnake]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;
      
      switch (e.key) {
        case 'ArrowUp':
          if (directionRef.current !== 'DOWN') {
            setDirection('UP');
          }
          break;
        case 'ArrowDown':
          if (directionRef.current !== 'UP') {
            setDirection('DOWN');
          }
          break;
        case 'ArrowLeft':
          if (directionRef.current !== 'RIGHT') {
            setDirection('LEFT');
          }
          break;
        case 'ArrowRight':
          if (directionRef.current !== 'LEFT') {
            setDirection('RIGHT');
          }
          break;
        case ' ':
          setIsPaused(!isPausedRef.current);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Restart game
  const restartGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood());
    setDirection('RIGHT');
    setGameOver(false);
    setScore(0);
    setTxQueue([]);
  };

  // Render game board with shadcn components
  return (
    <div className="flex flex-col items-center max-w-6xl mx-auto">
      {error && (
        <Alert variant="destructive" className="mb-4 w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-10 gap-6 w-full mb-6">
        {/* Left sidebar - Game stats (30%) */}
        <div className="md:col-span-3">
          <GameStats 
            score={score}
            txQueue={txQueue}
            userScore={userScore}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            restartGame={restartGame}
          />
        </div>
        
        {/* Main game area (70%) */}
        <div className="md:col-span-7">
          <GameBoard 
            snake={snake}
            food={food}
            gameOver={gameOver}
            score={score}
            restartGame={restartGame}
            gridSize={GRID_SIZE}
            cellSize={CELL_SIZE}
          />
        </div>
      </div>
      
      {/* Leaderboard (full width) */}
      <div className="w-full">
        <Leaderboard 
          highScores={highScores}
          userAddress={userAddress}
        />
      </div>
    </div>
  );
};

export default SnakeGame;