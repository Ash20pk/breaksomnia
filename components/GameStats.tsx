// components/SnakeGame/GameStats.tsx
import React from 'react';
import { PlayIcon, PauseIcon, RefreshCwIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface GameStatsProps {
  score: number;
  txQueue: number[];
  userScore: number;
  isPaused: boolean;
  txCount?: number;
  tps?: number;
  setIsPaused: (paused: boolean) => void;
  restartGame: () => void;
}

const GameStats: React.FC<GameStatsProps> = ({
  score,
  txQueue,
  userScore,
  isPaused,
  txCount = 0,
  tps = 0,
  setIsPaused,
  restartGame
}) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Game Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Score:</span>
            <Badge variant="secondary" className="text-xl">{score}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Pending Tx:</span>
            <Badge variant="outline" className={txQueue.length > 0 ? "bg-amber-100" : ""}>{txQueue.length}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Best Score:</span>
            <Badge variant="secondary">{userScore}</Badge>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Tx Count:</span>
            <Badge variant="outline">{txCount}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">TPS:</span>
            <Badge variant="secondary" className={tps > 0 ? "bg-green-100 dark:bg-green-900" : ""}>{tps}</Badge>
          </div>
          <Separator />
          <div className="flex justify-between gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="flex-1"
            >
              {isPaused ? <PlayIcon className="mr-1 h-4 w-4" /> : <PauseIcon className="mr-1 h-4 w-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button 
              variant="default" 
              size="sm"
              onClick={restartGame}
              className="flex-1"
            >
              <RefreshCwIcon className="mr-1 h-4 w-4" />
              Restart
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GameStats;