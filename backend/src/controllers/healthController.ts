import { Request, Response } from 'express';

export const checkHealth = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'IRS Backend API is running smoothly',
    timestamp: new Date().toISOString(),
    systemInfo: {
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
};
