// components/ChainReaction/ReactionStats.tsx
import React, { useState } from 'react';
import { PlayIcon, PauseIcon, TrashIcon, ZapIcon, FlameIcon, InfoIcon, TrendingUpIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

interface ReactionStatsProps {
  cellCount: number;
  txQueue: number;
  tps: number;
  txCount: number;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  clearReaction: () => void;
  startRandomReaction: () => void;
}

const ReactionStats: React.FC<ReactionStatsProps> = ({
  cellCount,
  txQueue,
  tps,
  txCount,
  isPaused,
  setIsPaused,
  clearReaction,
  startRandomReaction
}) => {
  const [showTips, setShowTips] = useState(false);
  const maxTPS = 20; // Estimated maximum TPS (adjust based on network)
  
  // Calculate TPS percentage for the progress bar
  const tpsPercentage = Math.min(100, (tps / maxTPS) * 100);
  
  // Format TPS with color coding
  const formatTPS = () => {
    if (tps > 15) {
      return <Badge variant="default" className="bg-green-500 text-white">{tps.toFixed(1)}</Badge>;
    } else if (tps > 10) {
      return <Badge variant="default" className="bg-green-400">{tps.toFixed(1)}</Badge>;
    } else if (tps > 5) {
      return <Badge variant="default" className="bg-yellow-400">{tps.toFixed(1)}</Badge>;
    } else if (tps > 0) {
      return <Badge variant="default" className="bg-orange-400">{tps.toFixed(1)}</Badge>;
    } else {
      return <Badge variant="outline">{tps.toFixed(1)}</Badge>;
    }
  };
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>Simulation Stats</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={() => setShowTips(!showTips)}
          >
            <InfoIcon className="h-4 w-4" />
            <span className="sr-only">Toggle Tips</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {showTips && (
            <div className="bg-secondary p-3 rounded-md text-xs text-secondary-foreground mb-4">
              <p className="font-medium mb-1">Chain Reaction Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Click anywhere to add energy to atoms</li>
                <li>Atoms with energy &gt; 1 will explode</li>
                <li>Try different patterns with the Random button</li>
                <li>Higher energy creates bigger chain reactions</li>
              </ul>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Active Atoms:</span>
            <Badge variant="secondary" className="text-xl">{cellCount}</Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Pending Tx:</span>
            <div className="flex items-center gap-2">
              <FlameIcon className={`h-4 w-4 ${txQueue > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground"}`} />
              <Badge variant="outline" className={txQueue > 0 ? "bg-amber-100 dark:bg-amber-900" : ""}>{txQueue}</Badge>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Transactions:</span>
            <Badge variant="outline">{txCount}</Badge>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground">TPS:</span>
              {formatTPS()}
            </div>
            <Progress value={tpsPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0</span>
              <span>{maxTPS}+</span>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <PlayIcon className="mr-1 h-4 w-4" /> : <PauseIcon className="mr-1 h-4 w-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearReaction}
            >
              <TrashIcon className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </div>
          
          <Button 
            variant="default" 
            size="sm"
            onClick={startRandomReaction}
            className="w-full relative overflow-hidden group"
          >
            <ZapIcon className="mr-1 h-4 w-4 group-hover:animate-pulse" />
            <span>Random Reaction</span>
            <span className="absolute inset-0 bg-white dark:bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></span>
          </Button>
          
          <Button 
            variant="secondary" 
            size="sm"
            onClick={startRandomReaction}
            className="w-full"
          >
            <TrendingUpIcon className="mr-1 h-4 w-4" />
            <span>Stress Test (Coming Soon)</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReactionStats;