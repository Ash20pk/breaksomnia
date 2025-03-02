'use client';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import SnakeGame from '../components/SnakeGame';
import { createWalletClient, custom } from 'viem';
import { somnia } from '../lib/chains';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

// Icons
import { ExternalLinkIcon, AlertCircleIcon, GamepadIcon } from 'lucide-react';

export default function Home() {
  const [privateKey, setPrivateKey] = useState<string>('');
  const [userAddress, setUserAddress] = useState<string>('');
  const [showGame, setShowGame] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState<boolean>(false);
  
  useEffect(() => {
    // Check if MetaMask is available
    setIsMetaMaskAvailable(typeof window !== 'undefined' && typeof window.ethereum !== 'undefined');
    
    // Get private key from environment variable
    const envPrivateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
    if (envPrivateKey) {
      setPrivateKey(envPrivateKey);
    }
  }, []);
  
  // Connect using MetaMask to get the user's address
  const connectWithMetaMask = async () => {
    setIsConnecting(true);
    setErrorMessage('');
    
    if (!window.ethereum) {
      setErrorMessage('MetaMask is not available');
      setIsConnecting(false);
      return;
    }

    try {
      // Create viem wallet client with metamask as transport
      const client = createWalletClient({
        chain: somnia,
        transport: custom(window.ethereum)
      });
      
      // Request accounts
      const [address] = await client.requestAddresses();
      
      if (!address) {
        throw new Error('No accounts found');
      }
      
      // Check if connected to Somnia network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      // Somnia chainId
      const somniaChainId = '0xc488'; 
      
      if (chainId !== somniaChainId) {
        try {
          // Try to switch to Somnia network
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: somniaChainId }],
          });
        } catch (switchError: any) {
          // This error code indicates that the chain hasn't been added to MetaMask
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: somniaChainId,
                  chainName: 'Somnia Blockchain',
                  nativeCurrency: {
                    name: 'Somnia Testnet',
                    symbol: 'STT',
                    decimals: 18,
                  },
                  rpcUrls: ['https://dream-rpc.somnia.network'],
                  blockExplorerUrls: ['https://explorer.somnia.blockchain'],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }
      
      // Set the user's address
      setUserAddress(address);
      
      // Check if we have a private key
      if (!privateKey) {
        throw new Error('No valid private key found in environment variables');
      }
      
      // Start the game
      setShowGame(true);
    } catch (error: any) {
      console.error('Error connecting with MetaMask:', error);
      setErrorMessage(error.message || 'Failed to connect with MetaMask');
    } finally {
      setIsConnecting(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background py-8">
      <Head>
        <title>Snake Game on Somnia Blockchain</title>
        <meta name="description" content="Play Snake and stress test Somnia blockchain" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8 flex justify-center items-center gap-2">
          <GamepadIcon className="h-8 w-8" />
          Snake Game on Somnia Blockchain
        </h1>
        
        {!showGame ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Connect to Play</CardTitle>
              <CardDescription>
                Connect with MetaMask to play Snake and stress test the Somnia blockchain
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {isMetaMaskAvailable ? (
                <Button
                  className="w-full"
                  onClick={connectWithMetaMask}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect with MetaMask'}
                </Button>
              ) : (
                <Alert variant="destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>MetaMask Required</AlertTitle>
                  <AlertDescription>
                    MetaMask is required to play this game. Please install MetaMask and refresh the page.
                  </AlertDescription>
                </Alert>
              )}
              
              {errorMessage && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              
              <Separator className="my-6" />
              
              <div className="space-y-4">
                <h3 className="font-medium">How it works:</h3>
                <ul className="space-y-2 list-disc list-inside text-sm text-muted-foreground">
                  <li>Connect with MetaMask to identify your address on the leaderboard</li>
                  <li>The game will use a configured private key for sending transactions</li>
                  <li>Each time the snake eats food, a transaction is sent to the blockchain</li>
                  <li>Your score is tracked and displayed on the global leaderboard</li>
                </ul>
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-between text-sm text-muted-foreground">
              <span>Powered by Somnia Blockchain</span>
              <a 
                href="https://somnia.network" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                Learn more <ExternalLinkIcon className="h-3 w-3" />
              </a>
            </CardFooter>
          </Card>
        ) : (
          <SnakeGame 
            privateKey={privateKey} 
            userAddress={userAddress}
          />
        )}
      </main>
      
      <footer className="mt-12 text-center text-muted-foreground">
        <p>Snake Game for Somnia Blockchain Stress Testing</p>
      </footer>
    </div>
  );
}