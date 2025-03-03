'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
// Import Phaser dynamically on the client side only
import dynamic from 'next/dynamic';

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

// Helper to convert grid position to canvas position
const gridToCanvas = (gridX: number, gridY: number, gridSize: number, canvasWidth: number, canvasHeight: number) => {
  const cellWidth = canvasWidth / gridSize;
  const cellHeight = canvasHeight / gridSize;
  
  return {
    x: gridX * cellWidth + cellWidth / 2,
    y: gridY * cellHeight + cellHeight / 2
  };
};

// Helper to convert canvas position to grid position
const canvasToGrid = (canvasX: number, canvasY: number, gridSize: number, canvasWidth: number, canvasHeight: number) => {
  const cellWidth = canvasWidth / gridSize;
  const cellHeight = canvasHeight / gridSize;
  
  return {
    x: Math.floor(canvasX / cellWidth),
    y: Math.floor(canvasY / cellHeight)
  };
};

const ReactionBoard: React.FC<ReactionBoardProps> = ({
  cells,
  gridSize,
  cellSize,
  maxEnergy,
  onCellClick
}) => {
  const gameRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: gridSize * cellSize, height: gridSize * cellSize });
  const phaserSceneRef = useRef<any>(null);
  const atomsRef = useRef<Map<string, any>>(new Map());
  const [isClient, setIsClient] = useState(false);
  
  // Set isClient to true when component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Get color based on energy level
  const getEnergyColor = (energy: number) => {
    // Calculate color based on energy percentage
    const energyPercent = Math.min(energy / maxEnergy, 1);
    
    // More vibrant color palette with 7 distinct zones
    if (energyPercent < 0.15) {
      return 0x1E90FF; // Cool blue
    } else if (energyPercent < 0.3) {
      return 0x00BFFF; // Electric blue
    } else if (energyPercent < 0.45) {
      return 0x8A2BE2; // Bright purple
    } else if (energyPercent < 0.6) {
      return 0xFF1493; // Hot pink
    } else if (energyPercent < 0.75) {
      return 0xFF0000; // Bright red
    } else if (energyPercent < 0.9) {
      return 0xFF8C00; // Bright orange
    } else {
      return 0xFFD700; // Yellow/white hot
    }
  };

  // Create and configure Phaser game
  useEffect(() => {
    if (!isClient || !canvasContainerRef.current) return;
    
    // Dynamically import Phaser only on the client side
    const initPhaser = async () => {
      const Phaser = (await import('phaser')).default;
      
      // Determine canvas size based on container
      const containerWidth = canvasContainerRef.current?.clientWidth || gridSize * cellSize;
      const containerHeight = containerWidth * (gridSize * cellSize) / (gridSize * cellSize);
      setCanvasSize({ width: containerWidth, height: containerHeight });
      
      // Phaser configuration
      const config: any = {
        type: Phaser.AUTO,
        width: containerWidth,
        height: containerHeight,
        parent: canvasContainerRef.current,
        transparent: true,
        physics: {
          default: 'matter',
          matter: {
            gravity: { y: 0 },
            debug: false,
            setBounds: true
          }
        },
        scene: {
          create: function(this: any) {
            // Store reference to the scene
            phaserSceneRef.current = this;
            
            // Add subtle particle background for cosmic effect
            const particles = this.add.particles(0, 0, 'particle', {
              alpha: { start: 0, end: 0.1 },
              scale: { start: 0.5, end: 0 },
              speed: 20,
              lifespan: 2000,
              blendMode: 'ADD',
              emitting: true,
              quantity: 1,
              emitZone: { 
                type: 'random', 
                source: new Phaser.Geom.Rectangle(0, 0, containerWidth, containerHeight) 
              }
            });

            // Handle clicks on the canvas
            this.input.on('pointerdown', (pointer: any) => {
              const { x, y } = canvasToGrid(
                pointer.x, 
                pointer.y, 
                gridSize, 
                containerWidth, 
                containerHeight
              );
              
              // Ensure within grid bounds
              if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                onCellClick(x, y);
              }
            });
            
            // Create connections between atoms
            this.matter.world.on('afterupdate', () => {
              // We'll implement the connections in updateAtoms
            });
          },
          preload: function(this: any) {
            // Generate a circular particle
            const graphics = this.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0xffffff);
            graphics.fillCircle(8, 8, 8);
            graphics.generateTexture('particle', 16, 16);
          }
        }
      };
      
      // Create the game
      if (!gameRef.current) {
        gameRef.current = new Phaser.Game(config);
      }
    };
    
    initPhaser();
    
    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [isClient, gridSize, cellSize]);
  
  // Update the atoms whenever cells change
  useEffect(() => {
    if (!isClient || !phaserSceneRef.current) return;
    
    const updateAtoms = async () => {
      const Phaser = (await import('phaser')).default;
      const scene = phaserSceneRef.current;
      if (!scene) return;
      
      const currentAtomKeys = new Set<string>();
      
      // Update or create atoms for each cell
      cells.forEach(cell => {
        const atomKey = `${cell.x}-${cell.y}`;
        currentAtomKeys.add(atomKey);
        
        const canvasPos = gridToCanvas(
          cell.x, 
          cell.y, 
          gridSize, 
          canvasSize.width, 
          canvasSize.height
        );
        
        if (atomsRef.current.has(atomKey)) {
          // Update existing atom
          const atom = atomsRef.current.get(atomKey);
          if (atom) {
            // Update energy text
            const energyText = atom.getAt(1);
            energyText.setText(cell.energy.toString());
            
            // Update atom appearance based on energy
            const atomCircle = atom.getAt(0);
            atomCircle.clear();
            const color = getEnergyColor(cell.energy);
            atomCircle.fillStyle(color, 1);
            
            // Size based on energy (with a minimum size)
            const size = Math.max(10, Math.min(30, 10 + cell.energy * 0.8));
            atomCircle.fillCircle(0, 0, size);
            
            // Add glow if high energy
            if (cell.energy > 1) {
              atomCircle.fillStyle(color, 0.3);
              atomCircle.fillCircle(0, 0, size + 5);
              
              if (cell.energy > 3) {
                atomCircle.fillStyle(color, 0.1);
                atomCircle.fillCircle(0, 0, size + 10);
              }
            }
            
            // If it's about to explode (energy >= 2), make it pulse
            if (cell.energy >= 2) {
              scene.tweens.add({
                targets: atom,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 300,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
              });
            } else {
              // Stop any existing pulse animation
              scene.tweens.killTweensOf(atom);
              atom.setScale(1);
            }
            
            // Apply some random motion to make it feel alive
            const body = atom.body;
            if (body) {
              const force = {
                x: (Math.random() - 0.5) * 0.0001 * cell.energy, 
                y: (Math.random() - 0.5) * 0.0001 * cell.energy
              };
              scene.matter.body.applyForce(body, { x: body.position.x, y: body.position.y }, force);
            }
          }
        } else {
          // Create new atom
          const color = getEnergyColor(cell.energy);
          
          // Create a container for the atom
          const atomContainer = scene.add.container(canvasPos.x, canvasPos.y);
          
          // Create the atom circle
          const size = Math.max(10, Math.min(30, 10 + cell.energy * 0.8));
          const atomCircle = scene.add.graphics();
          atomCircle.fillStyle(color, 1);
          atomCircle.fillCircle(0, 0, size);
          
          // Add glow if high energy
          if (cell.energy > 1) {
            atomCircle.fillStyle(color, 0.3);
            atomCircle.fillCircle(0, 0, size + 5);
            
            if (cell.energy > 3) {
              atomCircle.fillStyle(color, 0.1);
              atomCircle.fillCircle(0, 0, size + 10);
            }
          }
          
          // Create energy text
          const energyText = scene.add.text(0, 0, cell.energy.toString(), {
            fontSize: '14px',
            color: '#FFFFFF',
            fontStyle: 'bold'
          }).setOrigin(0.5);
          
          // Add to container
          atomContainer.add(atomCircle);
          atomContainer.add(energyText);
          
          // Add physics body
          const physicsCircle = scene.matter.add.circle(canvasPos.x, canvasPos.y, size, {
            restitution: 0.9,
            friction: 0.005,
            frictionAir: 0.001,
          });
          
          scene.matter.add.gameObject(atomContainer, physicsCircle);
          
          // Set velocity with random direction but magnitude based on energy
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.5 + cell.energy * 0.1;
          scene.matter.body.setVelocity(physicsCircle, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
          });
          
          // Make high energy atoms pulse
          if (cell.energy >= 2) {
            scene.tweens.add({
              targets: atomContainer,
              scaleX: 1.2,
              scaleY: 1.2,
              duration: 300,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut'
            });
          }
          
          // Store reference to the atom
          atomsRef.current.set(atomKey, atomContainer);
        }
      });
      
      // Remove atoms that are no longer in the cells array
      atomsRef.current.forEach((atom, key) => {
        if (!currentAtomKeys.has(key)) {
          // Make it fade out
          scene.tweens.add({
            targets: atom,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => {
              // Remove the physics body
              if (atom.body) {
                scene.matter.world.remove(atom.body);
              }
              // Remove from scene
              atom.destroy();
              // Remove from our reference map
              atomsRef.current.delete(key);
            }
          });
        }
      });
      
      // Draw connections between high energy atoms
      scene.matter.world.renderBodyBounds = false;
      scene.matter.world.renderVelocity = false;
      
      // Create a new graphics object for connections
      const graphics = scene.add.graphics();
      graphics.clear();
      
      const highEnergyCells = cells.filter(cell => cell.energy > 3);
      
      for (let i = 0; i < highEnergyCells.length; i++) {
        for (let j = i + 1; j < highEnergyCells.length; j++) {
          const cell1 = highEnergyCells[i];
          const cell2 = highEnergyCells[j];
          
          // Only connect nearby cells
          const dx = cell1.x - cell2.x;
          const dy = cell1.y - cell2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 8) {
            const atom1 = atomsRef.current.get(`${cell1.x}-${cell1.y}`);
            const atom2 = atomsRef.current.get(`${cell2.x}-${cell2.y}`);
            
            if (atom1 && atom2) {
              const lineWidth = Math.min((cell1.energy + cell2.energy) / 30, 2);
              
              // Interpolate color between the two atoms
              const color1 = getEnergyColor(cell1.energy);
              const color2 = getEnergyColor(cell2.energy);
              
              graphics.lineStyle(lineWidth, color1, 0.4);
              graphics.beginPath();
              graphics.moveTo(atom1.x, atom1.y);
              graphics.lineTo(atom2.x, atom2.y);
              graphics.strokePath();
            }
          }
        }
      }
    };
    
    // Run the update
    updateAtoms();
    
    // Set up a timer to periodically update the atom positions
    const timer = setInterval(() => {
      updateAtoms();
    }, 50);
    
    return () => {
      clearInterval(timer);
    };
  }, [cells, gridSize, maxEnergy, canvasSize, isClient]);
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Chain Reaction Simulation</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div 
          ref={canvasContainerRef} 
          className="w-full flex justify-center"
          style={{
            aspectRatio: `${gridSize}/${gridSize}`,
            maxWidth: `${gridSize * cellSize}px`,
            background: 'linear-gradient(to bottom, #111827, #1f2937)',
            borderRadius: '0.5rem'
          }}
        />
      </CardContent>
      <div className="px-6 pb-4 text-center text-sm text-muted-foreground">
        Click anywhere to add energy. Atoms with energy &gt; 1 will explode!
      </div>
    </Card>
  );
};

export default ReactionBoard;