// components/SnakeGame/Leaderboard.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Score {
  address: string;
  score: number;
}

interface LeaderboardProps {
  highScores: Score[];
  userAddress: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  highScores,
  userAddress
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {highScores.length > 0 ? (
                highScores.map((item, index) => (
                  <TableRow key={index} className={item.address.toLowerCase() === userAddress.toLowerCase() ? "bg-muted" : ""}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      {item.address.substring(0, 6)}...{item.address.substring(38)}
                      {item.address.toLowerCase() === userAddress.toLowerCase() && (
                        <Badge variant="outline" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.score}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No scores yet. Be the first to play!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Leaderboard;