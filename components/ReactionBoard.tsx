// components/ChainReaction/ReactionBoard.tsx
import React, { useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Cell {
  x: number;
  y: number;
  energy: number;
}

interface ReactionBoardProps {
  cells: Cell[];
  gridSize: number;
  cellSize: number;
  maxEnergy: number;
  onCellClick: (x: number, y: number) => void;
}

const ReactionBoard: React.FC<ReactionBoardProps> = ({
  cells,
  gridSize,
  cellSize,
  maxEnergy,
  onCellClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Get color based on energy level - more vibrant colors
  const getEnergyColor = (energy: number) => {
    // Calculate color based on energy percentage
    const energyPercent = Math.min(energy / maxEnergy, 1);
    
    // More vibrant color palette with 7 distinct zones
    if (energyPercent < 0.15) {
      // Cool blue
      return 'rgb(30, 144, 255)';
    } else if (energyPercent < 0.3) {
      // Electric blue
      return 'rgb(0, 191, 255)';
    } else if (energyPercent < 0.45) {
      // Bright purple
      return 'rgb(138, 43, 226)';
    } else if (energyPercent < 0.6) {
      // Hot pink
      return 'rgb(255, 20, 147)';
    } else if (energyPercent < 0.75) {
      // Bright red
      return 'rgb(255, 0, 0)';
    } else if (energyPercent < 0.9) {
      // Bright orange
      return 'rgb(255, 140, 0)';
    } else {
      // Yellow/white hot
      return 'rgb(255, 215, 0)';
    }
  };
  
  // Draw canvas function with improved visuals
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Create a dark background with subtle pattern
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw subtle grid pattern
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
    ctx.lineWidth = 0.5;
    
    for (let x = 0; x <= gridSize; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, gridSize * cellSize);
      ctx.stroke();
    }
    
    for (let y = 0; y <= gridSize; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(gridSize * cellSize, y * cellSize);
      ctx.stroke();
    }
    
    // Add a subtle glow to the entire grid
    const timestamp = Date.now() / 1000;
    const glowIntensity = (Math.sin(timestamp * 0.5) * 0.1) + 0.1;
    ctx.fillStyle = `rgba(66, 153, 225, ${glowIntensity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Function to draw particle effect
    const drawParticles = (x: number, y: number, energy: number, time: number) => {
      const particleCount = Math.min(energy * 2, 15);
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time;
        const distance = (Math.sin(time * 2 + i) * 0.3 + 0.7) * energy * 0.7;
        const pX = x + cellSize / 2 + Math.cos(angle) * distance;
        const pY = y + cellSize / 2 + Math.sin(angle) * distance;
        
        const size = (Math.sin(time + i * 0.5) * 0.5 + 1.5) * (energy / 10);
        
        ctx.fillStyle = getEnergyColor(energy);
        ctx.beginPath();
        ctx.arc(pX, pY, size, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    
    // Draw cells with cool effects
    cells.forEach(cell => {
      const x = cell.x * cellSize;
      const y = cell.y * cellSize;
      const energy = cell.energy;
      const time = Date.now() / 500;
      
      // Draw cell glow first (so it's behind the cell)
      if (energy > 1) {
        const glowSize = 2 + (energy / maxEnergy) * 10;
        const pulseSize = Math.sin(time * energy * 0.2) * 2 + glowSize;
        
        const glow = ctx.createRadialGradient(
          x + cellSize / 2, 
          y + cellSize / 2, 
          0,
          x + cellSize / 2, 
          y + cellSize / 2, 
          cellSize / 2 + pulseSize
        );
        
        // Get the color for the glow based on energy
        const baseColor = getEnergyColor(energy);
        const rgbValues = baseColor.match(/\d+/g);
        if (rgbValues && rgbValues.length >= 3) {
          const r = rgbValues[0];
          const g = rgbValues[1];
          const b = rgbValues[2];
          glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
          glow.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.3)`);
          glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        }
        
        ctx.fillStyle = glow;
        const glowRadius = cellSize + pulseSize * 2;
        ctx.fillRect(
          x + cellSize/2 - glowRadius/2, 
          y + cellSize/2 - glowRadius/2, 
          glowRadius, 
          glowRadius
        );
        
        // Add particles for high energy cells
        if (energy > 5) {
          drawParticles(x, y, energy, time);
        }
      }
      
      // Draw cell with rounded corners
      const cornerRadius = 2;
      ctx.fillStyle = getEnergyColor(energy);
      ctx.beginPath();
      ctx.moveTo(x + cornerRadius, y);
      ctx.lineTo(x + cellSize - cornerRadius, y);
      ctx.quadraticCurveTo(x + cellSize, y, x + cellSize, y + cornerRadius);
      ctx.lineTo(x + cellSize, y + cellSize - cornerRadius);
      ctx.quadraticCurveTo(x + cellSize, y + cellSize, x + cellSize - cornerRadius, y + cellSize);
      ctx.lineTo(x + cornerRadius, y + cellSize);
      ctx.quadraticCurveTo(x, y + cellSize, x, y + cellSize - cornerRadius);
      ctx.lineTo(x, y + cornerRadius);
      ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
      ctx.closePath();
      ctx.fill();
      
      // Add a subtle inner gradient to the cell
      const innerGradient = ctx.createRadialGradient(
        x + cellSize * 0.7, 
        y + cellSize * 0.3, 
        cellSize * 0.1,
        x + cellSize * 0.5, 
        y + cellSize * 0.5, 
        cellSize
      );
      
      const baseColor = getEnergyColor(energy);
      const rgbValues = baseColor.match(/\d+/g);
      if (rgbValues && rgbValues.length >= 3) {
        const r = parseInt(rgbValues[0]);
        const g = parseInt(rgbValues[1]);
        const b = parseInt(rgbValues[2]);
        innerGradient.addColorStop(0, `rgba(255, 255, 255, 0.3)`);
        innerGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.1)`);
      }
      
      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.moveTo(x + cornerRadius, y);
      ctx.lineTo(x + cellSize - cornerRadius, y);
      ctx.quadraticCurveTo(x + cellSize, y, x + cellSize, y + cornerRadius);
      ctx.lineTo(x + cellSize, y + cellSize - cornerRadius);
      ctx.quadraticCurveTo(x + cellSize, y + cellSize, x + cellSize - cornerRadius, y + cellSize);
      ctx.lineTo(x + cornerRadius, y + cellSize);
      ctx.quadraticCurveTo(x, y + cellSize, x, y + cellSize - cornerRadius);
      ctx.lineTo(x, y + cornerRadius);
      ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
      ctx.closePath();
      ctx.fill();
      
      // Draw energy number with better font and shadow
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 3;
      ctx.font = `bold ${Math.min(10 + energy/5, 14)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(energy.toString(), x + cellSize / 2, y + cellSize / 2);
      ctx.shadowBlur = 0;  // Reset shadow
    });
    
    // Draw connections between high energy cells
    const highEnergyCells = cells.filter(cell => cell.energy > 3);
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < highEnergyCells.length; i++) {
      for (let j = i + 1; j < highEnergyCells.length; j++) {
        const cell1 = highEnergyCells[i];
        const cell2 = highEnergyCells[j];
        
        // Only connect nearby cells
        const dx = cell1.x - cell2.x;
        const dy = cell1.y - cell2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 8) {
          const x1 = cell1.x * cellSize + cellSize / 2;
          const y1 = cell1.y * cellSize + cellSize / 2;
          const x2 = cell2.x * cellSize + cellSize / 2;
          const y2 = cell2.y * cellSize + cellSize / 2;
          
          // Create gradient for connection line
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, getEnergyColor(cell1.energy));
          gradient.addColorStop(1, getEnergyColor(cell2.energy));
          
          // Draw line with varying width based on energy
          const lineWidth = Math.min((cell1.energy + cell2.energy) / 30, 2);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = lineWidth;
          
          // Add pulsing effect
          const pulseIntensity = Math.sin(Date.now() / 200) * 0.5 + 0.5;
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.globalAlpha = 0.2 + pulseIntensity * 0.3;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  };
  
  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX / cellSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / cellSize);
    
    // Ensure within grid bounds
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      onCellClick(x, y);
    }
  };
  
  // Animation loop
  useEffect(() => {
    let animationFrameId: number;
    
    const animate = () => {
      draw();
      animationFrameId = window.requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [cells]);
  
  // Set canvas size on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = gridSize * cellSize;
    canvas.height = gridSize * cellSize;
    
    draw();
  }, [gridSize, cellSize]);
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Chain Reaction Simulation</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 cursor-pointer"
          style={{
            width: `${gridSize * cellSize}px`,
            height: `${gridSize * cellSize}px`,
          }}
        />
      </CardContent>
      <div className="px-6 pb-4 text-center text-sm text-muted-foreground">
        Click on cells to add energy. Cells with energy `&gt;` 1 will explode!
      </div>
    </Card>
  );
};

export default ReactionBoard;