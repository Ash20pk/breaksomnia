// utils/AtomPhysics.ts

// Atom interface
export interface Atom {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    energy: number;
    radius: number;
    color: string;
    lastCollision: number;
  }
  
  export interface AtomPhysicsOptions {
    maxEnergy: number;
    width: number;
    height: number;
    damping: number;
    energyThreshold: number;
    collisionCooldown: number;
  }
  
  export class AtomPhysics {
    private atoms: Atom[] = [];
    private options: AtomPhysicsOptions;
    private collisionsProcessed = new Set<string>();
    
    constructor(options: AtomPhysicsOptions) {
      this.options = {
        maxEnergy: 4,
        width: 800,
        height: 600,
        damping: 0.9,
        energyThreshold: 1,
        collisionCooldown: 500,
        ...options
      };
    }
    
    // Update atoms for the current frame
    update(atomList: Atom[], deltaTime: number): { 
      updatedAtoms: Atom[],
      collisions: Array<{ atomA: Atom, atomB: Atom }>,
      explosions: Atom[]
    } {
      // Make a copy of atoms to work with
      const updatedAtoms = JSON.parse(JSON.stringify(atomList)) as Atom[];
      const collisions: Array<{ atomA: Atom, atomB: Atom }> = [];
      const explosions: Atom[] = [];
      
      // Clear processed collisions set if it gets too large
      if (this.collisionsProcessed.size > 1000) {
        this.collisionsProcessed.clear();
      }
      
      // First pass: Movement and wall collisions
      this.updatePositions(updatedAtoms, deltaTime);
      
      // Second pass: Atom-to-atom collisions
      this.processCollisions(updatedAtoms, collisions);
      
      // Third pass: Check for explosions
      this.processExplosions(updatedAtoms, explosions);
      
      return { updatedAtoms, collisions, explosions };
    }
    
    // Update atom positions and handle wall collisions
    private updatePositions(atoms: Atom[], deltaTime: number) {
      atoms.forEach(atom => {
        // Apply velocity (scaled by deltaTime for frame rate independence)
        atom.x += atom.vx * deltaTime * 60;
        atom.y += atom.vy * deltaTime * 60;
        
        // Handle wall collisions with damping
        if (atom.x - atom.radius < 0) {
          atom.x = atom.radius;
          atom.vx = Math.abs(atom.vx) * this.options.damping;
        } else if (atom.x + atom.radius > this.options.width) {
          atom.x = this.options.width - atom.radius;
          atom.vx = -Math.abs(atom.vx) * this.options.damping;
        }
        
        if (atom.y - atom.radius < 0) {
          atom.y = atom.radius;
          atom.vy = Math.abs(atom.vy) * this.options.damping;
        } else if (atom.y + atom.radius > this.options.height) {
          atom.y = this.options.height - atom.radius;
          atom.vy = -Math.abs(atom.vy) * this.options.damping;
        }
        
        // Apply a very small amount of random movement for more interesting simulation
        atom.vx += (Math.random() - 0.5) * 0.05;
        atom.vy += (Math.random() - 0.5) * 0.05;
        
        // Apply minimal drag to prevent perpetual motion
        atom.vx *= 0.995;
        atom.vy *= 0.995;
      });
    }
    
    // Handle atom-to-atom collisions
    private processCollisions(atoms: Atom[], collisionsOutput: Array<{ atomA: Atom, atomB: Atom }>) {
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const atomA = atoms[i];
          const atomB = atoms[j];
          
          // Skip if either atom has reached max energy
          if (atomA.energy >= this.options.maxEnergy || atomB.energy >= this.options.maxEnergy) continue;
          
          // Calculate distance between atoms
          const dx = atomB.x - atomA.x;
          const dy = atomB.y - atomA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Check for collision
          if (distance < atomA.radius + atomB.radius) {
            // Create a unique collision ID
            const collisionId = [atomA.id, atomB.id].sort().join('_');
            
            // Check if this collision was already processed recently
            const now = Date.now();
            if (now - atomA.lastCollision > this.options.collisionCooldown && 
                now - atomB.lastCollision > this.options.collisionCooldown && 
                !this.collisionsProcessed.has(collisionId)) {
              
              this.collisionsProcessed.add(collisionId);
              
              // Collision response - physics
              const nx = dx / distance;
              const ny = dy / distance;
              
              // Relative velocity
              const vx = atomB.vx - atomA.vx;
              const vy = atomB.vy - atomA.vy;
              
              // Relative velocity along normal
              const velAlongNormal = vx * nx + vy * ny;
              
              // Skip if atoms are moving away from each other
              if (velAlongNormal > 0) continue;
              
              // Bounce effect - simplified physics
              const bounceFactor = 1.5; // More energetic bounce
              
              // New velocities
              const dv = velAlongNormal * bounceFactor;
              
              atomA.vx -= nx * dv;
              atomA.vy -= ny * dv;
              atomB.vx += nx * dv;
              atomB.vy += ny * dv;
              
              // Move atoms apart to prevent sticking
              const overlap = (atomA.radius + atomB.radius - distance) * 0.5;
              atomA.x -= nx * overlap;
              atomA.y -= ny * overlap;
              atomB.x += nx * overlap;
              atomB.y += ny * overlap;
              
              // Increase energy for both atoms
              atomA.energy += this.options.energyThreshold;
              atomB.energy += this.options.energyThreshold;
              
              // Update last collision time
              atomA.lastCollision = now;
              atomB.lastCollision = now;
              
              // Add to collisions output
              collisionsOutput.push({ atomA, atomB });
            }
          }
        }
      }
    }
    
    // Check for atoms that should explode
    private processExplosions(atoms: Atom[], explosionsOutput: Atom[]) {
      for (let i = atoms.length - 1; i >= 0; i--) {
        if (atoms[i].energy >= this.options.maxEnergy) {
          // Add to explosions output
          explosionsOutput.push(atoms[i]);
          
          // Remove the exploded atom
          atoms.splice(i, 1);
        }
      }
    }
    
    // Create explosion fragments
    createExplosionFragments(explodedAtom: Atom, count: number = 3): Atom[] {
      const fragments: Atom[] = [];
      
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        
        // Create fragment with random properties but starting from explosion point
        const fragment: Atom = {
          id: `atom-${Date.now()}-${i}`,
          x: explodedAtom.x,
          y: explodedAtom.y,
          vx: Math.cos(angle) * (Math.random() * 3 + 2),
          vy: Math.sin(angle) * (Math.random() * 3 + 2),
          energy: 1,
          radius: explodedAtom.radius * 0.8,
          color: this.getAtomColor(1),
          lastCollision: 0
        };
        
        fragments.push(fragment);
      }
      
      return fragments;
    }
    
    // Get color based on energy level
    getAtomColor(energy: number): string {
      switch (Math.min(energy, this.options.maxEnergy)) {
        case 1: return '#4299e1'; // Blue
        case 2: return '#805ad5'; // Purple
        case 3: return '#f56565'; // Red
        case 4: return '#ed8936'; // Orange
        default: return '#4299e1';
      }
    }
  }