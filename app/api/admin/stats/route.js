import { getSystemStats } from '@/lib/redis';
import { NextResponse } from 'next/server';

export async function GET() {
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
