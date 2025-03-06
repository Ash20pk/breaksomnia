import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Transaction types
const TX_TYPE_REACTION = 'reaction';

// Helper to add a cell to the database
async function addCell(cell: any) {
  try {
    const x = Math.floor(cell.x);
    const y = Math.floor(cell.y);
      
    // Insert new cell
    const { error } = await supabase
      .from('cells')
      .insert({
        id: cell.id,
        x: x,
        y: y,
        energy: cell.energy,
        timestamp: Date.now()
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error adding cell:', error);
    return false;
  }
}

// Helper to add a transaction to the queue
async function addToTransactionQueue(cellData: any) {
  try {
    const { error } = await supabase
      .from('transaction_queue')
      .insert({
        atom_id: cellData.id,
        x: cellData.x,
        y: cellData.y,
        energy: cellData.energy,
        status: 'pending',
        timestamp: Date.now(),
        retries: 0,
        type: TX_TYPE_REACTION
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error adding to transaction queue:', error);
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '10', 10);
    const batchSize = Math.min(count, 100); // Limit to 100 atoms per request
    
    console.log(`Generating ${batchSize} atoms...`);
    
    // Canvas dimensions (from original app)
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;
    const ATOM_RADIUS = 15;
    
    const generatedAtoms = [];
    const failedAtoms = [];
    
    for (let i = 0; i < batchSize; i++) {
      // Generate random position
      const x = Math.floor(Math.random() * (CANVAS_WIDTH - ATOM_RADIUS * 2) + ATOM_RADIUS);
      const y = Math.floor(Math.random() * (CANVAS_HEIGHT - ATOM_RADIUS * 2) + ATOM_RADIUS);
      
      // Generate random energy (1-3)
      const energy = Math.floor(Math.random() * 3) + 1;
      
      // Generate unique ID
      const atomId = `stress-atom-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      const newAtom = {
        id: atomId,
        x,
        y,
        energy
      };
      
      // Add to database
      const addCellSuccess = await addCell(newAtom);
      
      // Add to transaction queue
      const addTxSuccess = await addToTransactionQueue(newAtom);
      
      if (addCellSuccess && addTxSuccess) {
        generatedAtoms.push(newAtom);
      } else {
        failedAtoms.push(newAtom);
      }
      
      // Short delay to prevent conflicts
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    return NextResponse.json({ 
      success: true, 
      generated: generatedAtoms.length,
      failed: failedAtoms.length
    });
  } catch (error: any) {
    console.error('Error generating atoms:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
}