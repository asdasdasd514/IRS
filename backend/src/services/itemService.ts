import { Item } from '../models/itemModel.js';

const mockItems: Item[] = [
  { id: '1', name: 'Item Alpha', category: 'System', status: 'Active', createdAt: new Date() },
  { id: '2', name: 'Item Beta', category: 'Module', status: 'Pending', createdAt: new Date() },
  { id: '3', name: 'Item Gamma', category: 'Service', status: 'Active', createdAt: new Date() }
];

export const getAllItems = async (): Promise<Item[]> => {
  return mockItems;
};
