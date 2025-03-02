'use client';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import ChainReaction from '../components/ChainReaction';

// Shadcn UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Icons
import { ActivityIcon } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background py-8">
      <Head>
        <title>Chain Reaction on Somnia Blockchain</title>
        <meta name="description" content="Chain Reaction simulation to stress test Somnia blockchain" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8 flex justify-center items-center gap-2">
          <ActivityIcon className="h-8 w-8" />
          Chain Reaction on Somnia Blockchain
        </h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>How it Works</CardTitle>
            <CardDescription>
              A physics-inspired chain reaction simulation for stress testing the Somnia blockchain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc list-inside text-sm text-muted-foreground">
              <li>Click on a cell to add energy (or use the Random Reaction button)</li>
              <li>A cell with energy `&gt;` 1 will explode, sending energy to adjacent cells</li>
              <li>Every explosion is recorded on the Somnia blockchain</li>
              <li>The simulation runs continuously until all cells stabilize or decay</li>
              <li>Cells decay after reaching 50 energy</li>
              <li>Watch the transaction log to see blockchain activity in real-time</li>
            </ul>
          </CardContent>
        </Card>
        
        <ChainReaction />
      </main>
      
      <footer className="mt-12 text-center text-muted-foreground">
        <p>Chain Reaction for Somnia Blockchain Stress Testing</p>
      </footer>
    </div>
  );
}