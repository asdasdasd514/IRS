import { Router } from 'express';
import { checkHealth } from '../controllers/healthController.js';

const router = Router();

// Health Check Endpoint
router.get('/health', checkHealth);

// Sample Data Endpoint
router.get('/data', (req, res) => {
  res.json({
    success: true,
    items: [
      { id: '1', name: 'Item Alpha', category: 'System', status: 'Active' },
      { id: '2', name: 'Item Beta', category: 'Module', status: 'Pending' },
      { id: '3', name: 'Item Gamma', category: 'Service', status: 'Active' }
    ]
  });
});

export default router;
