import { useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const useGameSocket = () => {
  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      socket = io({
        path: '/api/socket',
        addTrailingSlash: false
      });
    }
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Update score on blockchain
  const updateScore = useCallback((address: string, score: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socket) return reject('Socket not connected');

      socket.emit('updateScore', { address, score });

      const handleSuccess = (data: any) => {
        socket?.off('scoreUpdated', handleSuccess);
        socket?.off('error', handleError);
        if (data.success) {
          resolve(data);
        } else {
          reject(data.error);
        }
      };

      const handleError = (error: any) => {
        socket?.off('scoreUpdated', handleSuccess);
        socket?.off('error', handleError);
        reject(error);
      };

      socket.on('scoreUpdated', handleSuccess);
      socket.on('error', handleError);
    });
  }, []);

  // Fetch high scores
  const fetchHighScores = useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socket) return reject('Socket not connected');

      socket.emit('fetchHighScores');

      const handleSuccess = (data: any) => {
        socket?.off('highScores', handleSuccess);
        socket?.off('error', handleError);
        resolve(data);
      };

      const handleError = (error: any) => {
        socket?.off('highScores', handleSuccess);
        socket?.off('error', handleError);
        reject(error);
      };

      socket.on('highScores', handleSuccess);
      socket.on('error', handleError);
    });
  }, []);

  // Fetch user score
  const fetchUserScore = useCallback((address: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socket) return reject('Socket not connected');

      socket.emit('fetchUserScore', address);

      const handleSuccess = (data: any) => {
        socket?.off('userScore', handleSuccess);
        socket?.off('error', handleError);
        resolve(data);
      };

      const handleError = (error: any) => {
        socket?.off('userScore', handleSuccess);
        socket?.off('error', handleError);
        reject(error);
      };

      socket.on('userScore', handleSuccess);
      socket.on('error', handleError);
    });
  }, []);

  return {
    updateScore,
    fetchHighScores,
    fetchUserScore,
  };
};
