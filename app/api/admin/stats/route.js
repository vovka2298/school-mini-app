import { getSystemStats } from '../../redis-client.js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const stats = await getSystemStats();
    
    return NextResponse.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
