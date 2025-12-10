import { getPendingApprovals, updateUserStatus } from '../../redis-client.js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const approvals = await getPendingApprovals();
    
    return NextResponse.json({
      success: true,
      count: approvals.length,
      approvals: approvals
    });
    
  } catch (error) {
    console.error('Get approvals error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { telegramId, status, approvedBy } = body;
    
    if (!telegramId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing telegramId or status' },
        { status: 400 }
      );
    }
    
    const updatedUser = await updateUserStatus(telegramId, status, approvedBy);
    
    return NextResponse.json({
      success: true,
      message: `Статус обновлён на "${status}"`,
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Update approval error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
