// components/SnakeGame/GameBoard.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Position {
  x: number;
  y: number;
}

interface GameBoardProps {
  snake: Position[];
  food: Position;
  gameOver: boolean;
  score: number;
  restartGame: () => void;
  gridSize: number;
  cellSize: number;
}

const GameBoard: React.FC<GameBoardProps> = ({
  snake,
  food,
  gameOver,
  score,
  restartGame,
  gridSize,
  cellSize
}) => {
  // SVG path for somnia logo
  const somniaLogo = `
    <svg width="${cellSize}" height="${cellSize}" viewBox="0 0 2400 2400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1194.26 2399.99C1853.01 2403.1 2394.68 1868.66 2399.96 1209.87C2401 1077.79 2380.64 950.616 2342.27 831.547C2058.61 855.022 1781.55 975.127 1564.55 1192.15C1329.25 1427.45 1207.83 1733.37 1200.1 2041.65C1199.53 2064.75 1169.56 2073.23 1156.74 2054.09C1002.32 1823.41 739.405 1671.53 440.948 1671.53C329.145 1671.53 222.243 1692.84 124.203 1731.68C319.435 2126.03 724.982 2397.72 1194.26 2399.99Z" fill="#6366f1"/>
        <path d="M1199.99 358.728C1200.56 335.631 1230.53 327.146 1243.35 346.284C1397.77 576.973 1660.68 728.848 1959.14 728.848C2071.04 728.848 2177.94 707.448 2275.98 668.607C2080.84 274.069 1675.2 2.27692 1205.84 0.0143355C546.988 -3.19099 5.22254 531.532 0.037734 1190.41C-0.999227 1322.49 19.3629 1449.76 57.8247 1568.83C341.386 1545.36 618.538 1425.25 835.451 1208.23C1070.75 972.924 1192.17 667.004 1199.9 358.728H1199.99Z" fill="#4f46e5"/>
    </svg>
  `;
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Snake Game</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        {/* Game board */}
        <div 
          className="relative border-2 border-gray-800 bg-gray-100 dark:bg-gray-900"
          style={{
            width: gridSize * cellSize,
            height: gridSize * cellSize,
          }}
        >
          {/* Render snake */}
          {snake.map((segment, index) => (
            <div 
              key={index}
              className="absolute bg-green-500 dark:bg-green-600"
              style={{
                width: cellSize,
                height: cellSize,
                left: segment.x * cellSize,
                top: segment.y * cellSize,
                borderRadius: index === 0 ? '50% 50% 0 0' : '2px',
              }}
            />
          ))}
          
          {/* Render food (Somnia logo) */}
          <div 
            className="absolute"
            style={{
              width: cellSize,
              height: cellSize,
              left: food.x * cellSize,
              top: food.y * cellSize,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '2px',
            }}
            dangerouslySetInnerHTML={{ __html: somniaLogo }}
          />
          
          {/* Game over overlay */}
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 text-white">
              <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
              <p className="text-xl mb-4">Your Score: {score}</p>
              <Button 
                onClick={restartGame}
                size="lg"
              >
                Play Again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <div className="px-6 pb-4 text-center text-sm text-muted-foreground">
        Use arrow keys to move. Space to pause.
      </div>
    </Card>
  );
};

export default GameBoard;