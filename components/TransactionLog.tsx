// components/ChainReaction/TransactionLog.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ClubIcon, LucideCheckCircle2, ClockIcon, ArrowUpRightIcon } from 'lucide-react';

interface Transaction {
  hash: string;
  x: number;
  y: number;
  energy: number;
  timestamp: number;
}

interface TransactionLogProps {
  transactions: Transaction[];
}

const TransactionLog: React.FC<TransactionLogProps> = ({
  transactions
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Time</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="text-right">Energy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length > 0 ? (
                transactions.map((tx, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {tx.hash.substring(0, 6)}...{tx.hash.substring(tx.hash.length - 4)}
                      </span>
                    </TableCell>
                    <TableCell>
                      ({tx.x}, {tx.y})
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={tx.energy > 10 ? "destructive" : tx.energy > 1 ? "default" : "outline"}
                      >
                        {tx.energy}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No transactions yet. Start clicking on cells!
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

export default TransactionLog;